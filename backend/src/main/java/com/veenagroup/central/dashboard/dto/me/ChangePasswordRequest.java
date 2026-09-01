package com.veenagroup.central.dashboard.dto.me;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChangePasswordRequest(
        @NotBlank String currentPassword,
        @NotBlank @Size(min = 4, max = 100) String newPassword
) {
}
