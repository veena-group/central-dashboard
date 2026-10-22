package com.veenagroup.central.dashboard.controller;

import com.veenagroup.central.dashboard.dto.admin.BulkCreateMembersRequest;
import com.veenagroup.central.dashboard.dto.admin.BulkCreateMembersResponse;
import com.veenagroup.central.dashboard.dto.admin.BulkDeleteRequest;
import com.veenagroup.central.dashboard.dto.admin.BulkDeleteResponse;
import com.veenagroup.central.dashboard.dto.admin.BulkDeleteResult;
import com.veenagroup.central.dashboard.dto.admin.BulkMemberRowResult;
import com.veenagroup.central.dashboard.dto.admin.CheckEmailsRequest;
import com.veenagroup.central.dashboard.dto.admin.CheckEmailsResponse;
import com.veenagroup.central.dashboard.dto.admin.CheckPhonesRequest;
import com.veenagroup.central.dashboard.dto.admin.CheckPhonesResponse;
import com.veenagroup.central.dashboard.dto.admin.CreateMemberRequest;
import com.veenagroup.central.dashboard.dto.admin.MemberResponse;
import com.veenagroup.central.dashboard.dto.admin.UpdateMemberRequest;
import com.veenagroup.central.dashboard.entity.enums.Role;
import com.veenagroup.central.dashboard.exception.BusinessException;
import com.veenagroup.central.dashboard.security.CurrentUser;
import com.veenagroup.central.dashboard.service.MemberService;
import com.veenagroup.central.dashboard.web.ApiResponse;
import com.veenagroup.central.dashboard.web.PageResponse;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Valid;
import jakarta.validation.Validator;
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
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/admin/members")
public class MemberController {

    private final MemberService memberService;
    private final CurrentUser currentUser;
    private final Validator validator;

    public MemberController(MemberService memberService, CurrentUser currentUser, Validator validator) {
        this.memberService = memberService;
        this.currentUser = currentUser;
        this.validator = validator;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<MemberResponse>> create(@Valid @RequestBody CreateMemberRequest request) {
        Long societyId = currentUser.requireSocietyId();
        log.info("Creating member for society {}", societyId);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of("Member created successfully", memberService.create(societyId, request)));
    }

    @PostMapping("/bulk")
    public ApiResponse<BulkCreateMembersResponse> bulkCreate(@Valid @RequestBody BulkCreateMembersRequest request) {
        Long societyId = currentUser.requireSocietyId();
        List<CreateMemberRequest> rows = request.members();
        log.info("Bulk-creating {} members for society {}", rows.size(), societyId);

        List<BulkMemberRowResult> results = new ArrayList<>(rows.size());
        int successCount = 0;

        for (int i = 0; i < rows.size(); i++) {
            int rowNumber = i + 1;
            CreateMemberRequest row = rows.get(i);

            Set<ConstraintViolation<CreateMemberRequest>> violations = validator.validate(row);
            if (!violations.isEmpty()) {
                String message = violations.stream().map(ConstraintViolation::getMessage).distinct().collect(Collectors.joining("; "));
                results.add(new BulkMemberRowResult(rowNumber, row.name(), row.email(), row.phone(), false, message, null));
                continue;
            }

            try {
                MemberResponse created = memberService.create(societyId, row);
                results.add(new BulkMemberRowResult(rowNumber, row.name(), row.email(), row.phone(), true, "Member created successfully", created.id()));
                successCount++;
            } catch (BusinessException e) {
                results.add(new BulkMemberRowResult(rowNumber, row.name(), row.email(), row.phone(), false, e.getMessage(), null));
            }
        }

        BulkCreateMembersResponse response = new BulkCreateMembersResponse(rows.size(), successCount, rows.size() - successCount, results);
        log.info("Bulk member import for society {}: {} succeeded, {} failed", societyId, successCount, response.failureCount());
        return ApiResponse.of("Bulk import completed: %d of %d members created".formatted(successCount, rows.size()), response);
    }

    @PostMapping("/check-emails")
    public ApiResponse<CheckEmailsResponse> checkEmails(@Valid @RequestBody CheckEmailsRequest request) {
        List<String> existingEmails = memberService.findExistingEmails(request.emails());
        return ApiResponse.of("Checked emails", new CheckEmailsResponse(existingEmails));
    }

    /** Which of these mobile numbers already belong to a member of the caller's society. */
    @PostMapping("/check-phones")
    public ApiResponse<CheckPhonesResponse> checkPhones(@Valid @RequestBody CheckPhonesRequest request) {
        List<String> existingPhones = memberService.findExistingPhones(currentUser.requireSocietyId(), request.phones());
        return ApiResponse.of("Checked phone numbers", new CheckPhonesResponse(existingPhones));
    }

    @GetMapping
    public ApiResponse<PageResponse<MemberResponse>> list(@RequestParam(defaultValue = "0") int page,
                                                            @RequestParam(defaultValue = "20") int size,
                                                            @RequestParam(required = false) String search,
                                                            @RequestParam(required = false) Role role) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        return ApiResponse.of("Members fetched successfully",
                memberService.list(currentUser.requireSocietyId(), currentUser.userId(), pageable, search, role));
    }

    @GetMapping("/{memberId}")
    public ApiResponse<MemberResponse> getById(@PathVariable Long memberId) {
        return ApiResponse.of("Member fetched successfully", memberService.getById(currentUser.requireSocietyId(), memberId));
    }

    @PutMapping("/{memberId}")
    public ApiResponse<MemberResponse> update(@PathVariable Long memberId, @Valid @RequestBody UpdateMemberRequest request) {
        log.info("Updating member {} for society {}", memberId, currentUser.requireSocietyId());
        return ApiResponse.of("Member updated successfully", memberService.update(currentUser.requireSocietyId(), memberId, request));
    }

    @PostMapping("/{memberId}/photo")
    public ApiResponse<MemberResponse> uploadPhoto(@PathVariable Long memberId, @RequestParam("file") MultipartFile file) {
        log.info("Uploading photo for member {}", memberId);
        return ApiResponse.of("Photo uploaded successfully", memberService.uploadPhoto(currentUser.requireSocietyId(), memberId, file));
    }

    @DeleteMapping("/{memberId}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long memberId) {
        log.info("Deleting member {} for society {}", memberId, currentUser.requireSocietyId());
        memberService.delete(currentUser.requireSocietyId(), memberId);
        return ResponseEntity.ok(ApiResponse.of("Member deleted successfully", null));
    }

    @PostMapping("/bulk-delete")
    public ApiResponse<BulkDeleteResponse> bulkDelete(@Valid @RequestBody BulkDeleteRequest request) {
        Long societyId = currentUser.requireSocietyId();
        List<Long> ids = request.ids();
        log.info("Bulk-deleting {} members for society {}", ids.size(), societyId);

        List<BulkDeleteResult> results = new ArrayList<>(ids.size());
        int successCount = 0;

        for (Long memberId : ids) {
            try {
                BulkDeleteResult result = memberService.deleteOneForBulk(societyId, memberId);
                results.add(result);
                if (result.success()) {
                    successCount++;
                }
            } catch (BusinessException e) {
                results.add(new BulkDeleteResult(memberId, false, e.getMessage()));
            }
        }

        BulkDeleteResponse response = new BulkDeleteResponse(ids.size(), successCount, ids.size() - successCount, results);
        log.info("Bulk member delete for society {}: {} succeeded, {} failed", societyId, successCount, response.failureCount());
        return ApiResponse.of("Bulk delete completed: %d of %d members deleted".formatted(successCount, ids.size()), response);
    }
}
