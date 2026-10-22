package com.veenagroup.central.dashboard.dto.auth;

import jakarta.validation.constraints.NotBlank;

/**
 * `identifier` is the email or the mobile number, depending on the society's login type. `email`
 * is the pre-mobile-login field name, still accepted so tenant sites that haven't been redeployed
 * yet keep working; use {@link #resolvedIdentifier()} to read whichever was sent.
 */
public record LoginRequest(
        String identifier,
        String email,
        @NotBlank String password
) {

    public String resolvedIdentifier() {
        String value = (identifier != null && !identifier.isBlank()) ? identifier : email;
        return value == null ? null : value.trim();
    }
}
