package com.veenagroup.central.dashboard.service;

import com.veenagroup.central.dashboard.dto.superadmin.FeatureConfigRequest;
import com.veenagroup.central.dashboard.dto.superadmin.FeatureResponse;
import com.veenagroup.central.dashboard.entity.Society;
import com.veenagroup.central.dashboard.entity.SocietyFeature;
import com.veenagroup.central.dashboard.exception.BusinessException;
import com.veenagroup.central.dashboard.repository.SocietyFeatureRepository;
import com.veenagroup.central.dashboard.repository.SocietyRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
public class SocietyFeatureService {

    private final SocietyRepository societyRepository;
    private final SocietyFeatureRepository societyFeatureRepository;

    public SocietyFeatureService(SocietyRepository societyRepository,
                                  SocietyFeatureRepository societyFeatureRepository) {
        this.societyRepository = societyRepository;
        this.societyFeatureRepository = societyFeatureRepository;
    }

    public List<FeatureResponse> getFeatures(Long societyId) {
        return societyFeatureRepository.findBySocietyId(societyId).stream()
                .map(this::toResponse)
                .toList();
    }

    /**
     * Blunt but safe: this is a rare admin action, so evicting every cached "is feature X enabled"
     * entry rather than tracking exactly which societyId+featureKey pairs changed keeps this simple
     * without risking a stale flag surviving an update.
     */
    @Transactional
    @CacheEvict(cacheNames = "societyFeatureEnabled", allEntries = true)
    public List<FeatureResponse> updateFeatures(Long societyId, List<FeatureConfigRequest> updates) {
        Society society = societyRepository.findById(societyId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "SOCIETY_NOT_FOUND", "Society not found"));

        for (FeatureConfigRequest update : updates) {
            if (update.enabled() && (update.limit() == null || update.limit() < 1)) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "INVALID_FEATURE_LIMIT",
                        "Feature " + update.featureKey() + " is enabled but has no valid limit");
            }

            SocietyFeature feature = societyFeatureRepository
                    .findBySocietyIdAndFeatureKey(societyId, update.featureKey())
                    .orElseGet(() -> SocietyFeature.builder()
                            .society(society)
                            .featureKey(update.featureKey())
                            .build());

            feature.setEnabled(update.enabled());
            feature.setLimit(update.limit() != null ? update.limit() : 0);
            societyFeatureRepository.save(feature);
        }

        log.info("Updated {} feature(s) for society {}", updates.size(), societyId);
        return getFeatures(societyId);
    }

    private FeatureResponse toResponse(SocietyFeature feature) {
        return new FeatureResponse(feature.getId(), feature.getFeatureKey().name(), feature.isEnabled(), feature.getLimit());
    }
}
