package com.veenagroup.central.dashboard.service;

import com.veenagroup.central.dashboard.entity.SocietyFeature;
import com.veenagroup.central.dashboard.entity.enums.FeatureKey;
import com.veenagroup.central.dashboard.exception.BusinessException;
import com.veenagroup.central.dashboard.repository.SocietyFeatureRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.function.LongSupplier;

@Slf4j
@Service
public class FeatureLimitService {

    private final SocietyFeatureRepository societyFeatureRepository;

    public FeatureLimitService(SocietyFeatureRepository societyFeatureRepository) {
        this.societyFeatureRepository = societyFeatureRepository;
    }

    public void assertEnabled(Long societyId, FeatureKey key) {
        SocietyFeature feature = societyFeatureRepository.findBySocietyIdAndFeatureKey(societyId, key)
                .orElseThrow(() -> new BusinessException(HttpStatus.FORBIDDEN, "FEATURE_NOT_CONFIGURED",
                        key + " is not configured for this society"));

        if (!feature.isEnabled()) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "FEATURE_NOT_ENABLED", key + " is not enabled for this society");
        }
    }

    /**
     * Used only for display-gating on the public, unauthenticated society site (PublicContentService),
     * which is hit far more often and by anyone, not just logged-in staff - a 5-minute-stale "enabled"
     * flag there is harmless. Evicted wholesale whenever a society's features are edited
     * (SocietyFeatureService.updateFeatures), so real changes still show up quickly.
     */
    @Cacheable(cacheNames = "societyFeatureEnabled", key = "#societyId + '-' + #key")
    public boolean isEnabledCached(Long societyId, FeatureKey key) {
        return societyFeatureRepository.findBySocietyIdAndFeatureKey(societyId, key)
                .map(SocietyFeature::isEnabled)
                .orElse(false);
    }

    /**
     * countSupplier is only invoked AFTER the feature row is locked (SELECT ... FOR UPDATE), and the
     * lock is held for the rest of the caller's transaction (every call site is @Transactional). This
     * forces two concurrent create requests for the same society+feature to serialize: the second one
     * only runs its count query once the first has committed its insert, so it sees the up-to-date
     * count instead of racing the first request's pre-insert count and both slipping past the limit.
     */
    public void assertCanCreate(Long societyId, FeatureKey key, LongSupplier countSupplier) {
        SocietyFeature feature = societyFeatureRepository.findBySocietyIdAndFeatureKeyForUpdate(societyId, key)
                .orElseThrow(() -> new BusinessException(HttpStatus.FORBIDDEN, "FEATURE_NOT_CONFIGURED",
                        key + " is not configured for this society"));

        if (!feature.isEnabled()) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "FEATURE_NOT_ENABLED", key + " is not enabled for this society");
        }
        if (countSupplier.getAsLong() >= feature.getLimit()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "FEATURE_LIMIT_EXCEEDED",
                    key + " limit of " + feature.getLimit() + " reached for this society");
        }
    }
}
