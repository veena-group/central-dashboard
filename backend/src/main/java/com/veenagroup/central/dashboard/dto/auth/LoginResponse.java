package com.veenagroup.central.dashboard.dto.auth;

public record LoginResponse(
        String token,
        String refreshToken,
        String tokenType,
        long expiresIn,
        Long userId,
        String name,
        String email,
        String photoUrl,
        String societyName,
        String societyLogoUrl,
        String primaryColor,
        String secondaryColor,
        String role,
        Long societyId,
        String societyDomain
) {
}
