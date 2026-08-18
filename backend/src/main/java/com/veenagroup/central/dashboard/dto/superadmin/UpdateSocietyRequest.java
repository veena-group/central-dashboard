package com.veenagroup.central.dashboard.dto.superadmin;

import jakarta.validation.constraints.NotBlank;

public record UpdateSocietyRequest(
        @NotBlank String name,
        @NotBlank String domain,
        String primaryColor,
        String secondaryColor
) {
}
