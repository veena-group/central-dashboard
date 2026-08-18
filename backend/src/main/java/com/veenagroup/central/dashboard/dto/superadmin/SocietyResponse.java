package com.veenagroup.central.dashboard.dto.superadmin;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record SocietyResponse(
        Long id,
        String name,
        String domain,
        String logoUrl,
        String primaryColor,
        String secondaryColor,
        LocalDate currentHostingExpiry,
        String hostingState,
        LocalDate currentNextDueDate,
        String subscriptionState,
        LocalDateTime createdAt
) {
}
