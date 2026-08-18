package com.veenagroup.central.dashboard.service;

import com.veenagroup.central.dashboard.dto.admin.AttachmentResponse;
import com.veenagroup.central.dashboard.dto.admin.NoticeRequest;
import com.veenagroup.central.dashboard.dto.admin.NoticeResponse;
import com.veenagroup.central.dashboard.entity.Category;
import com.veenagroup.central.dashboard.entity.Notice;
import com.veenagroup.central.dashboard.entity.NoticeAttachment;
import com.veenagroup.central.dashboard.entity.Society;
import com.veenagroup.central.dashboard.entity.Users;
import com.veenagroup.central.dashboard.entity.enums.CategoryType;
import com.veenagroup.central.dashboard.entity.enums.FeatureKey;
import com.veenagroup.central.dashboard.exception.BusinessException;
import com.veenagroup.central.dashboard.repository.CategoryRepository;
import com.veenagroup.central.dashboard.repository.NoticeRepository;
import com.veenagroup.central.dashboard.repository.SocietyRepository;
import com.veenagroup.central.dashboard.repository.UsersRepository;
import com.veenagroup.central.dashboard.storage.FileStorageService;
import com.veenagroup.central.dashboard.web.PageResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.List;

@Slf4j
@Service
public class NoticeService {

    private final NoticeRepository noticeRepository;
    private final CategoryRepository categoryRepository;
    private final SocietyRepository societyRepository;
    private final UsersRepository usersRepository;
    private final FeatureLimitService featureLimitService;
    private final FileStorageService fileStorageService;

    public NoticeService(NoticeRepository noticeRepository,
                          CategoryRepository categoryRepository,
                          SocietyRepository societyRepository,
                          UsersRepository usersRepository,
                          FeatureLimitService featureLimitService,
                          FileStorageService fileStorageService) {
        this.noticeRepository = noticeRepository;
        this.categoryRepository = categoryRepository;
        this.societyRepository = societyRepository;
        this.usersRepository = usersRepository;
        this.featureLimitService = featureLimitService;
        this.fileStorageService = fileStorageService;
    }

