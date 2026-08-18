package com.veenagroup.central.dashboard.controller;

import com.veenagroup.central.dashboard.dto.admin.FeatureUsageResponse;
import com.veenagroup.central.dashboard.security.CurrentUser;
import com.veenagroup.central.dashboard.service.FeatureUsageService;
import com.veenagroup.central.dashboard.web.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/features")
public class FeatureUsageController {

    private final FeatureUsageService featureUsageService;
    private final CurrentUser currentUser;

    public FeatureUsageController(FeatureUsageService featureUsageService, CurrentUser currentUser) {
        this.featureUsageService = featureUsageService;
        this.currentUser = currentUser;
    }

    @GetMapping
    public ApiResponse<List<FeatureUsageResponse>> getMyFeatures() {
        return ApiResponse.of("Feature usage fetched successfully", featureUsageService.getUsage(currentUser.requireSocietyId()));
    }
}
