package com.veenagroup.central.dashboard.repository;

import com.veenagroup.central.dashboard.entity.Category;
import com.veenagroup.central.dashboard.entity.enums.CategoryType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CategoryRepository extends JpaRepository<Category, Long> {

    List<Category> findBySocietyIdAndType(Long societyId, CategoryType type);

    List<Category> findBySocietyIdAndTypeAndActive(Long societyId, CategoryType type, boolean active);

    Page<Category> findBySocietyIdAndType(Long societyId, CategoryType type, Pageable pageable);

    Page<Category> findBySocietyIdAndTypeAndActive(Long societyId, CategoryType type, boolean active, Pageable pageable);

    boolean existsBySocietyIdAndTypeAndNameIgnoreCase(Long societyId, CategoryType type, String name);
}
