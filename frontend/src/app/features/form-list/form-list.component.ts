import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AbstractControl, FormBuilder, FormControl, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, debounceTime, forkJoin } from 'rxjs';
import { PagedApiService } from '../../core/services/paged-api.service';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { ConfirmModalComponent } from '../../shared/confirm-modal/confirm-modal.component';
import { AdminContentApiService, AttachmentResponse, CategoryOption } from '../../core/services/admin-content-api.service';
import { NotificationService } from '../../core/services/notification.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { AttachmentPreviewComponent } from '../../shared/attachment-preview/attachment-preview.component';
import { validatePdfFile } from '../../core/utils/pdf-file-validator';

interface FormRow {
  id: number;
  title: string;
  categoryId: number;
  categoryName: string | null;
  year: number | null;
  description: string | null;
  isPublic: boolean;
  downloadable: boolean;
  attachments: AttachmentResponse[];
  createdAt: string;
}

interface SelectedAttachmentFile {
  file: File;
  name: string;
  type: string;
  sizeLabel: string;
}

@Component({
  selector: 'app-form-list',
  imports: [PaginationComponent, ReactiveFormsModule, ConfirmModalComponent, IconComponent, DatePipe, AttachmentPreviewComponent],
  templateUrl: './form-list.component.html'
})
export class FormListComponent {
  private readonly api = inject(PagedApiService);
  private readonly adminApi = inject(AdminContentApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(NotificationService);

  readonly loading = signal(true);
  readonly showCreateModal = signal(false);
  readonly showEditModal = signal(false);
  readonly creating = signal(false);
  readonly updating = signal(false);
  readonly deletingFormId = signal<number | null>(null);
  readonly formPendingDelete = signal<FormRow | null>(null);
  readonly categoriesLoading = signal(false);
  readonly createError = signal<string | null>(null);
  readonly editError = signal<string | null>(null);
  readonly createAttachmentFiles = signal<SelectedAttachmentFile[]>([]);
  readonly createAttachmentDragActive = signal(false);
  readonly editAttachments = signal<AttachmentResponse[]>([]);
  readonly editAttachmentFiles = signal<SelectedAttachmentFile[]>([]);
  readonly editAttachmentDragActive = signal(false);
  readonly attachmentActionInProgress = signal(false);
  readonly attachmentListTarget = signal<FormRow | null>(null);
  readonly pendingAttachmentRemovalIds = signal<ReadonlySet<number>>(new Set());
  readonly expandedDescriptionIds = signal<ReadonlySet<number>>(new Set());
  readonly previewOpen = signal(false);
  readonly previewLoading = signal(false);
  readonly previewError = signal<string | null>(null);
  readonly previewAttachmentName = signal('');
  readonly previewBlob = signal<Blob | null>(null);
  readonly categories = signal<CategoryOption[]>([]);
  readonly rows = signal<FormRow[]>([]);
  readonly page = signal(0);
  readonly totalPages = signal(0);
  readonly first = signal(true);
  readonly last = signal(true);
  readonly editingFormId = signal<number | null>(null);

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly yearControl = new FormControl('', { nonNullable: true });
  readonly categoryFilter = signal('');
  readonly visibilityFilter = signal('');

  readonly createForm = this.fb.nonNullable.group({
    title: ['', [Validators.required]],
    categoryId: [0, [Validators.min(1)]],
    year: ['', [this.yearValidator()]],
    description: [''],
    isPublic: [false],
    downloadable: [false]
  });

  readonly editForm = this.fb.nonNullable.group({
    title: ['', [Validators.required]],
    categoryId: [0, [Validators.min(1)]],
    year: ['', [this.yearValidator()]],
    description: [''],
    isPublic: [false],
    downloadable: [false]
  });

  constructor() {
    this.load(0);
    this.loadCategories();
    this.searchControl.valueChanges.pipe(debounceTime(300)).subscribe(() => this.load(0));
    this.yearControl.valueChanges.pipe(debounceTime(300)).subscribe(() => this.load(0));
  }

  private toTrimmedString(value: unknown): string {
    if (typeof value === 'string') {
      return value.trim();
    }

    if (value === null || value === undefined) {
      return '';
    }

    return String(value).trim();
  }

  load(page: number): void {
    this.loading.set(true);
    const year = this.toTrimmedString(this.yearControl.value);
    const search = this.toTrimmedString(this.searchControl.value);
    this.api.list<FormRow>('/admin/forms', page, 5, {
      search: search || undefined,
      categoryId: this.categoryFilter() || undefined,
      year: year && !Number.isNaN(Number(year)) ? Number(year) : undefined,
      isPublic: this.visibilityFilter() === '' ? undefined : this.visibilityFilter() === 'true'
    }).subscribe({
      next: (data) => {
        this.rows.set(data.content);
        this.page.set(data.page);
        this.totalPages.set(data.totalPages);
        this.first.set(data.first);
        this.last.set(data.last);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  setCategoryFilter(value: string): void {
    this.categoryFilter.set(value);
    this.load(0);
  }

  setVisibilityFilter(value: string): void {
    this.visibilityFilter.set(value);
    this.load(0);
  }

  hasActiveFilters(): boolean {
    return !!this.toTrimmedString(this.searchControl.value)
      || !!this.toTrimmedString(this.yearControl.value)
      || !!this.categoryFilter()
      || !!this.visibilityFilter();
  }

  clearFilters(): void {
    this.searchControl.setValue('', { emitEvent: false });
    this.yearControl.setValue('', { emitEvent: false });
    this.categoryFilter.set('');
    this.visibilityFilter.set('');
    this.load(0);
  }

  openCreateModal(): void {
    this.showCreateModal.set(true);
    this.createError.set(null);
    this.loadCategories();
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
    this.creating.set(false);
    this.createError.set(null);
    this.createAttachmentFiles.set([]);
    this.createAttachmentDragActive.set(false);
    this.createForm.reset({
      title: '',
      categoryId: 0,
      year: '',
      description: '',
      isPublic: false,
      downloadable: false
    });
  }

  createFormEntry(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    const value = this.createForm.getRawValue();
    const rawYear = String(value.year ?? '').trim();
    const parsedYear = rawYear ? Number(rawYear) : null;

    if (parsedYear !== null && Number.isNaN(parsedYear)) {
      const message = 'Year must be a valid number.';
      this.createError.set(message);
      this.toast.warning(message);
      return;
    }

    this.creating.set(true);
    this.createError.set(null);

    this.adminApi.createForm({
      title: value.title,
      categoryId: value.categoryId,
      year: parsedYear,
      description: value.description.trim() || null,
      isPublic: value.isPublic,
      downloadable: value.downloadable
    }).subscribe({
      next: (formId) => {
        const files = this.createAttachmentFiles().map((item) => item.file);
        if (files.length > 0) {
          forkJoin(files.map((file) => this.adminApi.uploadFormAttachment(formId, file))).subscribe({
            next: () => {
              this.creating.set(false);
              this.toast.success(`Form created with ${files.length} attachment(s) successfully.`);
              this.closeCreateModal();
              this.load(0);
            },
            error: (err: HttpErrorResponse) => {
              this.creating.set(false);
              const message = err.error?.message || 'Form created, but attachment upload failed.';
              this.createError.set(message);
              this.toast.error(message);
              this.closeCreateModal();
              this.load(0);
            }
          });
          return;
        }

        this.creating.set(false);
        this.toast.success('Form created successfully.');
        this.closeCreateModal();
        this.load(0);
      },
      error: (err: HttpErrorResponse) => {
        this.creating.set(false);
        const message = err.error?.message || 'Unable to create form. Please try again.';
        this.createError.set(message);
        this.toast.error(message);
      }
    });
  }

  openEditModal(form: FormRow): void {
    this.editingFormId.set(form.id);
    this.editError.set(null);
    this.editForm.reset({
      title: form.title,
      categoryId: form.categoryId,
      year: form.year !== null ? String(form.year) : '',
      description: form.description ?? '',
      isPublic: form.isPublic,
      downloadable: form.downloadable
    });
    this.editAttachments.set(form.attachments ?? []);
    this.editAttachmentFiles.set([]);
    this.editAttachmentDragActive.set(false);
    this.pendingAttachmentRemovalIds.set(new Set());
    this.showEditModal.set(true);
    this.loadCategories();
  }

  openAttachmentList(form: FormRow): void {
    this.attachmentListTarget.set(form);
  }

  closeAttachmentList(): void {
    if (this.attachmentActionInProgress()) {
      return;
    }
    this.attachmentListTarget.set(null);
  }

  closeEditModal(): void {
    this.showEditModal.set(false);
    this.updating.set(false);
    this.editingFormId.set(null);
    this.editError.set(null);
    this.editAttachments.set([]);
    this.editAttachmentFiles.set([]);
    this.editAttachmentDragActive.set(false);
    this.pendingAttachmentRemovalIds.set(new Set());
    this.attachmentActionInProgress.set(false);
    this.editForm.reset({
      title: '',
      categoryId: 0,
      year: '',
      description: '',
      isPublic: false,
      downloadable: false
    });
  }

  saveEditedForm(): void {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    const formId = this.editingFormId();
    if (!formId) {
      return;
    }

    const value = this.editForm.getRawValue();
    const rawYear = String(value.year ?? '').trim();
    const parsedYear = rawYear ? Number(rawYear) : null;
    if (parsedYear !== null && Number.isNaN(parsedYear)) {
      const message = 'Year must be a valid number.';
      this.editError.set(message);
      this.toast.warning(message);
      return;
    }

    this.updating.set(true);
    this.editError.set(null);

    this.adminApi.updateFormEntry(formId, {
      title: value.title,
      categoryId: value.categoryId,
      year: parsedYear,
      description: value.description.trim() || null,
      isPublic: value.isPublic,
      downloadable: value.downloadable
    }).subscribe({
      next: () => {
        const files = this.editAttachmentFiles().map((item) => item.file);
        const removalIds = Array.from(this.pendingAttachmentRemovalIds());
        const operations: Observable<unknown>[] = [
          ...files.map((file) => this.adminApi.uploadFormAttachment(formId, file)),
          ...removalIds.map((attachmentId) => this.adminApi.removeFormAttachment(formId, attachmentId))
        ];

        if (operations.length > 0) {
          forkJoin(operations).subscribe({
            next: () => {
              this.updating.set(false);
              this.toast.success('Form and attachments updated successfully.');
              this.closeEditModal();
              this.load(this.page());
            },
            error: (err: HttpErrorResponse) => {
              this.updating.set(false);
              const message = err.error?.message || 'Form updated, but some attachment changes failed.';
              this.editError.set(message);
              this.toast.error(message);
              this.load(this.page());
            }
          });
          return;
        }

        this.updating.set(false);
        this.toast.success('Form updated successfully.');
        this.closeEditModal();
        this.load(this.page());
      },
      error: (err: HttpErrorResponse) => {
        this.updating.set(false);
        const message = err.error?.message || 'Unable to update form. Please try again.';
        this.editError.set(message);
        this.toast.error(message);
      }
    });
  }

  requestDeleteForm(form: FormRow): void {
    this.formPendingDelete.set(form);
  }

  closeDeleteFormConfirm(): void {
    if (this.deletingFormId()) {
      return;
    }
    this.formPendingDelete.set(null);
  }

  confirmDeleteForm(): void {
    const form = this.formPendingDelete();
    if (!form) {
      return;
    }

    this.deleteForm(form);
  }

  deleteForm(form: FormRow): void {
    this.deletingFormId.set(form.id);
    this.adminApi.deleteFormEntry(form.id).subscribe({
      next: () => {
        this.deletingFormId.set(null);
        this.formPendingDelete.set(null);
        this.toast.success('Form removed successfully.');
        const currentPage = this.page();
        const shouldMoveBack = this.rows().length === 1 && currentPage > 0;
        this.load(shouldMoveBack ? currentPage - 1 : currentPage);
      },
      error: (err: HttpErrorResponse) => {
        this.deletingFormId.set(null);
        this.formPendingDelete.set(null);
        const message = err.error?.message || 'Unable to remove form. Please try again.';
        this.toast.error(message);
      }
    });
  }

  onCreateAttachmentFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    this.addCreateAttachmentFiles(files);
    input.value = '';
  }

  onCreateAttachmentDragOver(event: DragEvent): void {
    event.preventDefault();
    this.createAttachmentDragActive.set(true);
  }

  onCreateAttachmentDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.createAttachmentDragActive.set(false);
  }

  onCreateAttachmentDrop(event: DragEvent): void {
    event.preventDefault();
    this.createAttachmentDragActive.set(false);
    const files = Array.from(event.dataTransfer?.files ?? []);
    this.addCreateAttachmentFiles(files);
  }

  clearCreateAttachmentSelection(): void {
    this.createAttachmentDragActive.set(false);
    this.createAttachmentFiles.set([]);
  }

  removeCreateAttachment(index: number): void {
    const files = [...this.createAttachmentFiles()];
    files.splice(index, 1);
    this.createAttachmentFiles.set(files);
  }

  onEditAttachmentFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    this.addEditAttachmentFiles(files);
    input.value = '';
  }

  clearEditAttachmentSelection(): void {
    this.editAttachmentDragActive.set(false);
    this.editAttachmentFiles.set([]);
  }

  removeEditAttachment(index: number): void {
    const files = [...this.editAttachmentFiles()];
    files.splice(index, 1);
    this.editAttachmentFiles.set(files);
  }

  onEditAttachmentDragOver(event: DragEvent): void {
    event.preventDefault();
    this.editAttachmentDragActive.set(true);
  }

  onEditAttachmentDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.editAttachmentDragActive.set(false);
  }

  onEditAttachmentDrop(event: DragEvent): void {
    event.preventDefault();
    this.editAttachmentDragActive.set(false);
    const files = Array.from(event.dataTransfer?.files ?? []);
    this.addEditAttachmentFiles(files);
  }

  openAttachment(attachment: AttachmentResponse): void {
    this.previewOpen.set(true);
    this.previewLoading.set(true);
    this.previewError.set(null);
    this.previewAttachmentName.set(attachment.fileName || 'Attachment');
    this.previewBlob.set(null);
    this.attachmentActionInProgress.set(true);
    this.adminApi.fetchStoredFile(attachment.filePath).subscribe({
      next: (blob) => {
        this.attachmentActionInProgress.set(false);
        this.previewLoading.set(false);
        this.previewBlob.set(blob);
      },
      error: () => {
        this.attachmentActionInProgress.set(false);
        this.previewLoading.set(false);
        this.previewError.set('Unable to load attachment preview.');
      }
    });
  }

  previewDownloadable(): boolean {
    return this.attachmentListTarget()?.downloadable ?? this.editForm.controls.downloadable.value;
  }

  closePreviewModal(): void {
    this.previewOpen.set(false);
    this.previewLoading.set(false);
    this.previewError.set(null);
    this.previewAttachmentName.set('');
    this.previewBlob.set(null);
  }

  downloadAttachment(attachment: AttachmentResponse): void {
    this.attachmentActionInProgress.set(true);
    this.adminApi.fetchStoredFile(attachment.filePath).subscribe({
      next: (blob) => {
        this.attachmentActionInProgress.set(false);
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = attachment.fileName || 'attachment';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      },
      error: () => {
        this.attachmentActionInProgress.set(false);
        this.toast.error('Unable to download attachment.');
      }
    });
  }

  isAttachmentPendingRemoval(attachmentId: number): boolean {
    return this.pendingAttachmentRemovalIds().has(attachmentId);
  }

  requestRemoveAttachment(attachment: AttachmentResponse): void {
    const next = new Set(this.pendingAttachmentRemovalIds());
    next.add(attachment.id);
    this.pendingAttachmentRemovalIds.set(next);
  }

  undoRemoveAttachment(attachmentId: number): void {
    const next = new Set(this.pendingAttachmentRemovalIds());
    next.delete(attachmentId);
    this.pendingAttachmentRemovalIds.set(next);
  }

  private addCreateAttachmentFiles(files: File[]): void {
    if (!files.length) {
      return;
    }

    const existing = this.createAttachmentFiles();
    const known = new Set(existing.map((item) => `${item.file.name}:${item.file.size}:${item.file.lastModified}`));
    const next = [...existing];

    for (const file of files) {
      const validationError = validatePdfFile(file);
      if (validationError) {
        this.toast.warning(`${file.name}: ${validationError}`);
        continue;
      }

      const key = `${file.name}:${file.size}:${file.lastModified}`;
      if (known.has(key)) {
        continue;
      }
      known.add(key);
      next.push({
        file,
        name: file.name,
        type: this.fileTypeLabel(file),
        sizeLabel: this.formatBytes(file.size)
      });
    }

    this.createAttachmentFiles.set(next);
  }

  private addEditAttachmentFiles(files: File[]): void {
    if (!files.length) {
      return;
    }

    const existing = this.editAttachmentFiles();
    const known = new Set(existing.map((item) => `${item.file.name}:${item.file.size}:${item.file.lastModified}`));
    const next = [...existing];

    for (const file of files) {
      const validationError = validatePdfFile(file);
      if (validationError) {
        this.toast.warning(`${file.name}: ${validationError}`);
        continue;
      }

      const key = `${file.name}:${file.size}:${file.lastModified}`;
      if (known.has(key)) {
        continue;
      }
      known.add(key);
      next.push({
        file,
        name: file.name,
        type: this.fileTypeLabel(file),
        sizeLabel: this.formatBytes(file.size)
      });
    }

    this.editAttachmentFiles.set(next);
  }

  private fileTypeLabel(file: File): string {
    const extension = file.name.includes('.') ? file.name.split('.').pop()?.toUpperCase() : null;
    if (extension) {
      return extension;
    }
    return file.type ? file.type.toUpperCase() : 'FILE';
  }

  private formatBytes(size: number): string {
    if (size < 1024) {
      return `${size} B`;
    }
    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  private loadCategories(): void {
    this.categoriesLoading.set(true);
    this.adminApi.listActiveCategories('FORM').subscribe({
      next: (categories) => {
        this.categories.set(categories);
        this.categoriesLoading.set(false);

        if (categories.length > 0 && this.createForm.controls.categoryId.value === 0) {
          this.createForm.patchValue({ categoryId: categories[0].id });
        }
      },
      error: () => {
        this.categoriesLoading.set(false);
      }
    });
  }

  isLongText(text: string | null): boolean {
    return !!text && text.length > 160;
  }

  isDescriptionExpanded(id: number): boolean {
    return this.expandedDescriptionIds().has(id);
  }

  toggleDescription(id: number): void {
    const next = new Set(this.expandedDescriptionIds());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.expandedDescriptionIds.set(next);
  }

  categoryBadgeClass(categoryName: string | null): string {
    if (!categoryName) {
      return 'badge badge-soft-secondary';
    }
    const key = categoryName.toLowerCase();
    if (key.includes('urgent') || key.includes('emergency')) {
      return 'badge badge-soft-danger';
    }
    if (key.includes('event') || key.includes('festival')) {
      return 'badge badge-soft-info';
    }
    if (key.includes('maintenance') || key.includes('service')) {
      return 'badge badge-soft-warning';
    }
    return 'badge badge-soft-primary';
  }

  private yearValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const raw = String(control.value ?? '').trim();
      if (!raw) {
        return null;
      }

      const year = Number(raw);
      if (Number.isNaN(year)) {
        return { invalidYear: true };
      }

      return year >= 1900 && year <= 2100 ? null : { invalidYear: true };
    };
  }
}
