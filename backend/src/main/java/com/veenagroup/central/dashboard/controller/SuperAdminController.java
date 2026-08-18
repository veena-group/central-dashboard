package com.veenagroup.central.dashboard.controller;

import com.veenagroup.central.dashboard.dto.superadmin.*;
import com.veenagroup.central.dashboard.service.DomainRenewalService;
import com.veenagroup.central.dashboard.service.PaymentService;
import com.veenagroup.central.dashboard.service.SocietyFeatureService;
import com.veenagroup.central.dashboard.service.SocietyOnboardingService;
import com.veenagroup.central.dashboard.service.SocietyService;
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
@RequestMapping("/api/super-admin/societies")
public class SuperAdminController {

    private final SocietyOnboardingService onboardingService;
    private final SocietyService societyService;
    private final SocietyFeatureService societyFeatureService;
    private final PaymentService paymentService;
    private final DomainRenewalService domainRenewalService;

    public SuperAdminController(SocietyOnboardingService onboardingService,
                                 SocietyService societyService,
                                 SocietyFeatureService societyFeatureService,
                                 PaymentService paymentService,
                                 DomainRenewalService domainRenewalService) {
        this.onboardingService = onboardingService;
        this.societyService = societyService;
        this.societyFeatureService = societyFeatureService;
        this.paymentService = paymentService;
        this.domainRenewalService = domainRenewalService;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<OnboardSocietyResponse>> onboard(@Valid @RequestBody OnboardSocietyRequest request) {
        log.info("Onboarding new society '{}'", request.societyName());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of("Society onboarded successfully", onboardingService.onboard(request)));
    }

    @GetMapping
    public ApiResponse<PageResponse<SocietyResponse>> getAll(@RequestParam(defaultValue = "0") int page,
                                                                @RequestParam(defaultValue = "20") int size,
                                                                @RequestParam(required = false) String search,
                                                                @RequestParam(required = false) String hostingState,
                                                                @RequestParam(required = false) String subscriptionState) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("id"));
        return ApiResponse.of("Societies fetched successfully", societyService.getAll(pageable, search, hostingState, subscriptionState));
    }

    @GetMapping("/stats")
    public ApiResponse<PlatformStatsResponse> stats() {
        return ApiResponse.of("Platform stats fetched successfully", societyService.getStats());
    }

    @GetMapping("/{societyId}")
    public ApiResponse<SocietyResponse> getById(@PathVariable Long societyId) {
        return ApiResponse.of("Society fetched successfully", societyService.getById(societyId));
    }

    @GetMapping("/{societyId}/admins")
    public ApiResponse<List<SocietyAdminResponse>> admins(@PathVariable Long societyId) {
        return ApiResponse.of("Admins fetched successfully", societyService.listAdmins(societyId));
    }

    @PutMapping("/{societyId}")
    public ApiResponse<SocietyResponse> update(@PathVariable Long societyId, @Valid @RequestBody UpdateSocietyRequest request) {
        log.info("Updating society {}", societyId);
        return ApiResponse.of("Society updated successfully", societyService.update(societyId, request));
    }

    @PostMapping("/{societyId}/logo")
    public ApiResponse<SocietyResponse> uploadLogo(@PathVariable Long societyId, @RequestParam("file") MultipartFile file) {
        log.info("Uploading logo for society {}", societyId);
        return ApiResponse.of("Logo uploaded successfully", societyService.uploadLogo(societyId, file));
    }

    @GetMapping("/{societyId}/features")
    public ApiResponse<List<FeatureResponse>> getFeatures(@PathVariable Long societyId) {
        return ApiResponse.of("Features fetched successfully", societyFeatureService.getFeatures(societyId));
    }

    @PutMapping("/{societyId}/features")
    public ApiResponse<List<FeatureResponse>> updateFeatures(@PathVariable Long societyId,
                                                 @Valid @RequestBody List<@Valid FeatureConfigRequest> updates) {
        log.info("Updating {} feature(s) for society {}", updates.size(), societyId);
        return ApiResponse.of("Features updated successfully", societyFeatureService.updateFeatures(societyId, updates));
    }

    @PostMapping("/{societyId}/payments")
    public ResponseEntity<ApiResponse<PaymentResponse>> addPayment(@PathVariable Long societyId,
                                                       @Valid @RequestBody PaymentRequest request) {
        log.info("Adding payment for society {}", societyId);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of("Payment recorded successfully", paymentService.addPayment(societyId, request)));
    }

    @GetMapping("/{societyId}/payments")
    public ApiResponse<PageResponse<PaymentResponse>> listPayments(@PathVariable Long societyId,
                                                                       @RequestParam(defaultValue = "0") int page,
                                                                       @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "id"));
        return ApiResponse.of("Payments fetched successfully", paymentService.listPayments(societyId, pageable));
    }

    @PostMapping("/{societyId}/domain-renewals")
    public ResponseEntity<ApiResponse<DomainRenewalResponse>> addDomainRenewal(@PathVariable Long societyId,
                                                                                @Valid @RequestBody DomainRenewalRequest request) {
        log.info("Recording domain renewal for society {}", societyId);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.of("Domain renewal recorded successfully", domainRenewalService.addRenewal(societyId, request)));
    }

    @GetMapping("/{societyId}/domain-renewals")
    public ApiResponse<List<DomainRenewalResponse>> listDomainRenewals(@PathVariable Long societyId) {
        return ApiResponse.of("Domain renewals fetched successfully", domainRenewalService.listRenewals(societyId));
    }
}
