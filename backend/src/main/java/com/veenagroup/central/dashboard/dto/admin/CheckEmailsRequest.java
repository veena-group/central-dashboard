package com.veenagroup.central.dashboard.dto.admin;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

public record CheckEmailsRequest(
        @NotEmpty(message = "At least one email is required")
        @Size(max = 500, message = "Cannot check more than 500 emails at once")
        List<String> emails
) {
}
