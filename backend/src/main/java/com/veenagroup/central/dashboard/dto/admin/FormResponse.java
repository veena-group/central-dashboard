package com.veenagroup.central.dashboard.dto.admin;

import java.time.LocalDateTime;
import java.util.List;

public record FormResponse(
        Long id,
        String title,
        Long categoryId,
        String categoryName,
        Integer year,
        String description,
        boolean isPublic,
        boolean downloadable,
        List<AttachmentResponse> attachments,
        LocalDateTime createdAt
) {
}
