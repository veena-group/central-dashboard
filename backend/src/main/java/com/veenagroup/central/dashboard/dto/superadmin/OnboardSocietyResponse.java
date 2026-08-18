package com.veenagroup.central.dashboard.dto.superadmin;

public record OnboardSocietyResponse(
        Long societyId,
        String societyName,
        String domain,
        Long adminUserId,
        String adminEmail
) {
}
