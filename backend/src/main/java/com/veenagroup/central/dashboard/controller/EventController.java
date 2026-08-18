package com.veenagroup.central.dashboard.controller;

import com.veenagroup.central.dashboard.dto.admin.EventRequest;
import com.veenagroup.central.dashboard.dto.admin.EventResponse;
import com.veenagroup.central.dashboard.entity.enums.EventStatus;
import com.veenagroup.central.dashboard.security.CurrentUser;
import com.veenagroup.central.dashboard.service.EventService;
import com.veenagroup.central.dashboard.web.ApiResponse;
import com.veenagroup.central.dashboard.web.PageResponse;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@Slf4j
@RestController
@RequestMapping("/api/admin/events")
public class EventController {

    private final EventService eventService;
    private final CurrentUser currentUser;

    public EventController(EventService eventService, CurrentUser currentUser) {
        this.eventService = eventService;
        this.currentUser = currentUser;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<EventResponse>> create(@Valid @RequestBody EventRequest request) {
        Long societyId = currentUser.requireSocietyId();
        log.info("Creating event '{}' for society {}", request.title(), societyId);
        EventResponse response = eventService.create(societyId, currentUser.userId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of("Event created successfully", response));
    }

    @GetMapping
    public ApiResponse<PageResponse<EventResponse>> list(@RequestParam(defaultValue = "0") int page,
                                                            @RequestParam(defaultValue = "20") int size,
                                                            @RequestParam(required = false) String search,
                                                            @RequestParam(required = false) Long categoryId,
                                                            @RequestParam(required = false) EventStatus status) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("id"));
        return ApiResponse.of("Events fetched successfully",
                eventService.list(currentUser.requireSocietyId(), pageable, search, categoryId, status));
    }

    @GetMapping("/{eventId}")
    public ApiResponse<EventResponse> getById(@PathVariable Long eventId) {
        return ApiResponse.of("Event fetched successfully", eventService.getById(currentUser.requireSocietyId(), eventId));
    }

    @PutMapping("/{eventId}")
    public ApiResponse<EventResponse> update(@PathVariable Long eventId, @Valid @RequestBody EventRequest request) {
        log.info("Updating event {} for society {}", eventId, currentUser.requireSocietyId());
        return ApiResponse.of("Event updated successfully", eventService.update(currentUser.requireSocietyId(), eventId, request));
    }

    @DeleteMapping("/{eventId}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long eventId) {
        log.info("Deleting event {} for society {}", eventId, currentUser.requireSocietyId());
        eventService.delete(currentUser.requireSocietyId(), eventId);
        return ResponseEntity.ok(ApiResponse.of("Event deleted successfully", null));
    }

    @PostMapping("/{eventId}/banner")
    public ApiResponse<EventResponse> uploadBanner(@PathVariable Long eventId, @RequestParam("file") MultipartFile file) {
        log.info("Uploading banner for event {} for society {}", eventId, currentUser.requireSocietyId());
        return ApiResponse.of("Banner uploaded successfully", eventService.uploadBanner(currentUser.requireSocietyId(), eventId, file));
    }

    @PostMapping("/{eventId}/attachments")
    public ApiResponse<EventResponse> addAttachment(@PathVariable Long eventId, @RequestParam("file") MultipartFile file) {
        log.info("Adding attachment to event {} for society {}", eventId, currentUser.requireSocietyId());
        return ApiResponse.of("Attachment added successfully", eventService.addAttachment(currentUser.requireSocietyId(), eventId, file));
    }

    @DeleteMapping("/{eventId}/attachments/{attachmentId}")
    public ApiResponse<EventResponse> removeAttachment(@PathVariable Long eventId, @PathVariable Long attachmentId) {
        log.info("Removing attachment {} from event {} for society {}", attachmentId, eventId, currentUser.requireSocietyId());
        return ApiResponse.of("Attachment removed successfully", eventService.removeAttachment(currentUser.requireSocietyId(), eventId, attachmentId));
    }
}
