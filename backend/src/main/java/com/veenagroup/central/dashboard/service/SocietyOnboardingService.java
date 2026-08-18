package com.veenagroup.central.dashboard.service;

import com.veenagroup.central.dashboard.dto.superadmin.FeatureConfigRequest;
import com.veenagroup.central.dashboard.dto.superadmin.OnboardSocietyRequest;
import com.veenagroup.central.dashboard.dto.superadmin.OnboardSocietyResponse;
import com.veenagroup.central.dashboard.entity.DomainRenewal;
import com.veenagroup.central.dashboard.entity.Society;
import com.veenagroup.central.dashboard.entity.SocietyFeature;
import com.veenagroup.central.dashboard.entity.Users;
import com.veenagroup.central.dashboard.entity.enums.FeatureKey;
import com.veenagroup.central.dashboard.entity.enums.Role;
import com.veenagroup.central.dashboard.exception.BusinessException;
import com.veenagroup.central.dashboard.repository.DomainRenewalRepository;
import com.veenagroup.central.dashboard.repository.SocietyFeatureRepository;
import com.veenagroup.central.dashboard.repository.SocietyRepository;
import com.veenagroup.central.dashboard.repository.UsersRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class SocietyOnboardingService {

    private final SocietyRepository societyRepository;
    private final UsersRepository usersRepository;
    private final SocietyFeatureRepository societyFeatureRepository;
    private final DomainRenewalRepository domainRenewalRepository;
    private final PasswordEncoder passwordEncoder;

    public SocietyOnboardingService(SocietyRepository societyRepository,
                                     UsersRepository usersRepository,
                                     SocietyFeatureRepository societyFeatureRepository,
                                     DomainRenewalRepository domainRenewalRepository,
                                     PasswordEncoder passwordEncoder) {
        this.societyRepository = societyRepository;
        this.usersRepository = usersRepository;
        this.societyFeatureRepository = societyFeatureRepository;
        this.domainRenewalRepository = domainRenewalRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public OnboardSocietyResponse onboard(OnboardSocietyRequest request) {
        log.info("Onboarding new society: {}", request.societyName());
        if (request.domainExpiryDate().isBefore(request.domainStartDate())) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "INVALID_DOMAIN_PERIOD", "Domain expiry date must be on or after the start date");
        }
        if (societyRepository.findByDomain(request.domain()).isPresent()) {
            throw new BusinessException(HttpStatus.CONFLICT, "DOMAIN_ALREADY_IN_USE", "Domain already in use");
        }
        if (usersRepository.findByEmail(request.adminEmail()).isPresent()) {
            throw new BusinessException(HttpStatus.CONFLICT, "EMAIL_ALREADY_IN_USE", "Email already in use");
        }

        Society society = Society.builder()
                .name(request.societyName())
                .domain(request.domain())
            .primaryColor(normalizeColor(request.primaryColor(), "#0F766E"))
            .secondaryColor(normalizeColor(request.secondaryColor(), "#F59E0B"))
                .build();
        society = societyRepository.save(society);

        domainRenewalRepository.save(DomainRenewal.builder()
                .society(society)
                .startDate(request.domainStartDate())
                .expiryDate(request.domainExpiryDate())
                .build());

        Users admin = Users.builder()
                .society(society)
                .name(request.adminName())
                .email(request.adminEmail())
                .phone(request.adminPhone())
                .role(Role.SOCIETY_ADMIN)
                .passwordHash(passwordEncoder.encode(request.adminPassword()))
                .build();
        admin = usersRepository.save(admin);

        List<SocietyFeature> features = buildFeatureRows(society, request.features());
        societyFeatureRepository.saveAll(features);

        log.info("Onboarded society {} (id={}, domain={}) with admin id {}",
                society.getName(), society.getId(), society.getDomain(), admin.getId());
        return new OnboardSocietyResponse(society.getId(), society.getName(), society.getDomain(),
                admin.getId(), admin.getEmail());
    }

    private List<SocietyFeature> buildFeatureRows(Society society, List<FeatureConfigRequest> requested) {
        Map<FeatureKey, FeatureConfigRequest> byKey = new java.util.HashMap<>();
        for (FeatureConfigRequest fc : requested) {
            byKey.put(fc.featureKey(), fc);
        }

        List<SocietyFeature> rows = new ArrayList<>();
        for (FeatureKey key : FeatureKey.values()) {
            FeatureConfigRequest fc = byKey.get(key);
            boolean enabled = fc != null && fc.enabled();
            Integer limit = fc != null ? fc.limit() : null;

            if (enabled && (limit == null || limit < 1)) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "INVALID_FEATURE_LIMIT",
                        "Feature " + key + " is enabled but has no valid limit");
            }
            if (limit == null) {
                limit = 0;
            }

            rows.add(SocietyFeature.builder()
                    .society(society)
                    .featureKey(key)
                    .enabled(enabled)
                    .limit(limit)
                    .build());
        }
        return rows;
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String normalizeColor(String value, String fallback) {
        String normalized = normalize(value);
        if (normalized == null) {
            return fallback;
        }
        if (!normalized.startsWith("#")) {
            normalized = "#" + normalized;
        }
        return normalized.matches("^#[0-9a-fA-F]{6}$") ? normalized.toUpperCase() : fallback;
    }
}
