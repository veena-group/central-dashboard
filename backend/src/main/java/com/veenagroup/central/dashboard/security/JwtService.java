package com.veenagroup.central.dashboard.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Component
public class JwtService {

    private static final String TOKEN_TYPE_CLAIM = "type";
    private static final String ACCESS_TOKEN_TYPE = "access";
    private static final String REFRESH_TOKEN_TYPE = "refresh";

    private final SecretKey signingKey;
    private final long accessExpirationMs;
    private final long refreshExpirationMs;

    public JwtService(@Value("${app.jwt.secret}") String secret,
                       @Value("${app.jwt.expiration-ms}") long accessExpirationMs,
                       @Value("${app.jwt.refresh-expiration-ms}") long refreshExpirationMs) {
        this.signingKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accessExpirationMs = accessExpirationMs;
        this.refreshExpirationMs = refreshExpirationMs;
    }

    public long getAccessExpirationSeconds() {
        return accessExpirationMs / 1000;
    }

    public String generateToken(CustomUserDetails userDetails) {
        return buildToken(userDetails, ACCESS_TOKEN_TYPE, accessExpirationMs);
    }

    public String generateRefreshToken(CustomUserDetails userDetails) {
        return buildToken(userDetails, REFRESH_TOKEN_TYPE, refreshExpirationMs);
    }

    private String buildToken(CustomUserDetails userDetails, String tokenType, long expirationMs) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + expirationMs);

        var builder = Jwts.builder()
                .subject(userDetails.getUsername())
                .claim("userId", userDetails.getUserId())
                .claim("role", userDetails.getRole().name())
                .claim(TOKEN_TYPE_CLAIM, tokenType)
                .claim("tokenVersion", userDetails.getTokenVersion())
                .issuedAt(now)
                .expiration(expiry)
                .signWith(signingKey);

        if (userDetails.getSocietyId() != null) {
            builder.claim("societyId", userDetails.getSocietyId());
        }

        return builder.compact();
    }

    public Claims extractClaims(String token) {
        return Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public String extractEmail(String token) {
        return extractClaims(token).getSubject();
    }

    public boolean isTokenValid(String token, CustomUserDetails userDetails) {
        Claims claims = extractClaims(token);
        return claims.getSubject().equals(userDetails.getUsername())
                && claims.getExpiration().after(new Date())
                && ACCESS_TOKEN_TYPE.equals(claims.get(TOKEN_TYPE_CLAIM, String.class))
                && matchesTokenVersion(claims, userDetails);
    }

    public String extractEmailFromRefreshToken(String refreshToken) {
        Claims claims;
        try {
            claims = extractClaims(refreshToken);
        } catch (JwtException e) {
            throw new IllegalArgumentException("Invalid refresh token", e);
        }
        if (!REFRESH_TOKEN_TYPE.equals(claims.get(TOKEN_TYPE_CLAIM, String.class))) {
            throw new IllegalArgumentException("Token is not a refresh token");
        }
        if (claims.getExpiration().before(new Date())) {
            throw new IllegalArgumentException("Refresh token has expired");
        }
        return claims.getSubject();
    }

    /** Called once the corresponding user has been loaded, to confirm the refresh token hasn't been revoked (see Users.tokenVersion). */
    public boolean isRefreshTokenValid(String refreshToken, CustomUserDetails userDetails) {
        return matchesTokenVersion(extractClaims(refreshToken), userDetails);
    }

    private boolean matchesTokenVersion(Claims claims, CustomUserDetails userDetails) {
        Integer tokenVersion = claims.get("tokenVersion", Integer.class);
        return tokenVersion != null && tokenVersion == userDetails.getTokenVersion();
    }
}
