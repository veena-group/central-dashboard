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

interface NoticeRow {
  id: number;
  title: string;
  body: string | null;
  categoryId: number;
  categoryName: string | null;
  publishOn: string;
  expireOn: string | null;
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
  selector: 'app-notice-list',
  imports: [PaginationComponent, ReactiveFormsModule, ConfirmModalComponent, IconComponent, DatePipe, AttachmentPreviewComponent],
  templateUrl: './notice-list.component.html'
})
export class NoticeListComponent {
  private readonly api = inject(PagedApiService);
  private readonly adminApi = inject(AdminContentApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(NotificationService);

  readonly loading = signal(true);
  readonly showCreateModal = signal(false);
  readonly showEditModal = signal(false);
  readonly creating = signal(false);
  readonly updating = signal(false);
  readonly deletingNoticeId = signal<number | null>(null);
  readonly noticePendingDelete = signal<NoticeRow | null>(null);
  readonly categoriesLoading = signal(false);
  readonly createError = signal<string | null>(null);
  readonly editError = signal<string | null>(null);
  readonly createAttachmentFiles = signal<SelectedAttachmentFile[]>([]);
  readonly createAttachmentDragActive = signal(false);
  readonly editAttachments = signal<AttachmentResponse[]>([]);
  readonly editAttachmentFiles = signal<SelectedAttachmentFile[]>([]);
  readonly attachmentActionInProgress = signal(false);
  readonly attachmentListTarget = signal<NoticeRow | null>(null);
  readonly pendingAttachmentRemovalIds = signal<ReadonlySet<number>>(new Set());
  readonly expandedDescriptionIds = signal<ReadonlySet<number>>(new Set());
  readonly previewOpen = signal(false);
  readonly previewLoading = signal(false);
  readonly previewError = signal<string | null>(null);
  readonly previewAttachmentName = signal('');
  readonly previewBlob = signal<Blob | null>(null);
  readonly categories = signal<CategoryOption[]>([]);
  readonly rows = signal<NoticeRow[]>([]);
  readonly page = signal(0);
  readonly totalPages = signal(0);
  readonly first = signal(true);
  readonly last = signal(true);
  readonly editingNoticeId = signal<number | null>(null);

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly categoryFilter = signal('');
  readonly visibilityFilter = signal('');

  readonly createForm = this.fb.nonNullable.group(
    {
      title: ['', [Validators.required]],
      body: [''],
      categoryId: [0, [Validators.min(1)]],
      publishOn: ['', [Validators.required]],
      expireOn: ['', [Validators.required]],
      isPublic: [false],
      downloadable: [false]
    },
    { validators: [this.noticeDateRangeValidator()] }
  );

  readonly editForm = this.fb.nonNullable.group(
    {
      title: ['', [Validators.required]],
      body: [''],
      categoryId: [0, [Validators.min(1)]],
      publishOn: ['', [Validators.required]],
      expireOn: ['', [Validators.required]],
      isPublic: [false],
      downloadable: [false]
    },
    { validators: [this.noticeDateRangeValidator()] }
  );

  constructor() {
    this.load(0);
    this.loadNoticeCategories();
    this.searchControl.valueChanges.pipe(debounceTime(300)).subscribe(() => this.load(0));
  }

  load(page: number): void {
    this.loading.set(true);
    this.api.list<NoticeRow>('/admin/notices', page, 5, {
      search: this.searchControl.value.trim() || undefined,
      categoryId: this.categoryFilter() || undefined,
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
    return !!this.searchControl.value.trim() || !!this.categoryFilter() || !!this.visibilityFilter();
  }

  clearFilters(): void {
    this.searchControl.setValue('', { emitEvent: false });
    this.categoryFilter.set('');
    this.visibilityFilter.set('');
    this.load(0);
  }

  openCreateModal(): void {
    this.showCreateModal.set(true);
    this.createError.set(null);
    this.loadNoticeCategories();
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
    this.creating.set(false);
    this.createError.set(null);
    this.createAttachmentFiles.set([]);
    this.createAttachmentDragActive.set(false);
    this.createForm.reset({
      title: '',
      body: '',
      categoryId: 0,
      publishOn: '',
      expireOn: '',
      isPublic: false,
      downloadable: false
    });
  }

  createNotice(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    const value = this.createForm.getRawValue();
    this.creating.set(true);
    this.createError.set(null);

    this.adminApi.createNotice({
      title: value.title,
      body: value.body.trim() || null,
      categoryId: value.categoryId,
      publishOn: value.publishOn,
      expireOn: value.expireOn,
      isPublic: value.isPublic,
      downloadable: value.downloadable
    }).subscribe({
      next: (noticeId) => {
        const files = this.createAttachmentFiles().map((item) => item.file);
        if (files.length > 0) {
          forkJoin(files.map((file) => this.adminApi.uploadNoticeAttachment(noticeId, file))).subscribe({
            next: () => {
              this.creating.set(false);
              this.toast.success(`Notice created with ${files.length} attachment(s) successfully.`);
              this.closeCreateModal();
              this.load(0);
            },
            error: (err: HttpErrorResponse) => {
              this.creating.set(false);
              const message = err.error?.message || 'Notice created, but attachment upload failed.';
              this.createError.set(message);
              this.toast.error(message);
              this.closeCreateModal();
              this.load(0);
            }
          });
          return;
        }

        this.creating.set(false);
        this.toast.success('Notice created successfully.');
        this.closeCreateModal();
        this.load(0);
      },
      error: (err: HttpErrorResponse) => {
        this.creating.set(false);
        const message = err.error?.message || 'Unable to create notice. Please try again.';
        this.createError.set(message);
        this.toast.error(message);
      }
    });
  }

  openEditModal(notice: NoticeRow): void {
    this.editingNoticeId.set(notice.id);
    this.editError.set(null);
    this.editForm.reset({
      title: notice.title,
      body: notice.body ?? '',
      categoryId: notice.categoryId,
      publishOn: notice.publishOn,
      expireOn: notice.expireOn ?? notice.publishOn,
      isPublic: notice.isPublic,
      downloadable: notice.downloadable
    });
    this.editAttachments.set(notice.attachments ?? []);
    this.editAttachmentFiles.set([]);
    this.pendingAttachmentRemovalIds.set(new Set());
    this.showEditModal.set(true);
    this.loadNoticeCategories();
  }

  openAttachmentList(notice: NoticeRow): void {
    this.attachmentListTarget.set(notice);
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
    this.editingNoticeId.set(null);
    this.editError.set(null);
    this.editAttachments.set([]);
    this.editAttachmentFiles.set([]);
    this.pendingAttachmentRemovalIds.set(new Set());
    this.attachmentActionInProgress.set(false);
    this.editForm.reset({
      title: '',
      body: '',
      categoryId: 0,
      publishOn: '',
      expireOn: '',
      isPublic: false,
      downloadable: false
    });
  }

  saveEditedNotice(): void {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    const noticeId = this.editingNoticeId();
    if (!noticeId) {
      return;
    }

    const value = this.editForm.getRawValue();
    this.updating.set(true);
    this.editError.set(null);

    this.adminApi.updateNotice(noticeId, {
      title: value.title,
      body: value.body.trim() || null,
      categoryId: value.categoryId,
      publishOn: value.publishOn,
      expireOn: value.expireOn,
      isPublic: value.isPublic,
      downloadable: value.downloadable
    }).subscribe({
      next: () => {
        const files = this.editAttachmentFiles().map((item) => item.file);
        const removalIds = Array.from(this.pendingAttachmentRemovalIds());
        const operations: Observable<unknown>[] = [
          ...files.map((file) => this.adminApi.uploadNoticeAttachment(noticeId, file)),
          ...removalIds.map((attachmentId) => this.adminApi.removeNoticeAttachment(noticeId, attachmentId))
        ];

        if (operations.length > 0) {
          forkJoin(operations).subscribe({
            next: () => {
              this.updating.set(false);
              this.toast.success('Notice and attachments updated successfully.');
              this.closeEditModal();
              this.load(this.page());
            },
            error: (err: HttpErrorResponse) => {
              this.updating.set(false);
              const message = err.error?.message || 'Notice updated, but some attachment changes failed.';
              this.editError.set(message);
              this.toast.error(message);
              this.load(this.page());
            }
          });
          return;
        }

        this.updating.set(false);
        this.toast.success('Notice updated successfully.');
        this.closeEditModal();
        this.load(this.page());
      },
      error: (err: HttpErrorResponse) => {
        this.updating.set(false);
        const message = err.error?.message || 'Unable to update notice. Please try again.';
        this.editError.set(message);
        this.toast.error(message);
      }
    });
  }

  requestDeleteNotice(notice: NoticeRow): void {
    this.noticePendingDelete.set(notice);
  }

  closeDeleteNoticeConfirm(): void {
    if (this.deletingNoticeId()) {
      return;
    }
    this.noticePendingDelete.set(null);
  }

  confirmDeleteNotice(): void {
    const notice = this.noticePendingDelete();
    if (!notice) {
      return;
    }

    this.deleteNotice(notice);
  }

  deleteNotice(notice: NoticeRow): void {
    this.deletingNoticeId.set(notice.id);
    this.adminApi.deleteNotice(notice.id).subscribe({
      next: () => {
        this.deletingNoticeId.set(null);
        this.noticePendingDelete.set(null);
        this.toast.success('Notice removed successfully.');
        const currentPage = this.page();
        const shouldMoveBack = this.rows().length === 1 && currentPage > 0;
        this.load(shouldMoveBack ? currentPage - 1 : currentPage);
      },
      error: (err: HttpErrorResponse) => {
        this.deletingNoticeId.set(null);
        this.noticePendingDelete.set(null);
        const message = err.error?.message || 'Unable to remove notice. Please try again.';
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
    this.editAttachmentFiles.set([]);
  }

  removeEditAttachment(index: number): void {
    const files = [...this.editAttachmentFiles()];
    files.splice(index, 1);
    this.editAttachmentFiles.set(files);
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

  private loadNoticeCategories(): void {
    this.categoriesLoading.set(true);
    this.adminApi.listActiveCategories('NOTICE').subscribe({
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

  private noticeDateRangeValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const publishOn = control.get('publishOn')?.value as string | null;
      const expireOn = control.get('expireOn')?.value as string | null;

      if (!publishOn || !expireOn) {
        return null;
      }

      return expireOn >= publishOn ? null : { invalidDateRange: true };
    };
  }
}
