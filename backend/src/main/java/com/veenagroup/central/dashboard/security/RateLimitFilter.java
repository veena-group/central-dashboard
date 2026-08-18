package com.veenagroup.central.dashboard.security;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.veenagroup.central.dashboard.web.ApiErrorResponse;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.time.Duration;
import java.util.concurrent.TimeUnit;

/**
 * Per-IP token-bucket rate limiting, applied before authentication so abusive traffic is rejected
 * as cheaply as possible. Runs on a single instance (this app doesn't horizontally scale - see
 * FileStorageService's local-disk storage), so an in-memory bucket per IP is sufficient; no need
 * for a distributed store like Redis. Buckets are held in a Caffeine cache with an access-based
 * expiry so IPs that stop sending traffic get cleaned up automatically instead of growing forever.
 *
 * /api/auth/login gets a much stricter limit than everything else - it's the highest-value target
 * for a scripted attack, and this is on top of (not a replacement for) the per-account lockout in
 * LoginAttemptService, which protects a single account even if requests come from many different IPs.
 */
@Slf4j
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final int GENERAL_CAPACITY_PER_MINUTE = 120;
    private static final int LOGIN_CAPACITY_PER_MINUTE = 10;

    private final ObjectMapper objectMapper;

    private final Cache<String, Bucket> generalBuckets = Caffeine.newBuilder()
            .expireAfterAccess(10, TimeUnit.MINUTES)
            .maximumSize(50_000)
            .build();

    private final Cache<String, Bucket> loginBuckets = Caffeine.newBuilder()
            .expireAfterAccess(10, TimeUnit.MINUTES)
            .maximumSize(50_000)
            .build();

    public RateLimitFilter(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request, @NonNull HttpServletResponse response,
                                     @NonNull FilterChain filterChain) throws ServletException, IOException {
        String clientIp = resolveClientIp(request);
        boolean isLogin = "/api/auth/login".equals(request.getRequestURI());
        Bucket bucket = isLogin
                ? loginBuckets.get(clientIp, ip -> newBucket(LOGIN_CAPACITY_PER_MINUTE))
                : generalBuckets.get(clientIp, ip -> newBucket(GENERAL_CAPACITY_PER_MINUTE));

        if (bucket.tryConsume(1)) {
            filterChain.doFilter(request, response);
            return;
        }

        log.warn("Rate limit exceeded for {} on {} {}", clientIp, request.getMethod(), request.getRequestURI());
        response.setContentType("application/json");
        response.setStatus(429);
        objectMapper.writeValue(response.getWriter(), ApiErrorResponse.of(
                "Too many requests. Please slow down and try again shortly.", "RATE_LIMIT_EXCEEDED", null, request.getRequestURI()));
    }

    private Bucket newBucket(int capacityPerMinute) {
        Bandwidth limit = Bandwidth.classic(capacityPerMinute, Refill.greedy(capacityPerMinute, Duration.ofMinutes(1)));
        return Bucket.builder().addLimit(limit).build();
    }

    private String resolveClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
