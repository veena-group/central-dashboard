package com.veenagroup.central.dashboard.dto.admin;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record MeetingResponse(
        Long id,
        String title,
        Long categoryId,
        String categoryName,
        String agenda,
        LocalDate meetingDate,
        List<AttachmentResponse> attachments,
        String platform,
        String meetingUrl,
        String status,
        String recordingUrl,
        boolean isPublic,
        boolean downloadable,
        LocalDateTime createdAt
) {
}
