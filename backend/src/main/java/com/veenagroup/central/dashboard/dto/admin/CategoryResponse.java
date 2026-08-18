package com.veenagroup.central.dashboard.dto.admin;

public record CategoryResponse(
        Long id,
        String type,
        String name,
        boolean active
) {
}
