package com.veenagroup.central.dashboard.dto.admin;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

public record EventResponse(
        Long id,
        String title,
        Long categoryId,
        String categoryName,
        String description,
        LocalDate eventDate,
        LocalDate endDate,
        LocalTime startTime,
        LocalTime endTime,
        String venue,
        String bannerPath,
        List<AttachmentResponse> attachments,
        String status,
        boolean isPublic,
        boolean downloadable,
        LocalDateTime createdAt
) {
}
