package com.veenagroup.central.dashboard.repository;

import com.veenagroup.central.dashboard.entity.Gallery;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;

public interface GalleryRepository extends JpaRepository<Gallery, Long>, JpaSpecificationExecutor<Gallery> {

    List<Gallery> findBySocietyId(Long societyId);

    Page<Gallery> findBySocietyId(Long societyId, Pageable pageable);

    List<Gallery> findBySocietyIdAndIsPublicTrue(Long societyId);

    long countBySocietyId(Long societyId);
}
