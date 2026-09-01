package com.veenagroup.central.dashboard.controller;

import com.veenagroup.central.dashboard.dto.admin.BulkDeleteRequest;
import com.veenagroup.central.dashboard.dto.admin.BulkDeleteResponse;
import com.veenagroup.central.dashboard.dto.admin.BulkDeleteResult;
import com.veenagroup.central.dashboard.dto.admin.CommitteeRequest;
import com.veenagroup.central.dashboard.dto.admin.CommitteeResponse;
import com.veenagroup.central.dashboard.exception.BusinessException;
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

import java.util.ArrayList;
import java.util.List;

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
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
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

    @PostMapping("/bulk-delete")
    public ApiResponse<BulkDeleteResponse> bulkDelete(@Valid @RequestBody BulkDeleteRequest request) {
        Long societyId = currentUser.requireSocietyId();
        List<Long> ids = request.ids();
        log.info("Bulk-deleting {} committee members for society {}", ids.size(), societyId);

        List<BulkDeleteResult> results = new ArrayList<>(ids.size());
        int successCount = 0;

        for (Long committeeId : ids) {
            try {
                BulkDeleteResult result = committeeService.deleteOneForBulk(societyId, committeeId);
                results.add(result);
                if (result.success()) {
                    successCount++;
                }
            } catch (BusinessException e) {
                results.add(new BulkDeleteResult(committeeId, false, e.getMessage()));
            }
        }

        BulkDeleteResponse response = new BulkDeleteResponse(ids.size(), successCount, ids.size() - successCount, results);
        log.info("Bulk committee delete for society {}: {} succeeded, {} failed", societyId, successCount, response.failureCount());
        return ApiResponse.of("Bulk delete completed: %d of %d committee members deleted".formatted(successCount, ids.size()), response);
    }
}
