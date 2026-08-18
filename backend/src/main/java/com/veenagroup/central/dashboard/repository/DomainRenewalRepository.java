package com.veenagroup.central.dashboard.repository;

import com.veenagroup.central.dashboard.entity.DomainRenewal;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DomainRenewalRepository extends JpaRepository<DomainRenewal, Long> {

    List<DomainRenewal> findBySocietyIdOrderByExpiryDateDesc(Long societyId);

    Optional<DomainRenewal> findTopBySocietyIdOrderByExpiryDateDesc(Long societyId);

    List<DomainRenewal> findBySocietyIdIn(List<Long> societyIds);
}
