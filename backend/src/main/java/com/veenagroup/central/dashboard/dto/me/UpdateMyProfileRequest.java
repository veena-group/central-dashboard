package com.veenagroup.central.dashboard.dto.me;

import jakarta.validation.constraints.NotBlank;

public record UpdateMyProfileRequest(
        @NotBlank String name,
        String flat,
        String wing,
        String phone
) {
}
