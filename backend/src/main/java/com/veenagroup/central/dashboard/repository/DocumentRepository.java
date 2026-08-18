package com.veenagroup.central.dashboard.repository;

import com.veenagroup.central.dashboard.entity.Document;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;

public interface DocumentRepository extends JpaRepository<Document, Long>, JpaSpecificationExecutor<Document> {

    List<Document> findBySocietyId(Long societyId);

    Page<Document> findBySocietyId(Long societyId, Pageable pageable);

    List<Document> findBySocietyIdAndIsPublicTrue(Long societyId);

    long countBySocietyId(Long societyId);
}
