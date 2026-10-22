package com.veenagroup.central.dashboard.dto.admin;

import com.veenagroup.central.dashboard.entity.enums.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Which of `email` / `phone` is mandatory depends on the society's login type, which this DTO
 * can't know - MemberService enforces that. Here each is only format-checked when present.
 */
public record CreateMemberRequest(
        @NotBlank String name,
        String flat,
        String wing,
        @Email String email,
        @Pattern(regexp = "^$|^[6-9]\\d{9}$", message = "Phone number must be a valid 10-digit Indian mobile number") String phone,
        @NotNull Role role,
        @NotBlank @Size(min = 4, max = 100) String password
) {
}
