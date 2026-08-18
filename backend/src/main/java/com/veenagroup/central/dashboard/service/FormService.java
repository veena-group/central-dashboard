package com.veenagroup.central.dashboard.service;

import com.veenagroup.central.dashboard.dto.admin.AttachmentResponse;
import com.veenagroup.central.dashboard.dto.admin.FormRequest;
import com.veenagroup.central.dashboard.dto.admin.FormResponse;
import com.veenagroup.central.dashboard.entity.Category;
import com.veenagroup.central.dashboard.entity.Form;
import com.veenagroup.central.dashboard.entity.FormAttachment;
import com.veenagroup.central.dashboard.entity.Society;
import com.veenagroup.central.dashboard.entity.Users;
import com.veenagroup.central.dashboard.entity.enums.CategoryType;
import com.veenagroup.central.dashboard.entity.enums.FeatureKey;
import com.veenagroup.central.dashboard.exception.BusinessException;
import com.veenagroup.central.dashboard.repository.CategoryRepository;
import com.veenagroup.central.dashboard.repository.FormRepository;
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
public class FormService {

    private final FormRepository formRepository;
    private final CategoryRepository categoryRepository;
    private final SocietyRepository societyRepository;
    private final UsersRepository usersRepository;
    private final FeatureLimitService featureLimitService;
    private final FileStorageService fileStorageService;

    public FormService(FormRepository formRepository,
                        CategoryRepository categoryRepository,
                        SocietyRepository societyRepository,
                        UsersRepository usersRepository,
                        FeatureLimitService featureLimitService,
                        FileStorageService fileStorageService) {
        this.formRepository = formRepository;
        this.categoryRepository = categoryRepository;
        this.societyRepository = societyRepository;
        this.usersRepository = usersRepository;
        this.featureLimitService = featureLimitService;
        this.fileStorageService = fileStorageService;
    }

    @Transactional
    public FormResponse create(Long societyId, Long userId, FormRequest request) {
        featureLimitService.assertCanCreate(societyId, FeatureKey.FORMS, () -> formRepository.countBySocietyId(societyId));

        Society society = societyRepository.findById(societyId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "SOCIETY_NOT_FOUND", "Society not found"));
        Category category = findOwnedCategory(societyId, request.categoryId());
        Users createdBy = usersRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "User not found"));

        Form form = Form.builder()
                .society(society)
                .category(category)
                .title(request.title())
                .year(request.year())
                .description(request.description())
                .isPublic(request.isPublic())
                .downloadable(request.downloadable())
                .createdBy(createdBy)
                .build();

        Form saved = formRepository.save(form);
        log.info("Created form {} for society {}", saved.getId(), societyId);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<FormResponse> list(Long societyId) {
        return formRepository.findBySocietyId(societyId).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<FormResponse> list(Long societyId, Pageable pageable, String search, Long categoryId, Integer year, Boolean isPublic) {
        featureLimitService.assertEnabled(societyId, FeatureKey.FORMS);
        Specification<Form> spec = buildSpecification(societyId, search, categoryId, year, isPublic);
        return PageResponse.of(formRepository.findAll(spec, pageable).map(this::toResponse));
    }

    private Specification<Form> buildSpecification(Long societyId, String search, Long categoryId, Integer year, Boolean isPublic) {
        Specification<Form> spec = (root, query, cb) -> cb.equal(root.get("society").get("id"), societyId);

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
    public FormResponse getById(Long societyId, Long formId) {
        return toResponse(findOwned(societyId, formId));
    }

    @Transactional
    public FormResponse update(Long societyId, Long formId, FormRequest request) {
        Form form = findOwned(societyId, formId);
        Category category = findOwnedCategory(societyId, request.categoryId());

        form.setTitle(request.title());
        form.setCategory(category);
        form.setYear(request.year());
        form.setDescription(request.description());
        form.setPublic(request.isPublic());
        form.setDownloadable(request.downloadable());

        Form updated = formRepository.save(form);
        log.info("Updated form {} for society {}", updated.getId(), societyId);
        return toResponse(updated);
    }

    @Transactional
    public void delete(Long societyId, Long formId) {
        Form form = findOwned(societyId, formId);
        form.getAttachments().forEach(a -> fileStorageService.deleteAfterCommit(a.getFilePath()));
        formRepository.delete(form);
        log.info("Deleted form {} for society {}", formId, societyId);
    }

    @Transactional
    public FormResponse addAttachment(Long societyId, Long formId, MultipartFile file) {
        Form form = findOwned(societyId, formId);
        String path = fileStorageService.storePdfOnly(file, societyId, "forms");

        FormAttachment attachment = FormAttachment.builder()
                .form(form)
                .filePath(path)
                .fileName(file.getOriginalFilename())
                .build();

        form.getAttachments().add(attachment);
        Form updated = formRepository.save(form);
        log.info("Added attachment to form {} for society {}", formId, societyId);
        return toResponse(updated);
    }

    @Transactional
    public FormResponse removeAttachment(Long societyId, Long formId, Long attachmentId) {
        Form form = findOwned(societyId, formId);
        FormAttachment attachment = form.getAttachments().stream()
                .filter(a -> a.getId().equals(attachmentId))
                .findFirst()
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "ATTACHMENT_NOT_FOUND", "Attachment not found"));

        form.getAttachments().remove(attachment);
        fileStorageService.deleteAfterCommit(attachment.getFilePath());
        Form updated = formRepository.save(form);
        log.info("Removed attachment {} from form {} for society {}", attachmentId, formId, societyId);
        return toResponse(updated);
    }

    private Category findOwnedCategory(Long societyId, Long categoryId) {
        Category category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "CATEGORY_NOT_FOUND", "Category not found"));
        if (!category.getSociety().getId().equals(societyId) || category.getType() != CategoryType.FORM) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "INVALID_CATEGORY", "Invalid category for this society/type");
        }
        return category;
    }

    private Form findOwned(Long societyId, Long formId) {
        Form form = formRepository.findById(formId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "FORM_NOT_FOUND", "Form not found"));
        if (!form.getSociety().getId().equals(societyId)) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "FORM_NOT_FOUND", "Form not found");
        }
        return form;
    }

    private FormResponse toResponse(Form form) {
        List<AttachmentResponse> attachments = form.getAttachments().stream()
                .map(a -> new AttachmentResponse(a.getId(), a.getFileName(), a.getFilePath()))
                .toList();

        return new FormResponse(
                form.getId(), form.getTitle(),
                form.getCategory().getId(), form.getCategory().getName(),
                form.getYear(), form.getDescription(),
                form.isPublic(), form.isDownloadable(),
                attachments, form.getCreatedAt()
        );
    }
}
