package com.veenagroup.central.dashboard.controller;

import com.veenagroup.central.dashboard.dto.auth.LoginConfigResponse;
import com.veenagroup.central.dashboard.dto.auth.LoginRequest;
import com.veenagroup.central.dashboard.dto.auth.LoginResponse;
import com.veenagroup.central.dashboard.dto.auth.RefreshTokenRequest;
import com.veenagroup.central.dashboard.entity.Society;
import com.veenagroup.central.dashboard.entity.enums.LoginType;
import com.veenagroup.central.dashboard.entity.enums.Role;
import com.veenagroup.central.dashboard.exception.BusinessException;
import com.veenagroup.central.dashboard.repository.UsersRepository;
import com.veenagroup.central.dashboard.security.CurrentUser;
import com.veenagroup.central.dashboard.security.CustomUserDetails;
import com.veenagroup.central.dashboard.security.CustomUserDetailsService;
import com.veenagroup.central.dashboard.security.JwtService;
import com.veenagroup.central.dashboard.security.LoginAttemptService;
import com.veenagroup.central.dashboard.security.LoginIdentityService;
import com.veenagroup.central.dashboard.web.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.bind.annotation.GetMapping;
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
    private final LoginIdentityService loginIdentityService;
    private final CurrentUser currentUser;
    private final boolean domainValidationEnabled;

    public AuthController(AuthenticationManager authenticationManager, JwtService jwtService,
                           CustomUserDetailsService userDetailsService, UsersRepository usersRepository,
                           LoginAttemptService loginAttemptService,
                           LoginIdentityService loginIdentityService, CurrentUser currentUser,
                           @Value("${app.security.domain-validation.enabled:true}") boolean domainValidationEnabled) {
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
        this.usersRepository = usersRepository;
        this.loginAttemptService = loginAttemptService;
        this.loginIdentityService = loginIdentityService;
        this.currentUser = currentUser;
        this.domainValidationEnabled = domainValidationEnabled;
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponse>> login(@Valid @RequestBody LoginRequest request,
                                                              HttpServletRequest httpRequest) {
        String identifier = request.resolvedIdentifier();
        if (identifier == null || identifier.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Email or mobile number is required");
        }

        Society society = loginIdentityService.findSocietyByDomain(extractRequestDomain(httpRequest)).orElse(null);
        Long userId = loginIdentityService.resolveUserId(identifier, society)
                .orElseThrow(() -> new BadCredentialsException("No matching account"));

        loginAttemptService.assertNotLocked(userId);

        CustomUserDetails userDetails;
        try {
            var authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(String.valueOf(userId), request.password()));
            userDetails = (CustomUserDetails) authentication.getPrincipal();
        } catch (AuthenticationException e) {
            loginAttemptService.registerFailedAttempt(userId);
            throw e;
        }

        loginAttemptService.resetFailedAttempts(userId);
        validateDomain(userDetails, httpRequest);
        LoginResponse response = buildLoginResponse(userDetails);

        log.info("Login successful for user {}", userId);

        return ResponseEntity.ok(ApiResponse.of("Login successful", response));
    }

    /**
     * Tells a login page which identifier to ask for. Public and keyed off the request's Origin,
     * so each society's own site needs no per-society configuration (and a later login-type change
     * needs no redeploy). Anything we can't map to a society - the central dashboard's own super
     * admin login, a local dev origin - gets EMAIL.
     */
    @GetMapping("/login-config")
    public ResponseEntity<ApiResponse<LoginConfigResponse>> loginConfig(HttpServletRequest httpRequest) {
        LoginType loginType = loginIdentityService.findSocietyByDomain(extractRequestDomain(httpRequest))
                .map(Society::getLoginType)
                .orElse(LoginType.EMAIL);
        return ResponseEntity.ok(ApiResponse.of("Login config fetched", new LoginConfigResponse(loginType.name())));
    }

    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<LoginResponse>> refresh(@Valid @RequestBody RefreshTokenRequest request,
                                                                HttpServletRequest httpRequest) {
        CustomUserDetails userDetails;
        try {
            String subject = jwtService.extractSubjectFromRefreshToken(request.refreshToken());
            userDetails = (CustomUserDetails) userDetailsService.loadUserByUsername(subject);
        } catch (IllegalArgumentException | UsernameNotFoundException e) {
            // Includes refresh tokens issued before the id-subject switch (their subject is an email).
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "INVALID_REFRESH_TOKEN", "Invalid or expired refresh token");
        }
        if (!jwtService.isRefreshTokenValid(request.refreshToken(), userDetails)) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "INVALID_REFRESH_TOKEN", "Invalid or expired refresh token");
        }

        validateDomain(userDetails, httpRequest);
        LoginResponse response = buildLoginResponse(userDetails);

        log.info("Token refreshed for user {}", userDetails.getUserId());

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
                userDetails.getEmail(),
                userDetails.getPhotoUrl(),
                userDetails.getSocietyName(),
                userDetails.getSocietyLogoUrl(),
                userDetails.getPrimaryColor(),
                userDetails.getSecondaryColor(),
                userDetails.getRole().name(),
                userDetails.getSocietyId(),
                userDetails.getSocietyDomain(),
                userDetails.getPhone(),
                userDetails.getLoginType().name()
        );
    }
}
