package com.veenagroup.central.dashboard.dto.superadmin;

public record FeatureResponse(
        Long id,
        String featureKey,
        boolean enabled,
        Integer limit
) {
}
