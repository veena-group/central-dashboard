package com.veenagroup.central.dashboard.security;

import com.veenagroup.central.dashboard.repository.UsersRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
public class CustomUserDetailsService implements UserDetailsService {

    private final UsersRepository usersRepository;

    public CustomUserDetailsService(UsersRepository usersRepository) {
        this.usersRepository = usersRepository;
    }

    /**
     * The "username" is the user id as a string (see CustomUserDetails#getUsername) - the actual
     * email/mobile a person typed is resolved to an id by LoginIdentityService before this runs.
     * A non-numeric value (e.g. a token issued before the id-subject switch, which carried an
     * email) is simply "not found", so those tokens fail validation and the user signs in again.
     *
     * Transactional so the lazy Users.society association can still be read while building
     * CustomUserDetails. Callers include JwtAuthenticationFilter, which runs before Spring Boot's
     * open-in-view session is bound to the request — without an explicit transaction here, reading
     * society fields there throws LazyInitializationException and silently fails authentication.
     */
    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String userId) throws UsernameNotFoundException {
        Long id = parseId(userId);
        return usersRepository.findById(id)
                .map(CustomUserDetails::new)
                .orElseThrow(() -> {
                    log.debug("No user found for id: {}", userId);
                    return new UsernameNotFoundException("No user found with id: " + userId);
                });
    }

    private Long parseId(String value) {
        try {
            return Long.valueOf(value);
        } catch (NumberFormatException e) {
            throw new UsernameNotFoundException("Not a user id: " + value);
        }
    }
}
