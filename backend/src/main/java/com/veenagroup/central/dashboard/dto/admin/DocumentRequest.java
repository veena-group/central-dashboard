package com.veenagroup.central.dashboard.dto.admin;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record DocumentRequest(
        @NotBlank String title,
        @NotNull Long categoryId,
        Integer year,
        String description,
        boolean isPublic,
        boolean downloadable
) {
}
