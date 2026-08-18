package com.veenagroup.central.dashboard.dto.admin;

import java.time.LocalDateTime;

public record GalleryResponse(
        Long id,
        Long albumId,
        String albumName,
        String title,
        String description,
        String attachmentPath,
        boolean isPublic,
        boolean downloadable,
        LocalDateTime createdAt
) {
}
