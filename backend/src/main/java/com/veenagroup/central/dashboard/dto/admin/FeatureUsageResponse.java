package com.veenagroup.central.dashboard.dto.admin;

public record FeatureUsageResponse(
        String featureKey,
        boolean enabled,
        int limit,
        long used
) {
}
