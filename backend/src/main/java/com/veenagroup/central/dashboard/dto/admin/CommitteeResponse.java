package com.veenagroup.central.dashboard.dto.admin;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record CommitteeResponse(
        Long id,
        String name,
        String designation,
        String flat,
        String phone,
        String email,
        LocalDate servingSince,
        String photoUrl,
        LocalDateTime createdAt
) {
}
