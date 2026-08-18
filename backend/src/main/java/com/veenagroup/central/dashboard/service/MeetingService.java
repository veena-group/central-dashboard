package com.veenagroup.central.dashboard.service;

import com.veenagroup.central.dashboard.dto.admin.AttachmentResponse;
import com.veenagroup.central.dashboard.dto.admin.MeetingRequest;
import com.veenagroup.central.dashboard.dto.admin.MeetingResponse;
import com.veenagroup.central.dashboard.entity.Category;
import com.veenagroup.central.dashboard.entity.Meeting;
import com.veenagroup.central.dashboard.entity.MeetingAttachment;
import com.veenagroup.central.dashboard.entity.Society;
import com.veenagroup.central.dashboard.entity.Users;
import com.veenagroup.central.dashboard.entity.enums.CategoryType;
import com.veenagroup.central.dashboard.entity.enums.FeatureKey;
import com.veenagroup.central.dashboard.entity.enums.MeetingPlatform;
import com.veenagroup.central.dashboard.entity.enums.MeetingStatus;
import com.veenagroup.central.dashboard.exception.BusinessException;
import com.veenagroup.central.dashboard.repository.CategoryRepository;
import com.veenagroup.central.dashboard.repository.MeetingRepository;
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
public class MeetingService {

    private final MeetingRepository meetingRepository;
    private final CategoryRepository categoryRepository;
    private final SocietyRepository societyRepository;
    private final UsersRepository usersRepository;
    private final FeatureLimitService featureLimitService;
    private final FileStorageService fileStorageService;

    public MeetingService(MeetingRepository meetingRepository,
                           CategoryRepository categoryRepository,
                           SocietyRepository societyRepository,
                           UsersRepository usersRepository,
                           FeatureLimitService featureLimitService,
                           FileStorageService fileStorageService) {
        this.meetingRepository = meetingRepository;
        this.categoryRepository = categoryRepository;
        this.societyRepository = societyRepository;
        this.usersRepository = usersRepository;
        this.featureLimitService = featureLimitService;
        this.fileStorageService = fileStorageService;
    }

