package com.veenagroup.central.dashboard.service;

import com.veenagroup.central.dashboard.dto.admin.CommitteeRequest;
import com.veenagroup.central.dashboard.dto.admin.CommitteeResponse;
import com.veenagroup.central.dashboard.entity.Committee;
import com.veenagroup.central.dashboard.entity.Society;
import com.veenagroup.central.dashboard.entity.enums.FeatureKey;
import com.veenagroup.central.dashboard.exception.BusinessException;
import com.veenagroup.central.dashboard.repository.CommitteeRepository;
import com.veenagroup.central.dashboard.repository.SocietyRepository;
import com.veenagroup.central.dashboard.storage.FileStorageService;
import com.veenagroup.central.dashboard.web.PageResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Slf4j
@Service
public class CommitteeService {

    private final CommitteeRepository committeeRepository;
    private final SocietyRepository societyRepository;
    private final FeatureLimitService featureLimitService;
    private final FileStorageService fileStorageService;

    public CommitteeService(CommitteeRepository committeeRepository,
                             SocietyRepository societyRepository,
                             FeatureLimitService featureLimitService,
                             FileStorageService fileStorageService) {
        this.committeeRepository = committeeRepository;
        this.societyRepository = societyRepository;
        this.featureLimitService = featureLimitService;
        this.fileStorageService = fileStorageService;
    }

    @Transactional
    public CommitteeResponse create(Long societyId, CommitteeRequest request) {
        featureLimitService.assertCanCreate(societyId, FeatureKey.COMMITTEE, () -> committeeRepository.countBySocietyId(societyId));

        Society society = societyRepository.findById(societyId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "SOCIETY_NOT_FOUND", "Society not found"));

        Committee committee = Committee.builder()
                .society(society)
                .name(request.name())
                .designation(request.designation())
                .flat(request.flat())
                .phone(request.phone())
                .email(request.email())
                .servingSince(request.servingSince())
                .build();

        Committee saved = committeeRepository.save(committee);
        log.info("Created committee member {} for society {}", saved.getId(), societyId);
        return toResponse(saved);
    }

    public List<CommitteeResponse> list(Long societyId) {
        return committeeRepository.findBySocietyId(societyId).stream().map(this::toResponse).toList();
    }

    public PageResponse<CommitteeResponse> list(Long societyId, Pageable pageable, String search) {
        featureLimitService.assertEnabled(societyId, FeatureKey.COMMITTEE);
        Specification<Committee> spec = buildSpecification(societyId, search);
        return PageResponse.of(committeeRepository.findAll(spec, pageable).map(this::toResponse));
    }

    private Specification<Committee> buildSpecification(Long societyId, String search) {
        Specification<Committee> spec = (root, query, cb) -> cb.equal(root.get("society").get("id"), societyId);

        if (search != null && !search.isBlank()) {
            String pattern = "%" + search.trim().toLowerCase() + "%";
            spec = spec.and((root, query, cb) -> cb.or(
                    cb.like(cb.lower(root.get("name")), pattern),
                    cb.like(cb.lower(cb.coalesce(root.<String>get("designation"), "")), pattern)));
        }
        return spec;
    }

    public CommitteeResponse getById(Long societyId, Long committeeId) {
        return toResponse(findOwned(societyId, committeeId));
    }

    @Transactional
    public CommitteeResponse update(Long societyId, Long committeeId, CommitteeRequest request) {
        Committee committee = findOwned(societyId, committeeId);
        committee.setName(request.name());
        committee.setDesignation(request.designation());
        committee.setFlat(request.flat());
        committee.setPhone(request.phone());
        committee.setEmail(request.email());
        committee.setServingSince(request.servingSince());
        Committee updated = committeeRepository.save(committee);
        log.info("Updated committee member {} for society {}", updated.getId(), societyId);
        return toResponse(updated);
    }

    @Transactional
    public CommitteeResponse uploadPhoto(Long societyId, Long committeeId, MultipartFile file) {
        Committee committee = findOwned(societyId, committeeId);
        if (committee.getPhotoUrl() != null) {
            fileStorageService.deleteAfterCommit(committee.getPhotoUrl());
        }
        String path = fileStorageService.store(file, societyId, "committee");
        committee.setPhotoUrl(path);
        Committee updated = committeeRepository.save(committee);
        log.info("Uploaded photo for committee member {} in society {}", updated.getId(), societyId);
        return toResponse(updated);
    }

    @Transactional
    public void delete(Long societyId, Long committeeId) {
        Committee committee = findOwned(societyId, committeeId);
        if (committee.getPhotoUrl() != null) {
            fileStorageService.deleteAfterCommit(committee.getPhotoUrl());
        }
        committeeRepository.delete(committee);
        log.info("Deleted committee member {} for society {}", committeeId, societyId);
    }

    private Committee findOwned(Long societyId, Long committeeId) {
        Committee committee = committeeRepository.findById(committeeId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "COMMITTEE_NOT_FOUND", "Committee member not found"));
        if (!committee.getSociety().getId().equals(societyId)) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "COMMITTEE_NOT_FOUND", "Committee member not found");
        }
        return committee;
    }

    private CommitteeResponse toResponse(Committee committee) {
        return new CommitteeResponse(
                committee.getId(), committee.getName(), committee.getDesignation(), committee.getFlat(),
                committee.getPhone(), committee.getEmail(), committee.getServingSince(),
                committee.getPhotoUrl(), committee.getCreatedAt()
        );
    }
}
