package com.veenagroup.central.dashboard.repository;

import com.veenagroup.central.dashboard.entity.SocietyFeature;
import com.veenagroup.central.dashboard.entity.enums.FeatureKey;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SocietyFeatureRepository extends JpaRepository<SocietyFeature, Long> {

    List<SocietyFeature> findBySocietyId(Long societyId);

    Optional<SocietyFeature> findBySocietyIdAndFeatureKey(Long societyId, FeatureKey featureKey);

    /**
     * Locks the feature row for the duration of the caller's transaction, so two concurrent
     * "check limit, then create" requests for the same society+feature can't both read the same
     * pre-insert count and both pass the check (see FeatureLimitService.assertCanCreate).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT sf FROM SocietyFeature sf WHERE sf.society.id = :societyId AND sf.featureKey = :featureKey")
    Optional<SocietyFeature> findBySocietyIdAndFeatureKeyForUpdate(@Param("societyId") Long societyId,
                                                                     @Param("featureKey") FeatureKey featureKey);
}
