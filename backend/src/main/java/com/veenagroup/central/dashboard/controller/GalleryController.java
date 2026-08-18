package com.veenagroup.central.dashboard.controller;

import com.veenagroup.central.dashboard.dto.admin.GalleryResponse;
import com.veenagroup.central.dashboard.dto.admin.GalleryUpdateRequest;
import com.veenagroup.central.dashboard.security.CurrentUser;
import com.veenagroup.central.dashboard.service.GalleryService;
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
@RequestMapping("/api/admin/gallery")
public class GalleryController {

    private final GalleryService galleryService;
    private final CurrentUser currentUser;

    public GalleryController(GalleryService galleryService, CurrentUser currentUser) {
        this.galleryService = galleryService;
        this.currentUser = currentUser;
    }

    @PostMapping(consumes = "multipart/form-data")
    public ResponseEntity<ApiResponse<GalleryResponse>> create(@RequestParam Long albumId,
                                                   @RequestParam(required = false) String title,
                                                   @RequestParam(required = false) String description,
                                                   @RequestParam(defaultValue = "false") boolean isPublic,
                                                   @RequestParam(defaultValue = "false") boolean downloadable,
                                                   @RequestParam("file") MultipartFile file) {
        Long societyId = currentUser.requireSocietyId();
        log.info("Adding gallery image to album {} for society {}", albumId, societyId);
        GalleryResponse response = galleryService.create(
                societyId, currentUser.userId(), albumId, title, description, isPublic, downloadable, file);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of("Gallery item created successfully", response));
    }

    @GetMapping
    public ApiResponse<PageResponse<GalleryResponse>> list(@RequestParam(defaultValue = "0") int page,
                                                              @RequestParam(defaultValue = "20") int size,
                                                              @RequestParam(required = false) Long albumId) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("id"));
        return ApiResponse.of("Gallery items fetched successfully",
                galleryService.list(currentUser.requireSocietyId(), pageable, albumId));
    }

    @GetMapping("/{galleryId}")
    public ApiResponse<GalleryResponse> getById(@PathVariable Long galleryId) {
        return ApiResponse.of("Gallery item fetched successfully", galleryService.getById(currentUser.requireSocietyId(), galleryId));
    }

    @PutMapping("/{galleryId}")
    public ApiResponse<GalleryResponse> update(@PathVariable Long galleryId, @Valid @RequestBody GalleryUpdateRequest request) {
        log.info("Updating gallery item {} for society {}", galleryId, currentUser.requireSocietyId());
        return ApiResponse.of("Gallery item updated successfully", galleryService.update(currentUser.requireSocietyId(), galleryId, request));
    }

    @PutMapping("/{galleryId}/image")
    public ApiResponse<GalleryResponse> replaceImage(@PathVariable Long galleryId, @RequestParam("file") MultipartFile file) {
        log.info("Replacing image for gallery item {}", galleryId);
        return ApiResponse.of("Image replaced successfully", galleryService.replaceImage(currentUser.requireSocietyId(), galleryId, file));
    }

    @DeleteMapping("/{galleryId}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long galleryId) {
        log.info("Deleting gallery item {} for society {}", galleryId, currentUser.requireSocietyId());
        galleryService.delete(currentUser.requireSocietyId(), galleryId);
        return ResponseEntity.ok(ApiResponse.of("Gallery item deleted successfully", null));
    }
}
