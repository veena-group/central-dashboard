package com.veenagroup.central.dashboard.service;

import com.veenagroup.central.dashboard.dto.admin.CategoryRequest;
import com.veenagroup.central.dashboard.dto.admin.CategoryResponse;
import com.veenagroup.central.dashboard.entity.Category;
import com.veenagroup.central.dashboard.entity.Society;
import com.veenagroup.central.dashboard.entity.enums.CategoryType;
import com.veenagroup.central.dashboard.exception.BusinessException;
import com.veenagroup.central.dashboard.repository.CategoryRepository;
import com.veenagroup.central.dashboard.repository.SocietyRepository;
import com.veenagroup.central.dashboard.web.PageResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
public class CategoryService {

    private final CategoryRepository categoryRepository;
    private final SocietyRepository societyRepository;

    public CategoryService(CategoryRepository categoryRepository, SocietyRepository societyRepository) {
        this.categoryRepository = categoryRepository;
        this.societyRepository = societyRepository;
    }

    @Transactional
    public CategoryResponse create(Long societyId, CategoryRequest request) {
        Society society = societyRepository.findById(societyId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "SOCIETY_NOT_FOUND", "Society not found"));

        String name = request.name().trim();
        if (categoryRepository.existsBySocietyIdAndTypeAndNameIgnoreCase(societyId, request.type(), name)) {
            throw new BusinessException(HttpStatus.CONFLICT, "CATEGORY_ALREADY_EXISTS",
                    "A " + request.type().name() + " category named '" + name + "' already exists for this society");
        }

        Category category = Category.builder()
                .society(society)
                .type(request.type())
                .name(name)
                .active(true)
                .build();

        Category saved = categoryRepository.save(category);
        log.info("Created category {} ({}) for society {}", saved.getId(), saved.getType(), societyId);
        return toResponse(saved);
    }

    public List<CategoryResponse> list(Long societyId, CategoryType type, boolean activeOnly) {
        List<Category> categories = activeOnly
                ? categoryRepository.findBySocietyIdAndTypeAndActive(societyId, type, true)
                : categoryRepository.findBySocietyIdAndType(societyId, type);
        return categories.stream().map(this::toResponse).toList();
    }

    public PageResponse<CategoryResponse> list(Long societyId, CategoryType type, boolean activeOnly, Pageable pageable) {
        var categories = activeOnly
                ? categoryRepository.findBySocietyIdAndTypeAndActive(societyId, type, true, pageable)
                : categoryRepository.findBySocietyIdAndType(societyId, type, pageable);
        return PageResponse.of(categories.map(this::toResponse));
    }

    @Transactional
    public void setActive(Long societyId, Long categoryId, boolean active) {
        Category category = findOwned(societyId, categoryId);
        category.setActive(active);
        categoryRepository.save(category);
        log.info("{} category {} for society {}", active ? "Activated" : "Deactivated", categoryId, societyId);
    }

    private Category findOwned(Long societyId, Long categoryId) {
        Category category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "CATEGORY_NOT_FOUND", "Category not found"));
        if (!category.getSociety().getId().equals(societyId)) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "CATEGORY_NOT_FOUND", "Category not found");
        }
        return category;
    }

    private CategoryResponse toResponse(Category category) {
        return new CategoryResponse(category.getId(), category.getType().name(), category.getName(), category.isActive());
    }
}
