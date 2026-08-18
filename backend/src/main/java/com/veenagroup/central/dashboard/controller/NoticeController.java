package com.veenagroup.central.dashboard.controller;

import com.veenagroup.central.dashboard.dto.admin.NoticeRequest;
import com.veenagroup.central.dashboard.dto.admin.NoticeResponse;
import com.veenagroup.central.dashboard.security.CurrentUser;
import com.veenagroup.central.dashboard.service.NoticeService;
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
@RequestMapping("/api/admin/notices")
public class NoticeController {

    private final NoticeService noticeService;
    private final CurrentUser currentUser;

    public NoticeController(NoticeService noticeService, CurrentUser currentUser) {
        this.noticeService = noticeService;
        this.currentUser = currentUser;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<NoticeResponse>> create(@Valid @RequestBody NoticeRequest request) {
        Long societyId = currentUser.requireSocietyId();
        log.info("Creating notice '{}' for society {}", request.title(), societyId);
        NoticeResponse response = noticeService.create(societyId, currentUser.userId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of("Notice created successfully", response));
    }

    @GetMapping
    public ApiResponse<PageResponse<NoticeResponse>> list(@RequestParam(defaultValue = "0") int page,
                                                             @RequestParam(defaultValue = "20") int size,
                                                             @RequestParam(required = false) String search,
                                                             @RequestParam(required = false) Long categoryId,
                                                             @RequestParam(required = false) Boolean isPublic) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("id"));
        return ApiResponse.of("Notices fetched successfully",
                noticeService.list(currentUser.requireSocietyId(), pageable, search, categoryId, isPublic));
    }

    @GetMapping("/recent")
    public ApiResponse<List<NoticeResponse>> listRecent(@RequestParam(defaultValue = "5") int limit) {
        return ApiResponse.of("Recent notices fetched successfully", noticeService.listRecent(currentUser.requireSocietyId(), limit));
    }

    @GetMapping("/{noticeId}")
    public ApiResponse<NoticeResponse> getById(@PathVariable Long noticeId) {
        return ApiResponse.of("Notice fetched successfully", noticeService.getById(currentUser.requireSocietyId(), noticeId));
    }

    @PutMapping("/{noticeId}")
    public ApiResponse<NoticeResponse> update(@PathVariable Long noticeId, @Valid @RequestBody NoticeRequest request) {
        log.info("Updating notice {} for society {}", noticeId, currentUser.requireSocietyId());
        return ApiResponse.of("Notice updated successfully", noticeService.update(currentUser.requireSocietyId(), noticeId, request));
    }

    @DeleteMapping("/{noticeId}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long noticeId) {
        log.info("Deleting notice {} for society {}", noticeId, currentUser.requireSocietyId());
        noticeService.delete(currentUser.requireSocietyId(), noticeId);
        return ResponseEntity.ok(ApiResponse.of("Notice deleted successfully", null));
    }

    @PostMapping("/{noticeId}/attachments")
    public ApiResponse<NoticeResponse> addAttachment(@PathVariable Long noticeId, @RequestParam("file") MultipartFile file) {
        log.info("Adding attachment to notice {} for society {}", noticeId, currentUser.requireSocietyId());
        return ApiResponse.of("Attachment added successfully", noticeService.addAttachment(currentUser.requireSocietyId(), noticeId, file));
    }

    @DeleteMapping("/{noticeId}/attachments/{attachmentId}")
    public ApiResponse<NoticeResponse> removeAttachment(@PathVariable Long noticeId, @PathVariable Long attachmentId) {
        log.info("Removing attachment {} from notice {} for society {}", attachmentId, noticeId, currentUser.requireSocietyId());
        return ApiResponse.of("Attachment removed successfully", noticeService.removeAttachment(currentUser.requireSocietyId(), noticeId, attachmentId));
    }
}
