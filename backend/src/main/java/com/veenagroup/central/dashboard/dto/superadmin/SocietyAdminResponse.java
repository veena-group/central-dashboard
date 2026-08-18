package com.veenagroup.central.dashboard.dto.superadmin;

import java.time.LocalDateTime;

public record SocietyAdminResponse(
        Long id,
        String name,
        String email,
        String phone,
        LocalDateTime createdAt
) {
}
