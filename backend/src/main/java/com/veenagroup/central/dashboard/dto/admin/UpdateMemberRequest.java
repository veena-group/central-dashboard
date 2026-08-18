package com.veenagroup.central.dashboard.dto.admin;

import com.veenagroup.central.dashboard.entity.enums.Role;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public record UpdateMemberRequest(
        @NotBlank String name,
        String flat,
        String wing,
        @Pattern(regexp = "^$|^[6-9]\\d{9}$", message = "Phone number must be a valid 10-digit Indian mobile number") String phone,
        @NotNull Role role
) {
}
