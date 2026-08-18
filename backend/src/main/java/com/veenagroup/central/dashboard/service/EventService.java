package com.veenagroup.central.dashboard.service;

import com.veenagroup.central.dashboard.dto.admin.AttachmentResponse;
import com.veenagroup.central.dashboard.dto.admin.EventRequest;
import com.veenagroup.central.dashboard.dto.admin.EventResponse;
import com.veenagroup.central.dashboard.entity.Category;
import com.veenagroup.central.dashboard.entity.Event;
import com.veenagroup.central.dashboard.entity.EventAttachment;
import com.veenagroup.central.dashboard.entity.Society;
import com.veenagroup.central.dashboard.entity.Users;
import com.veenagroup.central.dashboard.entity.enums.CategoryType;
import com.veenagroup.central.dashboard.entity.enums.EventStatus;
import com.veenagroup.central.dashboard.entity.enums.FeatureKey;
import com.veenagroup.central.dashboard.exception.BusinessException;
import com.veenagroup.central.dashboard.repository.CategoryRepository;
import com.veenagroup.central.dashboard.repository.EventRepository;
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
public class EventService {

    private final EventRepository eventRepository;
    private final CategoryRepository categoryRepository;
    private final SocietyRepository societyRepository;
    private final UsersRepository usersRepository;
    private final FeatureLimitService featureLimitService;
    private final FileStorageService fileStorageService;

    public EventService(EventRepository eventRepository,
                         CategoryRepository categoryRepository,
                         SocietyRepository societyRepository,
                         UsersRepository usersRepository,
                         FeatureLimitService featureLimitService,
                         FileStorageService fileStorageService) {
        this.eventRepository = eventRepository;
        this.categoryRepository = categoryRepository;
        this.societyRepository = societyRepository;
        this.usersRepository = usersRepository;
        this.featureLimitService = featureLimitService;
        this.fileStorageService = fileStorageService;
    }

