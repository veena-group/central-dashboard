package com.veenagroup.central.dashboard.security;

import com.veenagroup.central.dashboard.exception.BusinessException;
import com.veenagroup.central.dashboard.repository.UsersRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

/**
 * Kept as its own Spring bean (rather than private methods on AuthController) so the
 * pessimistic-locked read in registerFailedAttempt actually goes through Spring's transactional
 * proxy - calling a @Transactional method on `this` from within the same class bypasses the proxy
 * entirely and silently runs without a transaction or lock.
 *
 * Keyed by user id (not email) because a mobile-login account may have no email.
 */
@Slf4j
@Service
public class LoginAttemptService {

    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final long LOCKOUT_MINUTES = 15;

    private final UsersRepository usersRepository;

    public LoginAttemptService(UsersRepository usersRepository) {
        this.usersRepository = usersRepository;
    }

    @Transactional(readOnly = true)
    public void assertNotLocked(Long userId) {
        usersRepository.findById(userId).ifPresent(user -> {
            LocalDateTime lockedUntil = user.getLockedUntil();
            if (lockedUntil != null && lockedUntil.isAfter(LocalDateTime.now())) {
                long minutesLeft = Math.max(1, ChronoUnit.MINUTES.between(LocalDateTime.now(), lockedUntil));
                throw new BusinessException(HttpStatus.LOCKED, "ACCOUNT_LOCKED",
                        "Too many failed sign-in attempts. Please try again in " + minutesLeft + " minute(s).");
            }
        });
    }

    /**
     * Row-locked for the whole method so a concurrent call for the same user waits until this one
     * commits, instead of both reading the same starting count and one increment getting lost.
     */
    @Transactional
    public void registerFailedAttempt(Long userId) {
        usersRepository.findByIdForUpdate(userId).ifPresent(user -> {
            int attempts = user.getFailedLoginAttempts() + 1;
            user.setFailedLoginAttempts(attempts);
            if (attempts >= MAX_FAILED_ATTEMPTS) {
                user.setLockedUntil(LocalDateTime.now().plusMinutes(LOCKOUT_MINUTES));
                user.setFailedLoginAttempts(0);
                log.warn("Account locked for {} minutes after {} failed login attempts: user {}",
                        LOCKOUT_MINUTES, attempts, user.getId());
            }
            usersRepository.save(user);
        });
    }

    @Transactional
    public void resetFailedAttempts(Long userId) {
        usersRepository.findByIdForUpdate(userId).ifPresent(user -> {
            if (user.getFailedLoginAttempts() != 0 || user.getLockedUntil() != null) {
                user.setFailedLoginAttempts(0);
                user.setLockedUntil(null);
                usersRepository.save(user);
            }
        });
    }
}