    @Transactional
    public MeetingResponse create(Long societyId, Long userId, MeetingRequest request) {
        featureLimitService.assertCanCreate(societyId, FeatureKey.MEETINGS, () -> meetingRepository.countBySocietyId(societyId));

        Society society = societyRepository.findById(societyId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "SOCIETY_NOT_FOUND", "Society not found"));
        Category category = findOwnedCategory(societyId, request.categoryId());
        Users createdBy = usersRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "User not found"));

        Meeting meeting = Meeting.builder()
                .society(society)
                .category(category)
                .title(request.title())
                .agenda(request.agenda())
                .meetingDate(request.meetingDate())
                .platform(request.platform())
                .meetingUrl(request.meetingUrl())
                .status(request.status())
                .recordingUrl(request.recordingUrl())
                .isPublic(request.isPublic())
                .downloadable(request.downloadable())
                .createdBy(createdBy)
                .build();

        Meeting saved = meetingRepository.save(meeting);
        log.info("Created meeting {} for society {}", saved.getId(), societyId);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<MeetingResponse> list(Long societyId) {
        return meetingRepository.findBySocietyId(societyId).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<MeetingResponse> list(Long societyId, Pageable pageable, String search, Long categoryId,
                                               MeetingStatus status, MeetingPlatform platform) {
        featureLimitService.assertEnabled(societyId, FeatureKey.MEETINGS);
        Specification<Meeting> spec = buildSpecification(societyId, search, categoryId, status, platform);
        return PageResponse.of(meetingRepository.findAll(spec, pageable).map(this::toResponse));
    }

    private Specification<Meeting> buildSpecification(Long societyId, String search, Long categoryId,
                                                        MeetingStatus status, MeetingPlatform platform) {
        Specification<Meeting> spec = (root, query, cb) -> cb.equal(root.get("society").get("id"), societyId);

        if (search != null && !search.isBlank()) {
            String pattern = "%" + search.trim().toLowerCase() + "%";
            spec = spec.and((root, query, cb) -> cb.like(cb.lower(root.get("title")), pattern));
        }
        if (categoryId != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("category").get("id"), categoryId));
        }
        if (status != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("status"), status));
        }
        if (platform != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("platform"), platform));
        }
        return spec;
    }

    @Transactional(readOnly = true)
    public MeetingResponse getById(Long societyId, Long meetingId) {
        return toResponse(findOwned(societyId, meetingId));
    }

    @Transactional(readOnly = true)
    public List<MeetingResponse> listUpcoming(Long societyId, int limit) {
        return meetingRepository
                .findBySocietyIdAndStatusAndMeetingDateGreaterThanEqualOrderByMeetingDateAsc(
                        societyId, MeetingStatus.UPCOMING, LocalDate.now(), PageRequest.of(0, limit))
                .stream().map(this::toResponse).toList();
    }

    @Transactional
    public MeetingResponse update(Long societyId, Long meetingId, MeetingRequest request) {
        Meeting meeting = findOwned(societyId, meetingId);
        Category category = findOwnedCategory(societyId, request.categoryId());

        meeting.setTitle(request.title());
        meeting.setCategory(category);
        meeting.setAgenda(request.agenda());
        meeting.setMeetingDate(request.meetingDate());
        meeting.setPlatform(request.platform());
        meeting.setMeetingUrl(request.meetingUrl());
        meeting.setStatus(request.status());
        meeting.setRecordingUrl(request.recordingUrl());
        meeting.setPublic(request.isPublic());
        meeting.setDownloadable(request.downloadable());

        Meeting updated = meetingRepository.save(meeting);
        log.info("Updated meeting {} for society {}", updated.getId(), societyId);
        return toResponse(updated);
    }

    @Transactional
    public MeetingResponse addAttachment(Long societyId, Long meetingId, MultipartFile file) {
        Meeting meeting = findOwned(societyId, meetingId);
        String path = fileStorageService.storePdfOnly(file, societyId, "meetings");

        MeetingAttachment attachment = MeetingAttachment.builder()
                .meeting(meeting)
                .filePath(path)
                .fileName(file.getOriginalFilename())
                .build();

        meeting.getAttachments().add(attachment);
        Meeting updated = meetingRepository.save(meeting);
        log.info("Added attachment to meeting {} for society {}", meetingId, societyId);
        return toResponse(updated);
    }

    @Transactional
    public MeetingResponse removeAttachment(Long societyId, Long meetingId, Long attachmentId) {
        Meeting meeting = findOwned(societyId, meetingId);
        MeetingAttachment attachment = meeting.getAttachments().stream()
                .filter(a -> a.getId().equals(attachmentId))
                .findFirst()
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "ATTACHMENT_NOT_FOUND", "Attachment not found"));

        meeting.getAttachments().remove(attachment);
        fileStorageService.deleteAfterCommit(attachment.getFilePath());
        Meeting updated = meetingRepository.save(meeting);
        log.info("Removed attachment {} from meeting {} for society {}", attachmentId, meetingId, societyId);
        return toResponse(updated);
    }

    @Transactional
    public void delete(Long societyId, Long meetingId) {
        Meeting meeting = findOwned(societyId, meetingId);
        meeting.getAttachments().forEach(a -> fileStorageService.deleteAfterCommit(a.getFilePath()));
        meetingRepository.delete(meeting);
        log.info("Deleted meeting {} for society {}", meetingId, societyId);
    }

    private Category findOwnedCategory(Long societyId, Long categoryId) {
        Category category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "CATEGORY_NOT_FOUND", "Category not found"));
        if (!category.getSociety().getId().equals(societyId) || category.getType() != CategoryType.MEETING) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "INVALID_CATEGORY", "Invalid category for this society/type");
        }
        return category;
    }

    private Meeting findOwned(Long societyId, Long meetingId) {
        Meeting meeting = meetingRepository.findById(meetingId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "MEETING_NOT_FOUND", "Meeting not found"));
        if (!meeting.getSociety().getId().equals(societyId)) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "MEETING_NOT_FOUND", "Meeting not found");
        }
        return meeting;
    }

    private MeetingResponse toResponse(Meeting meeting) {
        List<AttachmentResponse> attachments = meeting.getAttachments().stream()
                .map(a -> new AttachmentResponse(a.getId(), a.getFileName(), a.getFilePath()))
                .toList();

        return new MeetingResponse(
                meeting.getId(), meeting.getTitle(),
                meeting.getCategory().getId(), meeting.getCategory().getName(),
                meeting.getAgenda(), meeting.getMeetingDate(), attachments,
                meeting.getPlatform() != null ? meeting.getPlatform().name() : null,
                meeting.getMeetingUrl(),
                meeting.getStatus().name(),
                meeting.getRecordingUrl(),
                meeting.isPublic(), meeting.isDownloadable(), meeting.getCreatedAt()
        );
    }
}
