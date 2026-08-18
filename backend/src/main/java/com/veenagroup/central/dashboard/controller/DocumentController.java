package com.veenagroup.central.dashboard.controller;

import com.veenagroup.central.dashboard.dto.admin.DocumentRequest;
import com.veenagroup.central.dashboard.dto.admin.DocumentResponse;
import com.veenagroup.central.dashboard.security.CurrentUser;
import com.veenagroup.central.dashboard.service.DocumentService;
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
@RequestMapping("/api/admin/documents")
public class DocumentController {

    private final DocumentService documentService;
    private final CurrentUser currentUser;

    public DocumentController(DocumentService documentService, CurrentUser currentUser) {
        this.documentService = documentService;
        this.currentUser = currentUser;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<DocumentResponse>> create(@Valid @RequestBody DocumentRequest request) {
        Long societyId = currentUser.requireSocietyId();
        log.info("Creating document '{}' for society {}", request.title(), societyId);
        DocumentResponse response = documentService.create(societyId, currentUser.userId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of("Document created successfully", response));
    }

    @GetMapping
    public ApiResponse<PageResponse<DocumentResponse>> list(@RequestParam(defaultValue = "0") int page,
                                                               @RequestParam(defaultValue = "20") int size,
                                                               @RequestParam(required = false) String search,
                                                               @RequestParam(required = false) Long categoryId,
                                                               @RequestParam(required = false) Integer year,
                                                               @RequestParam(required = false) Boolean isPublic) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("id"));
        return ApiResponse.of("Documents fetched successfully",
                documentService.list(currentUser.requireSocietyId(), pageable, search, categoryId, year, isPublic));
    }

    @GetMapping("/{documentId}")
    public ApiResponse<DocumentResponse> getById(@PathVariable Long documentId) {
        return ApiResponse.of("Document fetched successfully", documentService.getById(currentUser.requireSocietyId(), documentId));
    }

    @PutMapping("/{documentId}")
    public ApiResponse<DocumentResponse> update(@PathVariable Long documentId, @Valid @RequestBody DocumentRequest request) {
        log.info("Updating document {} for society {}", documentId, currentUser.requireSocietyId());
        return ApiResponse.of("Document updated successfully", documentService.update(currentUser.requireSocietyId(), documentId, request));
    }

    @DeleteMapping("/{documentId}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long documentId) {
        log.info("Deleting document {} for society {}", documentId, currentUser.requireSocietyId());
        documentService.delete(currentUser.requireSocietyId(), documentId);
        return ResponseEntity.ok(ApiResponse.of("Document deleted successfully", null));
    }

    @PostMapping("/{documentId}/attachments")
    public ApiResponse<DocumentResponse> addAttachment(@PathVariable Long documentId, @RequestParam("file") MultipartFile file) {
        log.info("Adding attachment to document {} for society {}", documentId, currentUser.requireSocietyId());
        return ApiResponse.of("Attachment added successfully", documentService.addAttachment(currentUser.requireSocietyId(), documentId, file));
    }

    @DeleteMapping("/{documentId}/attachments/{attachmentId}")
    public ApiResponse<DocumentResponse> removeAttachment(@PathVariable Long documentId, @PathVariable Long attachmentId) {
        log.info("Removing attachment {} from document {} for society {}", attachmentId, documentId, currentUser.requireSocietyId());
        return ApiResponse.of("Attachment removed successfully", documentService.removeAttachment(currentUser.requireSocietyId(), documentId, attachmentId));
    }
}
