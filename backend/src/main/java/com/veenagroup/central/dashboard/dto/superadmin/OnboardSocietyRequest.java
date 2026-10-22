package com.veenagroup.central.dashboard.dto.superadmin;

import com.veenagroup.central.dashboard.entity.enums.LoginType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;

/**
 * `loginType` defaults to EMAIL when omitted (older clients). Whichever of adminEmail / adminPhone
 * matches the login type is mandatory - SocietyOnboardingService enforces that, since it depends on
 * another field.
 */
public record OnboardSocietyRequest(
        @NotBlank String societyName,
        @NotBlank String domain,
        String primaryColor,
        String secondaryColor,
        @NotNull LocalDate domainStartDate,
        @NotNull LocalDate domainExpiryDate,
        LoginType loginType,

        @NotBlank String adminName,
        @Email String adminEmail,
        @Pattern(regexp = "^$|^[6-9]\\d{9}$", message = "Phone number must be a valid 10-digit Indian mobile number") String adminPhone,
        @NotBlank @Size(min = 4, max = 100) String adminPassword,

        @NotEmpty List<@Valid FeatureConfigRequest> features
) {
}
