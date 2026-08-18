package com.veenagroup.central.dashboard.controller;

import com.veenagroup.central.dashboard.dto.admin.CategoryRequest;
import com.veenagroup.central.dashboard.dto.admin.CategoryResponse;
import com.veenagroup.central.dashboard.entity.enums.CategoryType;
import com.veenagroup.central.dashboard.security.CurrentUser;
import com.veenagroup.central.dashboard.service.CategoryService;
import com.veenagroup.central.dashboard.web.ApiResponse;
import com.veenagroup.central.dashboard.web.PageResponse;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/admin/categories")
public class CategoryController {

    private final CategoryService categoryService;
    private final CurrentUser currentUser;

    public CategoryController(CategoryService categoryService, CurrentUser currentUser) {
        this.categoryService = categoryService;
        this.currentUser = currentUser;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<CategoryResponse>> create(@Valid @RequestBody CategoryRequest request) {
        Long societyId = currentUser.requireSocietyId();
        log.info("Creating category '{}' for society {}", request.name(), societyId);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of("Category created successfully", categoryService.create(societyId, request)));
    }

    @GetMapping
    public ApiResponse<PageResponse<CategoryResponse>> list(@RequestParam CategoryType type,
                                        @RequestParam(defaultValue = "true") boolean activeOnly,
                                        @RequestParam(defaultValue = "0") int page,
                                        @RequestParam(defaultValue = "20") int size) {
        Long societyId = currentUser.requireSocietyId();
        Pageable pageable = PageRequest.of(page, size, Sort.by("id"));
        return ApiResponse.of("Categories fetched successfully", categoryService.list(societyId, type, activeOnly, pageable));
    }

    @PutMapping("/{categoryId}/active")
    public ResponseEntity<ApiResponse<Void>> setActive(@PathVariable Long categoryId, @RequestParam boolean active) {
        Long societyId = currentUser.requireSocietyId();
        log.info("Setting category {} active={} for society {}", categoryId, active, societyId);
        categoryService.setActive(societyId, categoryId, active);
        return ResponseEntity.ok(ApiResponse.of(active ? "Category activated successfully" : "Category deactivated successfully", null));
    }
}
