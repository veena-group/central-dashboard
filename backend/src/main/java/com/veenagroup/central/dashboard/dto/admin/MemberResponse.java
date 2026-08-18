package com.veenagroup.central.dashboard.dto.admin;

import java.time.LocalDateTime;

public record MemberResponse(
        Long id,
        String name,
        String flat,
        String wing,
        String email,
        String phone,
        String role,
        String photoUrl,
        LocalDateTime createdAt
) {
}
