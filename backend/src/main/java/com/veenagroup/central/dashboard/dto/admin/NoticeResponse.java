package com.veenagroup.central.dashboard.dto.admin;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record NoticeResponse(
        Long id,
        String title,
        String body,
        Long categoryId,
        String categoryName,
        LocalDate publishOn,
        LocalDate expireOn,
        boolean isPublic,
        boolean downloadable,
        List<AttachmentResponse> attachments,
        LocalDateTime createdAt
) {
}
