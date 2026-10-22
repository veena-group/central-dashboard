package com.veenagroup.central.dashboard.dto.admin;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

public record CheckPhonesRequest(
        @NotEmpty(message = "At least one phone number is required")
        @Size(max = 500, message = "Cannot check more than 500 phone numbers at once")
        List<String> phones
) {
}
