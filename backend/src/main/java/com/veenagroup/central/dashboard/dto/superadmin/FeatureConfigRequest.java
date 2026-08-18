package com.veenagroup.central.dashboard.dto.superadmin;

import com.veenagroup.central.dashboard.entity.enums.FeatureKey;
import jakarta.validation.constraints.NotNull;

public record FeatureConfigRequest(
        @NotNull FeatureKey featureKey,
        boolean enabled,
        Integer limit
) {
}
