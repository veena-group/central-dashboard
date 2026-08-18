package com.veenagroup.central.dashboard.repository;

import com.veenagroup.central.dashboard.entity.Payment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, Long> {

    List<Payment> findBySocietyId(Long societyId);

    Page<Payment> findBySocietyId(Long societyId, Pageable pageable);

    Optional<Payment> findTopBySocietyIdOrderByNextDueDateDesc(Long societyId);

    List<Payment> findBySocietyIdIn(List<Long> societyIds);
}
