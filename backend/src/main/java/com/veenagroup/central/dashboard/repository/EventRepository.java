package com.veenagroup.central.dashboard.repository;

import com.veenagroup.central.dashboard.entity.Event;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;

public interface EventRepository extends JpaRepository<Event, Long>, JpaSpecificationExecutor<Event> {

    List<Event> findBySocietyId(Long societyId);

    Page<Event> findBySocietyId(Long societyId, Pageable pageable);

    long countBySocietyId(Long societyId);
}
