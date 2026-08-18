import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminContentApiService, CategoryOption, CategoryType } from '../../core/services/admin-content-api.service';
import { NotificationService } from '../../core/services/notification.service';
import { FeatureAccessService, FeatureKey } from '../../core/services/feature-access.service';
import { ConfirmModalComponent } from '../../shared/confirm-modal/confirm-modal.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { IconComponent } from '../../shared/icon/icon.component';

const CATEGORY_TYPE_FEATURE_KEY: Record<CategoryType, FeatureKey> = {
  NOTICE: 'NOTICES',
  DOCUMENT: 'DOCUMENTS',
  FORM: 'FORMS',
  MEETING: 'MEETINGS',
  GALLERY_ALBUM: 'GALLERY',
  EVENT: 'EVENTS'
};

@Component({
  selector: 'app-category-management',
  imports: [ReactiveFormsModule, ConfirmModalComponent, PaginationComponent, IconComponent],
  templateUrl: './category-management.component.html'
})
export class CategoryManagementComponent {
  private static readonly PAGE_SIZE = 10;

  private readonly api = inject(AdminContentApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(NotificationService);
  private readonly featureAccess = inject(FeatureAccessService);

  private readonly allCategoryTypes: CategoryType[] = ['NOTICE', 'DOCUMENT', 'FORM', 'MEETING', 'GALLERY_ALBUM', 'EVENT'];
  readonly categoryTypes = computed(() =>
    this.allCategoryTypes.filter((type) => this.featureAccess.isEnabled(CATEGORY_TYPE_FEATURE_KEY[type]))
  );
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly showAddModal = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly selectedType = signal<CategoryType>('NOTICE');
  readonly pendingDeactivateCategory = signal<CategoryOption | null>(null);
  readonly activeOnly = signal(false);
  readonly searchText = signal('');
  readonly rows = signal<CategoryOption[]>([]);
  readonly page = signal(0);
  readonly totalPages = signal(0);
  readonly first = signal(true);
  readonly last = signal(true);
  readonly filteredRows = computed(() => {
    const query = this.searchText().trim().toLowerCase();
    if (!query) {
      return this.rows();
    }

    return this.rows().filter((row) => row.name.toLowerCase().includes(query));
  });
  readonly activeRows = computed(() => this.filteredRows().filter((row) => row.active));
  readonly inactiveRows = computed(() => this.filteredRows().filter((row) => !row.active));
  readonly activeCount = computed(() => this.rows().filter((row) => row.active).length);
  readonly inactiveCount = computed(() => this.rows().filter((row) => !row.active).length);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]]
  });

  constructor() {
    const firstAvailable = this.categoryTypes()[0];
    if (firstAvailable) {
      this.selectedType.set(firstAvailable);
    }
    this.load(0);
  }

  setType(type: CategoryType): void {
    if (this.selectedType() === type) {
      return;
    }

    this.selectedType.set(type);
    this.showAddModal.set(false);
    this.success.set(null);
    this.load(0);
  }

  setActiveOnly(value: boolean): void {
    this.activeOnly.set(value);
    this.load(0);
  }

  setSearch(value: string): void {
    this.searchText.set(value);
  }

  openAddModal(): void {
    this.form.reset({ name: '' });
    this.error.set(null);
    this.success.set(null);
    this.showAddModal.set(true);
  }

  closeAddModal(): void {
    this.showAddModal.set(false);
  }

  getTypeLabel(type: CategoryType): string {
    switch (type) {
      case 'GALLERY_ALBUM':
        return 'Gallery Albums';
      case 'NOTICE':
        return 'Notices';
      case 'DOCUMENT':
        return 'Documents';
      case 'FORM':
        return 'Forms';
      case 'MEETING':
        return 'Meetings';
      case 'EVENT':
        return 'Events';
      default:
        return type;
    }
  }

  getTypeDescription(type: CategoryType): string {
    switch (type) {
      case 'NOTICE':
        return 'Manage notice categories used while creating and publishing notices.';
      case 'DOCUMENT':
        return 'Organize all official document categories for better filtering and access.';
      case 'FORM':
        return 'Control form categories to keep downloadable and submission forms structured.';
      case 'MEETING':
        return 'Define meeting categories for agendas, schedules, and records.';
      case 'GALLERY_ALBUM':
        return 'Manage album categories used in the media gallery.';
      case 'EVENT':
        return 'Manage event categories used when posting celebrations and society events.';
      default:
        return 'Manage category definitions.';
    }
  }

  load(page: number): void {
    this.loading.set(true);
    this.error.set(null);

    this.api.listCategories(this.selectedType(), this.activeOnly(), page, CategoryManagementComponent.PAGE_SIZE).subscribe({
      next: (response) => {
        this.rows.set(response.content);
        this.page.set(response.page);
        this.totalPages.set(response.totalPages);
        this.first.set(response.first);
        this.last.set(response.last);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Unable to load categories. Please try again.');
        this.toast.error('Unable to load categories. Please try again.');
        this.loading.set(false);
      }
    });
  }

  createCategory(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const name = this.form.controls.name.value.trim();
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);

    this.api.createCategory(this.selectedType(), name).subscribe({
      next: () => {
        this.saving.set(false);
        this.success.set('Category added successfully.');
        this.toast.success('Category added successfully.');
        this.form.reset({ name: '' });
        this.showAddModal.set(false);
        this.load(0);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        const message = err.error?.message || 'Unable to create category. Please try again.';
        this.error.set(message);
        this.toast.error(message);
      }
    });
  }

  onToggleActive(row: CategoryOption, active: boolean): void {
    if (active) {
      this.activateCategory(row);
    } else {
      this.requestDeactivateCategory(row);
    }
  }

  activateCategory(row: CategoryOption): void {
    if (row.active || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);

    this.api.setCategoryActive(row.id, true).subscribe({
      next: () => {
        this.saving.set(false);
        this.success.set('Category activated successfully.');
        this.toast.success('Category activated successfully.');
        this.load(this.page());
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        const message = err.error?.message || 'Unable to activate category. Please try again.';
        this.error.set(message);
        this.toast.error(message);
      }
    });
  }

  requestDeactivateCategory(row: CategoryOption): void {
    if (!row.active || this.saving()) {
      return;
    }

    this.pendingDeactivateCategory.set(row);
  }

  closeDeactivateConfirm(): void {
    if (this.saving()) {
      return;
    }

    this.pendingDeactivateCategory.set(null);
  }

  confirmDeactivateCategory(): void {
    const row = this.pendingDeactivateCategory();
    if (!row || !row.active || this.saving()) {
      return;
    }

    this.deactivateCategory(row);
  }

  deactivateCategory(row: CategoryOption): void {
    if (!row.active || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);

    this.api.setCategoryActive(row.id, false).subscribe({
      next: () => {
        this.saving.set(false);
        this.pendingDeactivateCategory.set(null);
        this.success.set('Category deactivated successfully.');
        this.toast.success('Category deactivated successfully.');
        const currentPage = this.page();
        const shouldMoveBack = this.rows().length === 1 && currentPage > 0;
        this.load(shouldMoveBack ? currentPage - 1 : currentPage);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.pendingDeactivateCategory.set(null);
        const message = err.error?.message || 'Unable to deactivate category. Please try again.';
        this.error.set(message);
        this.toast.error(message);
      }
    });
  }
}
