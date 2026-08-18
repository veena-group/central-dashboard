package com.veenagroup.central.dashboard.repository;

import com.veenagroup.central.dashboard.entity.Form;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;

public interface FormRepository extends JpaRepository<Form, Long>, JpaSpecificationExecutor<Form> {

    List<Form> findBySocietyId(Long societyId);

    Page<Form> findBySocietyId(Long societyId, Pageable pageable);

    List<Form> findBySocietyIdAndIsPublicTrue(Long societyId);

    long countBySocietyId(Long societyId);
}
