package com.veenagroup.central.dashboard.dto.superadmin;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;

public record OnboardSocietyRequest(
        @NotBlank String societyName,
        @NotBlank String domain,
        String primaryColor,
        String secondaryColor,
        @NotNull LocalDate domainStartDate,
        @NotNull LocalDate domainExpiryDate,

        @NotBlank String adminName,
        @NotBlank @Email String adminEmail,
        String adminPhone,
        @NotBlank @Size(min = 6, max = 100) String adminPassword,

        @NotEmpty List<@Valid FeatureConfigRequest> features
) {
}
