package com.veenagroup.central.dashboard.repository;

import com.veenagroup.central.dashboard.entity.Notice;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.time.LocalDate;
import java.util.List;

public interface NoticeRepository extends JpaRepository<Notice, Long>, JpaSpecificationExecutor<Notice> {

    List<Notice> findBySocietyId(Long societyId);

    Page<Notice> findBySocietyId(Long societyId, Pageable pageable);

    long countBySocietyId(Long societyId);

    List<Notice> findBySocietyIdAndIsPublicTrueAndPublishOnLessThanEqualAndExpireOnGreaterThanEqual(
            Long societyId, LocalDate publishOnBefore, LocalDate expireOnAfter);

    List<Notice> findBySocietyIdAndPublishOnLessThanEqualAndExpireOnGreaterThanEqualOrderByPublishOnDesc(
            Long societyId, LocalDate publishOnBefore, LocalDate expireOnAfter, Pageable pageable);
}
