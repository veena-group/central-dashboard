package com.veenagroup.central.dashboard.dto.admin;

import com.veenagroup.central.dashboard.entity.enums.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateMemberRequest(
        @NotBlank String name,
        String flat,
        String wing,
        @NotBlank @Email String email,
        @Pattern(regexp = "^$|^[6-9]\\d{9}$", message = "Phone number must be a valid 10-digit Indian mobile number") String phone,
        @NotNull Role role,
        @NotBlank @Size(min = 6, max = 100) String password
) {
}
