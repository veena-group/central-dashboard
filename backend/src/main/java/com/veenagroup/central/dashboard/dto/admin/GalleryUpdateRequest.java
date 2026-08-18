package com.veenagroup.central.dashboard.dto.admin;

import jakarta.validation.constraints.NotNull;

public record GalleryUpdateRequest(
        @NotNull Long albumId,
        String title,
        String description,
        boolean isPublic,
        boolean downloadable
) {
}
