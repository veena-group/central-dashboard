package com.veenagroup.central.dashboard.dto.admin;

import java.util.List;

public record BulkDeleteResponse(
        int totalRequested,
        int successCount,
        int failureCount,
        List<BulkDeleteResult> results
) {
}
