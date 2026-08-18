package com.veenagroup.central.dashboard.dto.admin;

import com.veenagroup.central.dashboard.entity.enums.MeetingPlatform;
import com.veenagroup.central.dashboard.entity.enums.MeetingStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record MeetingRequest(
        @NotBlank String title,
        @NotNull Long categoryId,
        String agenda,
        @NotNull LocalDate meetingDate,
        MeetingPlatform platform,
        String meetingUrl,
        @NotNull MeetingStatus status,
        String recordingUrl,
        boolean isPublic,
        boolean downloadable
) {
}
