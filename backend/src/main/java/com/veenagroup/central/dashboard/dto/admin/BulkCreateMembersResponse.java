package com.veenagroup.central.dashboard.dto.admin;

import java.util.List;

public record BulkCreateMembersResponse(
        int totalRows,
        int successCount,
        int failureCount,
        List<BulkMemberRowResult> results
) {
}
