package com.veenagroup.central.dashboard.config;

import com.veenagroup.central.dashboard.entity.Users;
import com.veenagroup.central.dashboard.entity.enums.Role;
import com.veenagroup.central.dashboard.repository.UsersRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class SuperAdminSeeder implements ApplicationRunner {

    private final UsersRepository usersRepository;
    private final PasswordEncoder passwordEncoder;
    private final String seedEmail;
    private final String seedPassword;
    private final String seedName;

    public SuperAdminSeeder(UsersRepository usersRepository,
                             PasswordEncoder passwordEncoder,
                             @Value("${app.super-admin.email}") String seedEmail,
                             @Value("${app.super-admin.password}") String seedPassword,
                             @Value("${app.super-admin.name}") String seedName) {
        this.usersRepository = usersRepository;
        this.passwordEncoder = passwordEncoder;
        this.seedEmail = seedEmail;
        this.seedPassword = seedPassword;
        this.seedName = seedName;
    }

    @Override
    public void run(ApplicationArguments args) {
        boolean superAdminExists = usersRepository.findByEmail(seedEmail).isPresent();
        if (superAdminExists) {
            log.info("Super-admin account already exists, skipping creation");
            return;
        }

        log.info("Creating initial super-admin account: {}", seedEmail);

        Users superAdmin = Users.builder()
                .society(null)
                .name(seedName)
                .email(seedEmail)
                .role(Role.SUPER_ADMIN)
                .passwordHash(passwordEncoder.encode(seedPassword))
                .build();

        usersRepository.save(superAdmin);
    }
}
