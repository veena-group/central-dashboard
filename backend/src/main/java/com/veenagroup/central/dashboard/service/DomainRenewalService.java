package com.veenagroup.central.dashboard.service;

import com.veenagroup.central.dashboard.dto.superadmin.DomainRenewalRequest;
import com.veenagroup.central.dashboard.dto.superadmin.DomainRenewalResponse;
import com.veenagroup.central.dashboard.entity.DomainRenewal;
import com.veenagroup.central.dashboard.entity.Society;
import com.veenagroup.central.dashboard.exception.BusinessException;
import com.veenagroup.central.dashboard.repository.DomainRenewalRepository;
import com.veenagroup.central.dashboard.repository.SocietyRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
public class DomainRenewalService {

    private final SocietyRepository societyRepository;
    private final DomainRenewalRepository domainRenewalRepository;

    public DomainRenewalService(SocietyRepository societyRepository, DomainRenewalRepository domainRenewalRepository) {
        this.societyRepository = societyRepository;
        this.domainRenewalRepository = domainRenewalRepository;
    }

    @Transactional
    public DomainRenewalResponse addRenewal(Long societyId, DomainRenewalRequest request) {
        if (request.expiryDate().isBefore(request.startDate())) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "INVALID_DOMAIN_PERIOD", "Expiry date must be on or after the start date");
        }

        Society society = societyRepository.findById(societyId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "SOCIETY_NOT_FOUND", "Society not found"));

        DomainRenewal renewal = DomainRenewal.builder()
                .society(society)
                .startDate(request.startDate())
                .expiryDate(request.expiryDate())
                .notes(normalize(request.notes()))
                .build();

        DomainRenewal saved = domainRenewalRepository.save(renewal);
        log.info("Recorded domain renewal {} for society {}: expires {}", saved.getId(), societyId, saved.getExpiryDate());
        return toResponse(saved);
    }

    public List<DomainRenewalResponse> listRenewals(Long societyId) {
        return domainRenewalRepository.findBySocietyIdOrderByExpiryDateDesc(societyId).stream()
                .map(this::toResponse)
                .toList();
    }

    private DomainRenewalResponse toResponse(DomainRenewal renewal) {
        return new DomainRenewalResponse(renewal.getId(), renewal.getStartDate(), renewal.getExpiryDate(),
                renewal.getNotes(), renewal.getCreatedAt());
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
