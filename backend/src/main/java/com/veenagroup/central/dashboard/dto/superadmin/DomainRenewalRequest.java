package com.veenagroup.central.dashboard.dto.superadmin;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record DomainRenewalRequest(
        @NotNull LocalDate startDate,
        @NotNull LocalDate expiryDate,
        String notes
) {
}
