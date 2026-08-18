package com.veenagroup.central.dashboard.service;

import com.veenagroup.central.dashboard.dto.superadmin.PlatformStatsResponse;
import com.veenagroup.central.dashboard.dto.superadmin.SocietyAdminResponse;
import com.veenagroup.central.dashboard.dto.superadmin.SocietyResponse;
import com.veenagroup.central.dashboard.dto.superadmin.UpdateSocietyRequest;
import com.veenagroup.central.dashboard.entity.DomainRenewal;
import com.veenagroup.central.dashboard.entity.Payment;
import com.veenagroup.central.dashboard.entity.Society;
import com.veenagroup.central.dashboard.entity.enums.Role;
import com.veenagroup.central.dashboard.exception.BusinessException;
import com.veenagroup.central.dashboard.repository.DomainRenewalRepository;
import com.veenagroup.central.dashboard.repository.PaymentRepository;
import com.veenagroup.central.dashboard.repository.SocietyRepository;
import com.veenagroup.central.dashboard.repository.UsersRepository;
import com.veenagroup.central.dashboard.storage.FileStorageService;
import com.veenagroup.central.dashboard.web.PageResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class SocietyService {

    private static final int EXPIRING_SOON_DAYS = 30;

    private final SocietyRepository societyRepository;
    private final UsersRepository usersRepository;
    private final DomainRenewalRepository domainRenewalRepository;
    private final PaymentRepository paymentRepository;
    private final FileStorageService fileStorageService;

    public SocietyService(SocietyRepository societyRepository,
                           UsersRepository usersRepository,
                           DomainRenewalRepository domainRenewalRepository,
                           PaymentRepository paymentRepository,
                           FileStorageService fileStorageService) {
        this.societyRepository = societyRepository;
        this.usersRepository = usersRepository;
        this.domainRenewalRepository = domainRenewalRepository;
        this.paymentRepository = paymentRepository;
        this.fileStorageService = fileStorageService;
    }

    public PageResponse<SocietyResponse> getAll(Pageable pageable, String search, String hostingStateFilter, String subscriptionStateFilter) {
        List<Society> allSocieties = societyRepository.findAll(Sort.by("id"));
        List<Long> allIds = allSocieties.stream().map(Society::getId).toList();

        Map<Long, LocalDate> hostingExpiryBySociety = latestHostingExpiryBySociety(domainRenewalRepository.findBySocietyIdIn(allIds));
        Map<Long, LocalDate> nextDueBySociety = latestNextDueBySociety(paymentRepository.findBySocietyIdIn(allIds));

        String normalizedSearch = search == null ? null : search.trim().toLowerCase();

        List<SocietyResponse> filtered = allSocieties.stream()
                .map(society -> toResponse(society, hostingExpiryBySociety.get(society.getId()), nextDueBySociety.get(society.getId())))
                .filter(r -> normalizedSearch == null || normalizedSearch.isBlank()
                        || r.name().toLowerCase().contains(normalizedSearch)
                        || r.domain().toLowerCase().contains(normalizedSearch))
                .filter(r -> hostingStateFilter == null || hostingStateFilter.isBlank()
                        || r.hostingState().equalsIgnoreCase(hostingStateFilter))
                .filter(r -> subscriptionStateFilter == null || subscriptionStateFilter.isBlank()
                        || r.subscriptionState().equalsIgnoreCase(subscriptionStateFilter))
                .toList();

        int start = Math.min((int) pageable.getOffset(), filtered.size());
        int end = Math.min(start + pageable.getPageSize(), filtered.size());

        return PageResponse.of(new PageImpl<>(filtered.subList(start, end), pageable, filtered.size()));
    }

    public SocietyResponse getById(Long id) {
        Society society = findOrThrow(id);
        LocalDate hostingExpiry = domainRenewalRepository.findTopBySocietyIdOrderByExpiryDateDesc(id)
                .map(DomainRenewal::getExpiryDate).orElse(null);
        LocalDate nextDue = paymentRepository.findTopBySocietyIdOrderByNextDueDateDesc(id)
                .map(Payment::getNextDueDate).orElse(null);
        return toResponse(society, hostingExpiry, nextDue);
    }

    /** Evicts the cached domain->society lookup in case `request.domain()` differs from the current one. */
    @Transactional
    @CacheEvict(cacheNames = "societyByDomain", allEntries = true)
    public SocietyResponse update(Long id, UpdateSocietyRequest request) {
        Society society = findOrThrow(id);

        societyRepository.findByDomain(request.domain())
                .filter(existing -> !existing.getId().equals(id))
                .ifPresent(existing -> {
                    throw new BusinessException(HttpStatus.CONFLICT, "DOMAIN_ALREADY_IN_USE", "Domain already in use");
                });

        society.setName(request.name());
        society.setDomain(request.domain());
        society.setPrimaryColor(normalizeColor(request.primaryColor(), society.getPrimaryColor(), "#0F766E"));
        society.setSecondaryColor(normalizeColor(request.secondaryColor(), society.getSecondaryColor(), "#F59E0B"));

        Society updated = societyRepository.save(society);
        log.info("Updated society {}", updated.getId());
        return getById(updated.getId());
    }

    @Transactional
    public SocietyResponse uploadLogo(Long societyId, MultipartFile file) {
        Society society = findOrThrow(societyId);
        if (society.getLogoUrl() != null) {
            fileStorageService.deleteAfterCommit(society.getLogoUrl());
        }
        String path = fileStorageService.store(file, societyId, "branding");
        society.setLogoUrl(path);
        Society updated = societyRepository.save(society);
        log.info("Uploaded logo for society {}", updated.getId());
        return getById(updated.getId());
    }

    public PlatformStatsResponse getStats() {
        List<Long> allIds = societyRepository.findAll().stream().map(Society::getId).toList();

        Map<Long, LocalDate> hostingExpiryBySociety = latestHostingExpiryBySociety(domainRenewalRepository.findAll());
        Map<Long, LocalDate> nextDueBySociety = latestNextDueBySociety(paymentRepository.findAll());

        long hostingActive = 0, hostingExpiringSoon = 0, hostingExpired = 0;
        long paidUp = 0, dueSoon = 0, overdue = 0;

        for (Long id : allIds) {
            switch (hostingState(hostingExpiryBySociety.get(id))) {
                case "ACTIVE" -> hostingActive++;
                case "EXPIRING_SOON" -> hostingExpiringSoon++;
                case "EXPIRED" -> hostingExpired++;
                default -> { }
            }
            switch (subscriptionState(nextDueBySociety.get(id))) {
                case "PAID_UP" -> paidUp++;
                case "DUE_SOON" -> dueSoon++;
                case "OVERDUE" -> overdue++;
                default -> { }
            }
        }

        return new PlatformStatsResponse(allIds.size(), hostingActive, hostingExpiringSoon, hostingExpired,
                paidUp, dueSoon, overdue);
    }

    public List<SocietyAdminResponse> listAdmins(Long societyId) {
        findOrThrow(societyId);
        return usersRepository.findBySocietyIdAndRole(societyId, Role.SOCIETY_ADMIN).stream()
                .map(user -> new SocietyAdminResponse(user.getId(), user.getName(), user.getEmail(), user.getPhone(), user.getCreatedAt()))
                .toList();
    }

    private Society findOrThrow(Long id) {
        return societyRepository.findById(id)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "SOCIETY_NOT_FOUND", "Society not found"));
    }

    private Map<Long, LocalDate> latestHostingExpiryBySociety(List<DomainRenewal> renewals) {
        Map<Long, LocalDate> result = new HashMap<>();
        for (DomainRenewal renewal : renewals) {
            result.merge(renewal.getSociety().getId(), renewal.getExpiryDate(),
                    (a, b) -> a.isAfter(b) ? a : b);
        }
        return result;
    }

    private Map<Long, LocalDate> latestNextDueBySociety(List<Payment> payments) {
        Map<Long, LocalDate> result = new HashMap<>();
        for (Payment payment : payments) {
            if (payment.getNextDueDate() == null) {
                continue;
            }
            result.merge(payment.getSociety().getId(), payment.getNextDueDate(),
                    (a, b) -> a.isAfter(b) ? a : b);
        }
        return result;
    }

    private String hostingState(LocalDate expiryDate) {
        if (expiryDate == null) {
            return "NONE";
        }
        LocalDate today = LocalDate.now();
        if (expiryDate.isBefore(today)) {
            return "EXPIRED";
        }
        if (!expiryDate.isAfter(today.plusDays(EXPIRING_SOON_DAYS))) {
            return "EXPIRING_SOON";
        }
        return "ACTIVE";
    }

    private String subscriptionState(LocalDate nextDueDate) {
        if (nextDueDate == null) {
            return "NONE";
        }
        LocalDate today = LocalDate.now();
        if (nextDueDate.isBefore(today)) {
            return "OVERDUE";
        }
        if (!nextDueDate.isAfter(today.plusDays(EXPIRING_SOON_DAYS))) {
            return "DUE_SOON";
        }
        return "PAID_UP";
    }

    private SocietyResponse toResponse(Society society, LocalDate hostingExpiry, LocalDate nextDue) {
        return new SocietyResponse(
                society.getId(),
                society.getName(),
                society.getDomain(),
                society.getLogoUrl(),
                society.getPrimaryColor(),
                society.getSecondaryColor(),
                hostingExpiry,
                hostingState(hostingExpiry),
                nextDue,
                subscriptionState(nextDue),
                society.getCreatedAt()
        );
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String normalizeColor(String value, String existing, String fallback) {
        String normalized = normalize(value);
        if (normalized == null) {
            if (normalize(existing) != null) {
                return existing;
            }
            return fallback;
        }
        if (!normalized.startsWith("#")) {
            normalized = "#" + normalized;
        }
        return normalized.matches("^#[0-9a-fA-F]{6}$") ? normalized.toUpperCase() : (normalize(existing) != null ? existing : fallback);
    }
}
