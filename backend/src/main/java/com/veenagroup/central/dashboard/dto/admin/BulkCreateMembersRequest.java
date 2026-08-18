package com.veenagroup.central.dashboard.dto.admin;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

public record BulkCreateMembersRequest(
        @NotEmpty(message = "At least one member row is required")
        @Size(max = 500, message = "Cannot import more than 500 members in a single upload")
        List<CreateMemberRequest> members
) {
}
