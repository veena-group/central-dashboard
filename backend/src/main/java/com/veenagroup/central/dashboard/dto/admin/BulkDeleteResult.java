package com.veenagroup.central.dashboard.dto.admin;

public record BulkDeleteResult(
        Long id,
        boolean success,
        String message
) {
}
