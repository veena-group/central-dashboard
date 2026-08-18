package com.veenagroup.central.dashboard.dto.admin;

import jakarta.validation.constraints.NotBlank;

import java.time.LocalDate;

public record CommitteeRequest(
        @NotBlank String name,
        String designation,
        String flat,
        String phone,
        String email,
        LocalDate servingSince
) {
}
