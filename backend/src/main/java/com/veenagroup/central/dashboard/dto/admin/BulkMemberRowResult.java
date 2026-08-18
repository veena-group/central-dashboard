package com.veenagroup.central.dashboard.dto.admin;

public record BulkMemberRowResult(
        int rowNumber,
        String name,
        String email,
        boolean success,
        String message,
        Long memberId
) {
}
