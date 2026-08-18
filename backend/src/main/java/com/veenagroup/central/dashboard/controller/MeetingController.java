package com.veenagroup.central.dashboard.controller;

import com.veenagroup.central.dashboard.dto.admin.MeetingRequest;
import com.veenagroup.central.dashboard.dto.admin.MeetingResponse;
import com.veenagroup.central.dashboard.entity.enums.MeetingPlatform;
import com.veenagroup.central.dashboard.entity.enums.MeetingStatus;
import com.veenagroup.central.dashboard.security.CurrentUser;
import com.veenagroup.central.dashboard.service.MeetingService;
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

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/admin/meetings")
public class MeetingController {

    private final MeetingService meetingService;
    private final CurrentUser currentUser;

    public MeetingController(MeetingService meetingService, CurrentUser currentUser) {
        this.meetingService = meetingService;
        this.currentUser = currentUser;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<MeetingResponse>> create(@Valid @RequestBody MeetingRequest request) {
        Long societyId = currentUser.requireSocietyId();
        log.info("Creating meeting '{}' for society {}", request.title(), societyId);
        MeetingResponse response = meetingService.create(societyId, currentUser.userId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of("Meeting created successfully", response));
    }

    @GetMapping
    public ApiResponse<PageResponse<MeetingResponse>> list(@RequestParam(defaultValue = "0") int page,
                                                              @RequestParam(defaultValue = "20") int size,
                                                              @RequestParam(required = false) String search,
                                                              @RequestParam(required = false) Long categoryId,
                                                              @RequestParam(required = false) MeetingStatus status,
                                                              @RequestParam(required = false) MeetingPlatform platform) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("id"));
        return ApiResponse.of("Meetings fetched successfully",
                meetingService.list(currentUser.requireSocietyId(), pageable, search, categoryId, status, platform));
    }

    @GetMapping("/upcoming")
    public ApiResponse<List<MeetingResponse>> listUpcoming(@RequestParam(defaultValue = "5") int limit) {
        return ApiResponse.of("Upcoming meetings fetched successfully", meetingService.listUpcoming(currentUser.requireSocietyId(), limit));
    }

    @GetMapping("/{meetingId}")
    public ApiResponse<MeetingResponse> getById(@PathVariable Long meetingId) {
        return ApiResponse.of("Meeting fetched successfully", meetingService.getById(currentUser.requireSocietyId(), meetingId));
    }

    @PutMapping("/{meetingId}")
    public ApiResponse<MeetingResponse> update(@PathVariable Long meetingId, @Valid @RequestBody MeetingRequest request) {
        log.info("Updating meeting {} for society {}", meetingId, currentUser.requireSocietyId());
        return ApiResponse.of("Meeting updated successfully", meetingService.update(currentUser.requireSocietyId(), meetingId, request));
    }

    @PostMapping("/{meetingId}/attachments")
    public ApiResponse<MeetingResponse> addAttachment(@PathVariable Long meetingId, @RequestParam("file") MultipartFile file) {
        log.info("Adding attachment to meeting {} for society {}", meetingId, currentUser.requireSocietyId());
        return ApiResponse.of("Attachment added successfully", meetingService.addAttachment(currentUser.requireSocietyId(), meetingId, file));
    }

    @DeleteMapping("/{meetingId}/attachments/{attachmentId}")
    public ApiResponse<MeetingResponse> removeAttachment(@PathVariable Long meetingId, @PathVariable Long attachmentId) {
        log.info("Removing attachment {} from meeting {} for society {}", attachmentId, meetingId, currentUser.requireSocietyId());
        return ApiResponse.of("Attachment removed successfully", meetingService.removeAttachment(currentUser.requireSocietyId(), meetingId, attachmentId));
    }

    @DeleteMapping("/{meetingId}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long meetingId) {
        log.info("Deleting meeting {} for society {}", meetingId, currentUser.requireSocietyId());
        meetingService.delete(currentUser.requireSocietyId(), meetingId);
        return ResponseEntity.ok(ApiResponse.of("Meeting deleted successfully", null));
    }
}
