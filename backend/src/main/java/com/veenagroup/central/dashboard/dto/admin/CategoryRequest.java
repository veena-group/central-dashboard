package com.veenagroup.central.dashboard.dto.admin;

import com.veenagroup.central.dashboard.entity.enums.CategoryType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CategoryRequest(
        @NotNull CategoryType type,
        @NotBlank String name
) {
}
