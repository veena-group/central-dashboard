package com.veenagroup.central.dashboard.controller;

import com.veenagroup.central.dashboard.dto.admin.CommitteeRequest;
import com.veenagroup.central.dashboard.dto.admin.CommitteeResponse;
import com.veenagroup.central.dashboard.security.CurrentUser;
import com.veenagroup.central.dashboard.service.CommitteeService;
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
@RequestMapping("/api/admin/committee")
public class CommitteeController {

    private final CommitteeService committeeService;
    private final CurrentUser currentUser;

    public CommitteeController(CommitteeService committeeService, CurrentUser currentUser) {
        this.committeeService = committeeService;
        this.currentUser = currentUser;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<CommitteeResponse>> create(@Valid @RequestBody CommitteeRequest request) {
        Long societyId = currentUser.requireSocietyId();
        log.info("Creating committee member '{}' for society {}", request.name(), societyId);
        CommitteeResponse response = committeeService.create(societyId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of("Committee member created successfully", response));
    }

    @GetMapping
    public ApiResponse<PageResponse<CommitteeResponse>> list(@RequestParam(defaultValue = "0") int page,
                                                                @RequestParam(defaultValue = "20") int size,
                                                                @RequestParam(required = false) String search) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("id"));
        return ApiResponse.of("Committee members fetched successfully",
                committeeService.list(currentUser.requireSocietyId(), pageable, search));
    }

    @GetMapping("/{committeeId}")
    public ApiResponse<CommitteeResponse> getById(@PathVariable Long committeeId) {
        return ApiResponse.of("Committee member fetched successfully", committeeService.getById(currentUser.requireSocietyId(), committeeId));
    }

    @PutMapping("/{committeeId}")
    public ApiResponse<CommitteeResponse> update(@PathVariable Long committeeId, @Valid @RequestBody CommitteeRequest request) {
        log.info("Updating committee member {} for society {}", committeeId, currentUser.requireSocietyId());
        return ApiResponse.of("Committee member updated successfully", committeeService.update(currentUser.requireSocietyId(), committeeId, request));
    }

    @PostMapping("/{committeeId}/photo")
    public ApiResponse<CommitteeResponse> uploadPhoto(@PathVariable Long committeeId, @RequestParam("file") MultipartFile file) {
        log.info("Uploading photo for committee member {}", committeeId);
        return ApiResponse.of("Photo uploaded successfully", committeeService.uploadPhoto(currentUser.requireSocietyId(), committeeId, file));
    }

    @DeleteMapping("/{committeeId}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long committeeId) {
        log.info("Deleting committee member {} for society {}", committeeId, currentUser.requireSocietyId());
        committeeService.delete(currentUser.requireSocietyId(), committeeId);
        return ResponseEntity.ok(ApiResponse.of("Committee member deleted successfully", null));
    }
}
