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
     * Transactional so the lazy Users.society association can still be read while building
     * CustomUserDetails. Callers include JwtAuthenticationFilter, which runs before Spring Boot's
     * open-in-view session is bound to the request — without an explicit transaction here, reading
     * society fields there throws LazyInitializationException and silently fails authentication.
     */
    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        return usersRepository.findByEmail(email)
                .map(CustomUserDetails::new)
                .orElseThrow(() -> {
                    log.debug("No user found for email: {}", email);
                    return new UsernameNotFoundException("No user found with email: " + email);
                });
    }
}
