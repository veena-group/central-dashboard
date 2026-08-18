package com.veenagroup.central.dashboard.dto.superadmin;

public record PlatformStatsResponse(
        long totalSocieties,
        long hostingActive,
        long hostingExpiringSoon,
        long hostingExpired,
        long subscriptionsPaidUp,
        long subscriptionsDueSoon,
        long subscriptionsOverdue
) {
}
