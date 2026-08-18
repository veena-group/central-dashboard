package com.veenagroup.central.dashboard.dto.me;

public record MyProfileResponse(
        Long id,
        String name,
        String flat,
        String wing,
        String email,
        String phone,
        String role,
        Long societyId,
        String photoUrl,
        java.time.LocalDateTime createdAt
) {
}
