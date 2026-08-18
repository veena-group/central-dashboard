package com.veenagroup.central.dashboard.dto.admin;

import com.veenagroup.central.dashboard.entity.enums.EventStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.time.LocalTime;

public record EventRequest(
        @NotBlank String title,
        @NotNull Long categoryId,
        String description,
        @NotNull LocalDate eventDate,
        LocalDate endDate,
        LocalTime startTime,
        LocalTime endTime,
        String venue,
        @NotNull EventStatus status,
        boolean isPublic,
        boolean downloadable
) {
}
