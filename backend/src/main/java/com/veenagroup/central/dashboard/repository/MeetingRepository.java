package com.veenagroup.central.dashboard.repository;

import com.veenagroup.central.dashboard.entity.Meeting;
import com.veenagroup.central.dashboard.entity.enums.MeetingStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.time.LocalDate;
import java.util.List;

public interface MeetingRepository extends JpaRepository<Meeting, Long>, JpaSpecificationExecutor<Meeting> {

    List<Meeting> findBySocietyId(Long societyId);

    Page<Meeting> findBySocietyId(Long societyId, Pageable pageable);

    List<Meeting> findBySocietyIdAndIsPublicTrue(Long societyId);

    List<Meeting> findBySocietyIdAndStatusAndMeetingDateGreaterThanEqualOrderByMeetingDateAsc(
            Long societyId, MeetingStatus status, LocalDate meetingDate, Pageable pageable);

    long countBySocietyId(Long societyId);
}
