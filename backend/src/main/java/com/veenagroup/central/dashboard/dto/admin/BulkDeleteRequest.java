package com.veenagroup.central.dashboard.dto.admin;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

public record BulkDeleteRequest(
        @NotEmpty(message = "At least one id is required")
        @Size(max = 500, message = "Cannot delete more than 500 records in a single request")
        List<Long> ids
) {
}
