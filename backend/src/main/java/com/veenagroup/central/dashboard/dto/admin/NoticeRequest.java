package com.veenagroup.central.dashboard.dto.admin;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record NoticeRequest(
        @NotBlank String title,
        String body,
        @NotNull Long categoryId,
        @NotNull LocalDate publishOn,
        @NotNull LocalDate expireOn,
        boolean isPublic,
        boolean downloadable
) {
}
