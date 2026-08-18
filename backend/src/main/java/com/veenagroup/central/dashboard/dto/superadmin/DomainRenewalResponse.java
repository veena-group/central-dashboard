package com.veenagroup.central.dashboard.dto.superadmin;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record DomainRenewalResponse(
        Long id,
        LocalDate startDate,
        LocalDate expiryDate,
        String notes,
        LocalDateTime createdAt
) {
}