    @Transactional
    public EventResponse create(Long societyId, Long userId, EventRequest request) {
        if (request.endDate() != null && request.endDate().isBefore(request.eventDate())) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "INVALID_DATE_RANGE", "endDate must not be before eventDate");
        }

        featureLimitService.assertCanCreate(societyId, FeatureKey.EVENTS, () -> eventRepository.countBySocietyId(societyId));

        Society society = societyRepository.findById(societyId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "SOCIETY_NOT_FOUND", "Society not found"));
        Category category = findOwnedCategory(societyId, request.categoryId());
        Users createdBy = usersRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "User not found"));

        Event event = Event.builder()
                .society(society)
                .category(category)
                .title(request.title())
                .description(request.description())
                .eventDate(request.eventDate())
                .endDate(request.endDate())
                .startTime(request.startTime())
                .endTime(request.endTime())
                .venue(request.venue())
                .status(request.status())
                .isPublic(request.isPublic())
                .downloadable(request.downloadable())
                .createdBy(createdBy)
                .build();

        Event saved = eventRepository.save(event);
        log.info("Created event {} for society {}", saved.getId(), societyId);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<EventResponse> list(Long societyId) {
        return eventRepository.findBySocietyId(societyId).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<EventResponse> list(Long societyId, Pageable pageable, String search, Long categoryId, EventStatus status) {
        featureLimitService.assertEnabled(societyId, FeatureKey.EVENTS);
        Specification<Event> spec = buildSpecification(societyId, search, categoryId, status);
        return PageResponse.of(eventRepository.findAll(spec, pageable).map(this::toResponse));
    }

    private Specification<Event> buildSpecification(Long societyId, String search, Long categoryId, EventStatus status) {
        Specification<Event> spec = (root, query, cb) -> cb.equal(root.get("society").get("id"), societyId);

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
        return spec;
    }

    @Transactional(readOnly = true)
    public EventResponse getById(Long societyId, Long eventId) {
        return toResponse(findOwned(societyId, eventId));
    }

    @Transactional
    public EventResponse update(Long societyId, Long eventId, EventRequest request) {
        if (request.endDate() != null && request.endDate().isBefore(request.eventDate())) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "INVALID_DATE_RANGE", "endDate must not be before eventDate");
        }

        Event event = findOwned(societyId, eventId);
        Category category = findOwnedCategory(societyId, request.categoryId());

        event.setTitle(request.title());
        event.setCategory(category);
        event.setDescription(request.description());
        event.setEventDate(request.eventDate());
        event.setEndDate(request.endDate());
        event.setStartTime(request.startTime());
        event.setEndTime(request.endTime());
        event.setVenue(request.venue());
        event.setStatus(request.status());
        event.setPublic(request.isPublic());
        event.setDownloadable(request.downloadable());

        Event updated = eventRepository.save(event);
        log.info("Updated event {} for society {}", updated.getId(), societyId);
        return toResponse(updated);
    }

    @Transactional
    public void delete(Long societyId, Long eventId) {
        Event event = findOwned(societyId, eventId);
        if (event.getBannerPath() != null) {
            fileStorageService.deleteAfterCommit(event.getBannerPath());
        }
        event.getAttachments().forEach(a -> fileStorageService.deleteAfterCommit(a.getFilePath()));
        eventRepository.delete(event);
        log.info("Deleted event {} for society {}", eventId, societyId);
    }

    @Transactional
    public EventResponse uploadBanner(Long societyId, Long eventId, MultipartFile file) {
        Event event = findOwned(societyId, eventId);
        if (event.getBannerPath() != null) {
            fileStorageService.deleteAfterCommit(event.getBannerPath());
        }
        String path = fileStorageService.store(file, societyId, "events");
        event.setBannerPath(path);
        Event updated = eventRepository.save(event);
        log.info("Uploaded banner for event {} in society {}", updated.getId(), societyId);
        return toResponse(updated);
    }

    @Transactional
    public EventResponse addAttachment(Long societyId, Long eventId, MultipartFile file) {
        Event event = findOwned(societyId, eventId);
        String path = fileStorageService.storePdfOnly(file, societyId, "events");

        EventAttachment attachment = EventAttachment.builder()
                .event(event)
                .filePath(path)
                .fileName(file.getOriginalFilename())
                .build();

        event.getAttachments().add(attachment);
        Event updated = eventRepository.save(event);
        log.info("Added attachment to event {} for society {}", eventId, societyId);
        return toResponse(updated);
    }

    @Transactional
    public EventResponse removeAttachment(Long societyId, Long eventId, Long attachmentId) {
        Event event = findOwned(societyId, eventId);
        EventAttachment attachment = event.getAttachments().stream()
                .filter(a -> a.getId().equals(attachmentId))
                .findFirst()
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "ATTACHMENT_NOT_FOUND", "Attachment not found"));

        event.getAttachments().remove(attachment);
        fileStorageService.deleteAfterCommit(attachment.getFilePath());
        Event updated = eventRepository.save(event);
        log.info("Removed attachment {} from event {} for society {}", attachmentId, eventId, societyId);
        return toResponse(updated);
    }

    private Category findOwnedCategory(Long societyId, Long categoryId) {
        Category category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "CATEGORY_NOT_FOUND", "Category not found"));
        if (!category.getSociety().getId().equals(societyId) || category.getType() != CategoryType.EVENT) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "INVALID_CATEGORY", "Invalid category for this society/type");
        }
        return category;
    }

    private Event findOwned(Long societyId, Long eventId) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "EVENT_NOT_FOUND", "Event not found"));
        if (!event.getSociety().getId().equals(societyId)) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "EVENT_NOT_FOUND", "Event not found");
        }
        return event;
    }

    private EventResponse toResponse(Event event) {
        List<AttachmentResponse> attachments = event.getAttachments().stream()
                .map(a -> new AttachmentResponse(a.getId(), a.getFileName(), a.getFilePath()))
                .toList();

        return new EventResponse(
                event.getId(), event.getTitle(),
                event.getCategory().getId(), event.getCategory().getName(),
                event.getDescription(), event.getEventDate(), event.getEndDate(),
                event.getStartTime(), event.getEndTime(), event.getVenue(),
                event.getBannerPath(), attachments,
                event.getStatus().name(), event.isPublic(), event.isDownloadable(),
                event.getCreatedAt()
        );
    }
}