    @Transactional
    public NoticeResponse create(Long societyId, Long userId, NoticeRequest request) {
        if (request.expireOn().isBefore(request.publishOn())) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "INVALID_DATE_RANGE", "expireOn must not be before publishOn");
        }

        featureLimitService.assertCanCreate(societyId, FeatureKey.NOTICES, () -> noticeRepository.countBySocietyId(societyId));

        Society society = societyRepository.findById(societyId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "SOCIETY_NOT_FOUND", "Society not found"));
        Category category = findOwnedCategory(societyId, request.categoryId(), CategoryType.NOTICE);
        Users createdBy = usersRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "User not found"));

        Notice notice = Notice.builder()
                .society(society)
                .category(category)
                .title(request.title())
                .body(request.body())
                .publishOn(request.publishOn())
                .expireOn(request.expireOn())
                .isPublic(request.isPublic())
                .downloadable(request.downloadable())
                .createdBy(createdBy)
                .build();

        Notice saved = noticeRepository.save(notice);
        log.info("Created notice {} for society {}", saved.getId(), societyId);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<NoticeResponse> list(Long societyId) {
        return noticeRepository.findBySocietyId(societyId).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<NoticeResponse> list(Long societyId, Pageable pageable, String search, Long categoryId, Boolean isPublic) {
        featureLimitService.assertEnabled(societyId, FeatureKey.NOTICES);
        Specification<Notice> spec = buildSpecification(societyId, search, categoryId, isPublic);
        return PageResponse.of(noticeRepository.findAll(spec, pageable).map(this::toResponse));
    }

    private Specification<Notice> buildSpecification(Long societyId, String search, Long categoryId, Boolean isPublic) {
        Specification<Notice> spec = (root, query, cb) -> cb.equal(root.get("society").get("id"), societyId);

        if (search != null && !search.isBlank()) {
            String pattern = "%" + search.trim().toLowerCase() + "%";
            spec = spec.and((root, query, cb) -> cb.like(cb.lower(root.get("title")), pattern));
        }
        if (categoryId != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("category").get("id"), categoryId));
        }
        if (isPublic != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("isPublic"), isPublic));
        }
        return spec;
    }

    @Transactional(readOnly = true)
    public NoticeResponse getById(Long societyId, Long noticeId) {
        return toResponse(findOwned(societyId, noticeId));
    }

    @Transactional(readOnly = true)
    public List<NoticeResponse> listRecent(Long societyId, int limit) {
        LocalDate today = LocalDate.now();
        return noticeRepository
                .findBySocietyIdAndPublishOnLessThanEqualAndExpireOnGreaterThanEqualOrderByPublishOnDesc(
                        societyId, today, today, PageRequest.of(0, limit))
                .stream().map(this::toResponse).toList();
    }

    @Transactional
    public NoticeResponse update(Long societyId, Long noticeId, NoticeRequest request) {
        if (request.expireOn().isBefore(request.publishOn())) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "INVALID_DATE_RANGE", "expireOn must not be before publishOn");
        }

        Notice notice = findOwned(societyId, noticeId);
        Category category = findOwnedCategory(societyId, request.categoryId(), CategoryType.NOTICE);

        notice.setTitle(request.title());
        notice.setBody(request.body());
        notice.setCategory(category);
        notice.setPublishOn(request.publishOn());
        notice.setExpireOn(request.expireOn());
        notice.setPublic(request.isPublic());
        notice.setDownloadable(request.downloadable());

        Notice updated = noticeRepository.save(notice);
        log.info("Updated notice {} for society {}", updated.getId(), societyId);
        return toResponse(updated);
    }

    @Transactional
    public void delete(Long societyId, Long noticeId) {
        Notice notice = findOwned(societyId, noticeId);
        notice.getAttachments().forEach(a -> fileStorageService.deleteAfterCommit(a.getFilePath()));
        noticeRepository.delete(notice);
        log.info("Deleted notice {} for society {}", noticeId, societyId);
    }

    @Transactional
    public NoticeResponse addAttachment(Long societyId, Long noticeId, MultipartFile file) {
        Notice notice = findOwned(societyId, noticeId);
        String path = fileStorageService.storePdfOnly(file, societyId, "notices");

        NoticeAttachment attachment = NoticeAttachment.builder()
                .notice(notice)
                .filePath(path)
                .fileName(file.getOriginalFilename())
                .build();

        notice.getAttachments().add(attachment);
        Notice updated = noticeRepository.save(notice);
        log.info("Added attachment to notice {} for society {}", noticeId, societyId);
        return toResponse(updated);
    }

    @Transactional
    public NoticeResponse removeAttachment(Long societyId, Long noticeId, Long attachmentId) {
        Notice notice = findOwned(societyId, noticeId);
        NoticeAttachment attachment = notice.getAttachments().stream()
                .filter(a -> a.getId().equals(attachmentId))
                .findFirst()
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "ATTACHMENT_NOT_FOUND", "Attachment not found"));

        notice.getAttachments().remove(attachment);
        fileStorageService.deleteAfterCommit(attachment.getFilePath());
        Notice updated = noticeRepository.save(notice);
        log.info("Removed attachment {} from notice {} for society {}", attachmentId, noticeId, societyId);
        return toResponse(updated);
    }

    private Category findOwnedCategory(Long societyId, Long categoryId, CategoryType expectedType) {
        Category category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "CATEGORY_NOT_FOUND", "Category not found"));
        if (!category.getSociety().getId().equals(societyId) || category.getType() != expectedType) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "INVALID_CATEGORY", "Invalid category for this society/type");
        }
        return category;
    }

    private Notice findOwned(Long societyId, Long noticeId) {
        Notice notice = noticeRepository.findById(noticeId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "NOTICE_NOT_FOUND", "Notice not found"));
        if (!notice.getSociety().getId().equals(societyId)) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "NOTICE_NOT_FOUND", "Notice not found");
        }
        return notice;
    }

    private NoticeResponse toResponse(Notice notice) {
        List<AttachmentResponse> attachments = notice.getAttachments().stream()
                .map(a -> new AttachmentResponse(a.getId(), a.getFileName(), a.getFilePath()))
                .toList();

        return new NoticeResponse(
                notice.getId(), notice.getTitle(), notice.getBody(),
                notice.getCategory().getId(), notice.getCategory().getName(),
                notice.getPublishOn(), notice.getExpireOn(),
                notice.isPublic(), notice.isDownloadable(),
                attachments, notice.getCreatedAt()
        );
    }
}
