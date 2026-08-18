package com.veenagroup.central.dashboard.service;

import com.veenagroup.central.dashboard.dto.admin.AttachmentResponse;
import com.veenagroup.central.dashboard.dto.admin.DocumentRequest;
import com.veenagroup.central.dashboard.dto.admin.DocumentResponse;
import com.veenagroup.central.dashboard.entity.Category;
import com.veenagroup.central.dashboard.entity.Document;
import com.veenagroup.central.dashboard.entity.DocumentAttachment;
import com.veenagroup.central.dashboard.entity.Society;
import com.veenagroup.central.dashboard.entity.Users;
import com.veenagroup.central.dashboard.entity.enums.CategoryType;
import com.veenagroup.central.dashboard.entity.enums.FeatureKey;
import com.veenagroup.central.dashboard.exception.BusinessException;
import com.veenagroup.central.dashboard.repository.CategoryRepository;
import com.veenagroup.central.dashboard.repository.DocumentRepository;
import com.veenagroup.central.dashboard.repository.SocietyRepository;
import com.veenagroup.central.dashboard.repository.UsersRepository;
import com.veenagroup.central.dashboard.storage.FileStorageService;
import com.veenagroup.central.dashboard.web.PageResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Slf4j
@Service
public class DocumentService {

    private final DocumentRepository documentRepository;
    private final CategoryRepository categoryRepository;
    private final SocietyRepository societyRepository;
    private final UsersRepository usersRepository;
    private final FeatureLimitService featureLimitService;
    private final FileStorageService fileStorageService;

    public DocumentService(DocumentRepository documentRepository,
                            CategoryRepository categoryRepository,
                            SocietyRepository societyRepository,
                            UsersRepository usersRepository,
                            FeatureLimitService featureLimitService,
                            FileStorageService fileStorageService) {
        this.documentRepository = documentRepository;
        this.categoryRepository = categoryRepository;
        this.societyRepository = societyRepository;
        this.usersRepository = usersRepository;
        this.featureLimitService = featureLimitService;
        this.fileStorageService = fileStorageService;
    }

    @Transactional
    public DocumentResponse create(Long societyId, Long userId, DocumentRequest request) {
        featureLimitService.assertCanCreate(societyId, FeatureKey.DOCUMENTS, () -> documentRepository.countBySocietyId(societyId));

        Society society = societyRepository.findById(societyId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "SOCIETY_NOT_FOUND", "Society not found"));
        Category category = findOwnedCategory(societyId, request.categoryId());
        Users createdBy = usersRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "User not found"));

        Document document = Document.builder()
                .society(society)
                .category(category)
                .title(request.title())
                .year(request.year())
                .description(request.description())
                .isPublic(request.isPublic())
                .downloadable(request.downloadable())
                .createdBy(createdBy)
                .build();

        Document saved = documentRepository.save(document);
        log.info("Created document {} for society {}", saved.getId(), societyId);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<DocumentResponse> list(Long societyId) {
        return documentRepository.findBySocietyId(societyId).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<DocumentResponse> list(Long societyId, Pageable pageable, String search, Long categoryId, Integer year, Boolean isPublic) {
        featureLimitService.assertEnabled(societyId, FeatureKey.DOCUMENTS);
        Specification<Document> spec = buildSpecification(societyId, search, categoryId, year, isPublic);
        return PageResponse.of(documentRepository.findAll(spec, pageable).map(this::toResponse));
    }

    private Specification<Document> buildSpecification(Long societyId, String search, Long categoryId, Integer year, Boolean isPublic) {
        Specification<Document> spec = (root, query, cb) -> cb.equal(root.get("society").get("id"), societyId);

        if (search != null && !search.isBlank()) {
            String pattern = "%" + search.trim().toLowerCase() + "%";
            spec = spec.and((root, query, cb) -> cb.like(cb.lower(root.get("title")), pattern));
        }
        if (categoryId != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("category").get("id"), categoryId));
        }
        if (year != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("year"), year));
        }
        if (isPublic != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("isPublic"), isPublic));
        }
        return spec;
    }

    @Transactional(readOnly = true)
    public DocumentResponse getById(Long societyId, Long documentId) {
        return toResponse(findOwned(societyId, documentId));
    }

    @Transactional
    public DocumentResponse update(Long societyId, Long documentId, DocumentRequest request) {
        Document document = findOwned(societyId, documentId);
        Category category = findOwnedCategory(societyId, request.categoryId());

        document.setTitle(request.title());
        document.setCategory(category);
        document.setYear(request.year());
        document.setDescription(request.description());
        document.setPublic(request.isPublic());
        document.setDownloadable(request.downloadable());

        Document updated = documentRepository.save(document);
        log.info("Updated document {} for society {}", updated.getId(), societyId);
        return toResponse(updated);
    }

    @Transactional
    public void delete(Long societyId, Long documentId) {
        Document document = findOwned(societyId, documentId);
        document.getAttachments().forEach(a -> fileStorageService.deleteAfterCommit(a.getFilePath()));
        documentRepository.delete(document);
        log.info("Deleted document {} for society {}", documentId, societyId);
    }

    @Transactional
    public DocumentResponse addAttachment(Long societyId, Long documentId, MultipartFile file) {
        Document document = findOwned(societyId, documentId);
        String path = fileStorageService.storePdfOnly(file, societyId, "documents");

        DocumentAttachment attachment = DocumentAttachment.builder()
                .document(document)
                .filePath(path)
                .fileName(file.getOriginalFilename())
                .build();

        document.getAttachments().add(attachment);
        Document updated = documentRepository.save(document);
        log.info("Added attachment to document {} for society {}", documentId, societyId);
        return toResponse(updated);
    }

    @Transactional
    public DocumentResponse removeAttachment(Long societyId, Long documentId, Long attachmentId) {
        Document document = findOwned(societyId, documentId);
        DocumentAttachment attachment = document.getAttachments().stream()
                .filter(a -> a.getId().equals(attachmentId))
                .findFirst()
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "ATTACHMENT_NOT_FOUND", "Attachment not found"));

        document.getAttachments().remove(attachment);
        fileStorageService.deleteAfterCommit(attachment.getFilePath());
        Document updated = documentRepository.save(document);
        log.info("Removed attachment {} from document {} for society {}", attachmentId, documentId, societyId);
        return toResponse(updated);
    }

    private Category findOwnedCategory(Long societyId, Long categoryId) {
        Category category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "CATEGORY_NOT_FOUND", "Category not found"));
        if (!category.getSociety().getId().equals(societyId) || category.getType() != CategoryType.DOCUMENT) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "INVALID_CATEGORY", "Invalid category for this society/type");
        }
        return category;
    }

    private Document findOwned(Long societyId, Long documentId) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "DOCUMENT_NOT_FOUND", "Document not found"));
        if (!document.getSociety().getId().equals(societyId)) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "DOCUMENT_NOT_FOUND", "Document not found");
        }
        return document;
    }

    private DocumentResponse toResponse(Document document) {
        List<AttachmentResponse> attachments = document.getAttachments().stream()
                .map(a -> new AttachmentResponse(a.getId(), a.getFileName(), a.getFilePath()))
                .toList();

        return new DocumentResponse(
                document.getId(), document.getTitle(),
                document.getCategory().getId(), document.getCategory().getName(),
                document.getYear(), document.getDescription(),
                document.isPublic(), document.isDownloadable(),
                attachments, document.getCreatedAt()
        );
    }
}
