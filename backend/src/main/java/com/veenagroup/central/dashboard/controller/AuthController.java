package com.veenagroup.central.dashboard.controller;

import com.veenagroup.central.dashboard.dto.auth.LoginRequest;
import com.veenagroup.central.dashboard.dto.auth.LoginResponse;
import com.veenagroup.central.dashboard.dto.auth.RefreshTokenRequest;
import com.veenagroup.central.dashboard.entity.enums.Role;
import com.veenagroup.central.dashboard.exception.BusinessException;
import com.veenagroup.central.dashboard.repository.UsersRepository;
import com.veenagroup.central.dashboard.security.CurrentUser;
import com.veenagroup.central.dashboard.security.CustomUserDetails;
import com.veenagroup.central.dashboard.security.CustomUserDetailsService;
import com.veenagroup.central.dashboard.security.JwtService;
import com.veenagroup.central.dashboard.security.LoginAttemptService;
import com.veenagroup.central.dashboard.web.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;

@Slf4j
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final CustomUserDetailsService userDetailsService;
    private final UsersRepository usersRepository;
    private final LoginAttemptService loginAttemptService;
    private final CurrentUser currentUser;
    private final boolean domainValidationEnabled;

    public AuthController(AuthenticationManager authenticationManager, JwtService jwtService,
                           CustomUserDetailsService userDetailsService, UsersRepository usersRepository,
                           LoginAttemptService loginAttemptService, CurrentUser currentUser,
                           @Value("${app.security.domain-validation.enabled:true}") boolean domainValidationEnabled) {
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
        this.usersRepository = usersRepository;
        this.loginAttemptService = loginAttemptService;
        this.currentUser = currentUser;
        this.domainValidationEnabled = domainValidationEnabled;
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponse>> login(@Valid @RequestBody LoginRequest request,
                                                              HttpServletRequest httpRequest) {
        loginAttemptService.assertNotLocked(request.email());

        CustomUserDetails userDetails;
        try {
            var authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.email(), request.password()));
            userDetails = (CustomUserDetails) authentication.getPrincipal();
        } catch (AuthenticationException e) {
            loginAttemptService.registerFailedAttempt(request.email());
            throw e;
        }

        loginAttemptService.resetFailedAttempts(request.email());
        validateDomain(userDetails, httpRequest);
        LoginResponse response = buildLoginResponse(userDetails);

        log.info("Login successful for user {}", request.email());

        return ResponseEntity.ok(ApiResponse.of("Login successful", response));
    }

    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<LoginResponse>> refresh(@Valid @RequestBody RefreshTokenRequest request,
                                                                HttpServletRequest httpRequest) {
        String email;
        try {
            email = jwtService.extractEmailFromRefreshToken(request.refreshToken());
        } catch (IllegalArgumentException e) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "INVALID_REFRESH_TOKEN", "Invalid or expired refresh token");
        }

        CustomUserDetails userDetails = (CustomUserDetails) userDetailsService.loadUserByUsername(email);
        if (!jwtService.isRefreshTokenValid(request.refreshToken(), userDetails)) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "INVALID_REFRESH_TOKEN", "Invalid or expired refresh token");
        }

        validateDomain(userDetails, httpRequest);
        LoginResponse response = buildLoginResponse(userDetails);

        log.info("Token refreshed for user {}", email);

        return ResponseEntity.ok(ApiResponse.of("Token refreshed successfully", response));
    }

    /**
     * JWTs are stateless, so the only way to actually revoke every access/refresh token already
     * issued to this user is to bump their tokenVersion - any token minted before this call then
     * fails validation on its next use, everywhere, immediately.
     */
    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout() {
        Long userId = currentUser.userId();
        usersRepository.findById(userId).ifPresent(user -> {
            user.setTokenVersion(user.getTokenVersion() + 1);
            usersRepository.save(user);
        });

        log.info("User {} logged out (tokens revoked)", userId);
        return ResponseEntity.ok(ApiResponse.of("Logged out successfully", null));
    }

    /**
     * SUPER_ADMIN manages every society from one place, so it's exempt. Everyone else must be
     * authenticating through their own society's domain - this stops a valid login from one
     * society's account being used against a different society's portal.
     */
    private void validateDomain(CustomUserDetails userDetails, HttpServletRequest httpRequest) {
        if (!domainValidationEnabled || userDetails.getRole() == Role.SUPER_ADMIN) {
            return;
        }

        String requestDomain = extractRequestDomain(httpRequest);
        String societyDomain = userDetails.getSocietyDomain();
        if (requestDomain == null) {
            log.warn("Rejected login for user {}: request carried no usable Origin/Host header",
                    userDetails.getUsername());
            throw new BusinessException(HttpStatus.FORBIDDEN, "DOMAIN_MISMATCH",
                    "We couldn't sign you in from here. Please use the website link your society gave you to log in.");
        }

        if (societyDomain == null) {
            log.warn("Rejected login for user {}: no society domain is configured for their account",
                    userDetails.getUsername());
            throw new BusinessException(HttpStatus.FORBIDDEN, "DOMAIN_MISMATCH",
                    "We couldn't sign you in from here. Please use the website link your society gave you to log in.");
        }

        if (!requestDomain.equalsIgnoreCase(societyDomain.trim())) {
            log.warn("Rejected login for user {}: request domain '{}' does not match society domain '{}'",
                    userDetails.getUsername(), requestDomain, societyDomain);
            throw new BusinessException(HttpStatus.FORBIDDEN, "DOMAIN_MISMATCH",
                    "We couldn't sign you in from here. Please use the website link your society gave you to log in.");
        }
    }

    private String extractRequestDomain(HttpServletRequest httpRequest) {
        String origin = httpRequest.getHeader("Origin");
        String hostSource = (origin != null && !origin.isBlank()) ? origin : httpRequest.getHeader("Host");
        if (hostSource == null || hostSource.isBlank()) {
            return null;
        }

        try {
            String candidate = hostSource.contains("://") ? hostSource : "http://" + hostSource;
            return URI.create(candidate).getHost();
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private LoginResponse buildLoginResponse(CustomUserDetails userDetails) {
        String token = jwtService.generateToken(userDetails);
        String refreshToken = jwtService.generateRefreshToken(userDetails);

        return new LoginResponse(
                token,
                refreshToken,
                "Bearer",
                jwtService.getAccessExpirationSeconds(),
                userDetails.getUserId(),
                userDetails.getName(),
                userDetails.getUsername(),
                userDetails.getPhotoUrl(),
                userDetails.getSocietyName(),
                userDetails.getSocietyLogoUrl(),
                userDetails.getPrimaryColor(),
                userDetails.getSecondaryColor(),
                userDetails.getRole().name(),
                userDetails.getSocietyId(),
                userDetails.getSocietyDomain()
        );
    }
}
