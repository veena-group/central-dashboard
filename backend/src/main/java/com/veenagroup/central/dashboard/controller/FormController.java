package com.veenagroup.central.dashboard.controller;

import com.veenagroup.central.dashboard.dto.admin.FormRequest;
import com.veenagroup.central.dashboard.dto.admin.FormResponse;
import com.veenagroup.central.dashboard.security.CurrentUser;
import com.veenagroup.central.dashboard.service.FormService;
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
@RequestMapping("/api/admin/forms")
public class FormController {

    private final FormService formService;
    private final CurrentUser currentUser;

    public FormController(FormService formService, CurrentUser currentUser) {
        this.formService = formService;
        this.currentUser = currentUser;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<FormResponse>> create(@Valid @RequestBody FormRequest request) {
        Long societyId = currentUser.requireSocietyId();
        log.info("Creating form '{}' for society {}", request.title(), societyId);
        FormResponse response = formService.create(societyId, currentUser.userId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of("Form created successfully", response));
    }

    @GetMapping
    public ApiResponse<PageResponse<FormResponse>> list(@RequestParam(defaultValue = "0") int page,
                                                           @RequestParam(defaultValue = "20") int size,
                                                           @RequestParam(required = false) String search,
                                                           @RequestParam(required = false) Long categoryId,
                                                           @RequestParam(required = false) Integer year,
                                                           @RequestParam(required = false) Boolean isPublic) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("id"));
        return ApiResponse.of("Forms fetched successfully",
                formService.list(currentUser.requireSocietyId(), pageable, search, categoryId, year, isPublic));
    }

    @GetMapping("/{formId}")
    public ApiResponse<FormResponse> getById(@PathVariable Long formId) {
        return ApiResponse.of("Form fetched successfully", formService.getById(currentUser.requireSocietyId(), formId));
    }

    @PutMapping("/{formId}")
    public ApiResponse<FormResponse> update(@PathVariable Long formId, @Valid @RequestBody FormRequest request) {
        log.info("Updating form {} for society {}", formId, currentUser.requireSocietyId());
        return ApiResponse.of("Form updated successfully", formService.update(currentUser.requireSocietyId(), formId, request));
    }

    @DeleteMapping("/{formId}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long formId) {
        log.info("Deleting form {} for society {}", formId, currentUser.requireSocietyId());
        formService.delete(currentUser.requireSocietyId(), formId);
        return ResponseEntity.ok(ApiResponse.of("Form deleted successfully", null));
    }

    @PostMapping("/{formId}/attachments")
    public ApiResponse<FormResponse> addAttachment(@PathVariable Long formId, @RequestParam("file") MultipartFile file) {
        log.info("Adding attachment to form {} for society {}", formId, currentUser.requireSocietyId());
        return ApiResponse.of("Attachment added successfully", formService.addAttachment(currentUser.requireSocietyId(), formId, file));
    }

    @DeleteMapping("/{formId}/attachments/{attachmentId}")
    public ApiResponse<FormResponse> removeAttachment(@PathVariable Long formId, @PathVariable Long attachmentId) {
        log.info("Removing attachment {} from form {} for society {}", attachmentId, formId, currentUser.requireSocietyId());
        return ApiResponse.of("Attachment removed successfully", formService.removeAttachment(currentUser.requireSocietyId(), formId, attachmentId));
    }
}
