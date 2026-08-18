import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, debounceTime, forkJoin } from 'rxjs';
import { PagedApiService } from '../../core/services/paged-api.service';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { ConfirmModalComponent } from '../../shared/confirm-modal/confirm-modal.component';
import { AdminContentApiService, AttachmentResponse, CategoryOption } from '../../core/services/admin-content-api.service';
import { NotificationService } from '../../core/services/notification.service';
import { MediaUrlService } from '../../core/services/media-url.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { SecureImageComponent } from '../../shared/secure-image/secure-image.component';
import { AttachmentPreviewComponent } from '../../shared/attachment-preview/attachment-preview.component';
import { validatePdfFile } from '../../core/utils/pdf-file-validator';

interface EventRow {
  id: number;
  title: string;
  categoryId: number;
  categoryName: string | null;
  description: string | null;
  eventDate: string;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  venue: string | null;
  bannerPath: string | null;
  attachments: AttachmentResponse[];
  status: string;
  isPublic: boolean;
  downloadable: boolean;
  createdAt: string;
}

interface SelectedAttachmentFile {
  file: File;
  name: string;
  type: string;
  sizeLabel: string;
}

@Component({
  selector: 'app-event-list',
  imports: [PaginationComponent, ReactiveFormsModule, ConfirmModalComponent, IconComponent, SecureImageComponent, DatePipe, AttachmentPreviewComponent],
  templateUrl: './event-list.component.html'
})
export class EventListComponent {
  private readonly api = inject(PagedApiService);
  private readonly adminApi = inject(AdminContentApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(NotificationService);
  private readonly mediaUrl = inject(MediaUrlService);

  readonly loading = signal(true);
  readonly showCreateModal = signal(false);
  readonly showEditModal = signal(false);
  readonly creating = signal(false);
  readonly updating = signal(false);
  readonly deletingEventId = signal<number | null>(null);
  readonly eventPendingDelete = signal<EventRow | null>(null);
  readonly categoriesLoading = signal(false);
  readonly createError = signal<string | null>(null);
  readonly editError = signal<string | null>(null);
  readonly createBannerFile = signal<File | null>(null);
  readonly createBannerPreviewUrl = signal<string | null>(null);
  readonly editBannerFile = signal<File | null>(null);
  readonly editBannerPreviewUrl = signal<string | null>(null);
  readonly createAttachmentFiles = signal<SelectedAttachmentFile[]>([]);
  readonly createAttachmentDragActive = signal(false);
  readonly editAttachments = signal<AttachmentResponse[]>([]);
  readonly editAttachmentFiles = signal<SelectedAttachmentFile[]>([]);
  readonly attachmentActionInProgress = signal(false);
  readonly attachmentListTarget = signal<EventRow | null>(null);
  readonly pendingAttachmentRemovalIds = signal<ReadonlySet<number>>(new Set());
  readonly previewOpen = signal(false);
  readonly previewLoading = signal(false);
  readonly previewError = signal<string | null>(null);
  readonly previewAttachmentName = signal('');
  readonly previewBlob = signal<Blob | null>(null);
  readonly categories = signal<CategoryOption[]>([]);
  readonly rows = signal<EventRow[]>([]);
  readonly page = signal(0);
  readonly totalPages = signal(0);
  readonly first = signal(true);
  readonly last = signal(true);
  readonly editingEventId = signal<number | null>(null);
  readonly expandedDescriptionIds = signal<ReadonlySet<number>>(new Set());

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly categoryFilter = signal('');
  readonly statusFilter = signal('');

  readonly statuses: Array<'UPCOMING' | 'COMPLETED' | 'CANCELLED'> = ['UPCOMING', 'COMPLETED', 'CANCELLED'];

  readonly createForm = this.fb.nonNullable.group({
    title: ['', [Validators.required]],
    categoryId: [0, [Validators.min(1)]],
    description: [''],
    eventDate: ['', [Validators.required]],
    endDate: [''],
    startTime: [''],
    endTime: [''],
    venue: [''],
    status: ['UPCOMING' as 'UPCOMING' | 'COMPLETED' | 'CANCELLED', [Validators.required]],
    isPublic: [false],
    downloadable: [false]
  });

  readonly editForm = this.fb.nonNullable.group({
    title: ['', [Validators.required]],
    categoryId: [0, [Validators.min(1)]],
    description: [''],
    eventDate: ['', [Validators.required]],
    endDate: [''],
    startTime: [''],
    endTime: [''],
    venue: [''],
    status: ['UPCOMING' as 'UPCOMING' | 'COMPLETED' | 'CANCELLED', [Validators.required]],
    isPublic: [false],
    downloadable: [false]
  });

  constructor() {
    this.load(0);
    this.loadCategories();
    this.searchControl.valueChanges.pipe(debounceTime(300)).subscribe(() => this.load(0));
  }

  load(page: number): void {
    this.loading.set(true);
    this.api.list<EventRow>('/admin/events', page, 5, {
      search: this.searchControl.value.trim() || undefined,
      categoryId: this.categoryFilter() || undefined,
      status: this.statusFilter() || undefined
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

  setStatusFilter(value: string): void {
    this.statusFilter.set(value);
    this.load(0);
  }

  hasActiveFilters(): boolean {
    return !!this.searchControl.value.trim() || !!this.categoryFilter() || !!this.statusFilter();
  }

  clearFilters(): void {
    this.searchControl.setValue('', { emitEvent: false });
    this.categoryFilter.set('');
    this.statusFilter.set('');
    this.load(0);
  }

  bannerUrl(path: string | null): string {
    return this.mediaUrl.resolve(path) ?? '';
  }

  statusDotClass(status: string): string {
    switch (this.statusVariant(status)) {
      case 'success': return 'bg-success';
      case 'danger': return 'bg-destructive';
      case 'warning': return 'bg-warning';
      default: return 'bg-info';
    }
  }

  statusVariant(status: string): string {
    switch (status) {
      case 'COMPLETED': return 'success';
      case 'CANCELLED': return 'danger';
      case 'UPCOMING': return 'warning';
      default: return 'info';
    }
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
    this.clearCreateBanner();
    this.createForm.reset({
      title: '',
      categoryId: 0,
      description: '',
      eventDate: '',
      endDate: '',
      startTime: '',
      endTime: '',
      venue: '',
      status: 'UPCOMING',
      isPublic: false,
      downloadable: false
    });
  }

  onCreateBannerSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file) {
      return;
    }
    this.clearCreateBanner();
    this.createBannerFile.set(file);
    this.createBannerPreviewUrl.set(URL.createObjectURL(file));
  }

  clearCreateBanner(): void {
    const preview = this.createBannerPreviewUrl();
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    this.createBannerFile.set(null);
    this.createBannerPreviewUrl.set(null);
  }

  onEditBannerSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file) {
      return;
    }
    this.clearEditBanner();
    this.editBannerFile.set(file);
    this.editBannerPreviewUrl.set(URL.createObjectURL(file));
  }

  clearEditBanner(): void {
    const preview = this.editBannerPreviewUrl();
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    this.editBannerFile.set(null);
    this.editBannerPreviewUrl.set(null);
  }

  createEvent(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    const value = this.createForm.getRawValue();
    this.creating.set(true);
    this.createError.set(null);

    this.adminApi.createEvent({
      title: value.title,
      categoryId: value.categoryId,
      description: value.description.trim() || null,
      eventDate: value.eventDate,
      endDate: value.endDate.trim() || null,
      startTime: value.startTime.trim() || null,
      endTime: value.endTime.trim() || null,
      venue: value.venue.trim() || null,
      status: value.status,
      isPublic: value.isPublic,
      downloadable: value.downloadable
    }).subscribe({
      next: (eventId) => {
        const banner = this.createBannerFile();
        const files = this.createAttachmentFiles().map((item) => item.file);
        const operations: Observable<unknown>[] = [
          ...(banner ? [this.adminApi.uploadEventBanner(eventId, banner)] : []),
          ...files.map((file) => this.adminApi.uploadEventAttachment(eventId, file))
        ];

        if (operations.length > 0) {
          forkJoin(operations).subscribe({
            next: () => {
              this.creating.set(false);
              this.toast.success('Event created successfully.');
              this.closeCreateModal();
              this.load(0);
            },
            error: (err: HttpErrorResponse) => {
              this.creating.set(false);
              const message = err.error?.message || 'Event created, but banner/attachment upload failed.';
              this.createError.set(message);
              this.toast.error(message);
              this.closeCreateModal();
              this.load(0);
            }
          });
          return;
        }

        this.creating.set(false);
        this.toast.success('Event created successfully.');
        this.closeCreateModal();
        this.load(0);
      },
      error: (err: HttpErrorResponse) => {
        this.creating.set(false);
        const message = err.error?.message || 'Unable to create event. Please try again.';
        this.createError.set(message);
        this.toast.error(message);
      }
    });
  }

  openEditModal(item: EventRow): void {
    this.editingEventId.set(item.id);
    this.editError.set(null);
    this.editForm.reset({
      title: item.title,
      categoryId: item.categoryId,
      description: item.description ?? '',
      eventDate: item.eventDate,
      endDate: item.endDate ?? '',
      startTime: item.startTime ?? '',
      endTime: item.endTime ?? '',
      venue: item.venue ?? '',
      status: (item.status as 'UPCOMING' | 'COMPLETED' | 'CANCELLED') ?? 'UPCOMING',
      isPublic: item.isPublic,
      downloadable: item.downloadable
    });
    this.editAttachments.set(item.attachments ?? []);
    this.editAttachmentFiles.set([]);
    this.pendingAttachmentRemovalIds.set(new Set());
    this.clearEditBanner();
    this.showEditModal.set(true);
    this.loadCategories();
  }

  openAttachmentList(item: EventRow): void {
    this.attachmentListTarget.set(item);
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
    this.editingEventId.set(null);
    this.editError.set(null);
    this.editAttachments.set([]);
    this.editAttachmentFiles.set([]);
    this.pendingAttachmentRemovalIds.set(new Set());
    this.attachmentActionInProgress.set(false);
    this.clearEditBanner();
    this.editForm.reset({
      title: '',
      categoryId: 0,
      description: '',
      eventDate: '',
      endDate: '',
      startTime: '',
      endTime: '',
      venue: '',
      status: 'UPCOMING',
      isPublic: false,
      downloadable: false
    });
  }

  saveEditedEvent(): void {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    const eventId = this.editingEventId();
    if (!eventId) {
      return;
    }

    const value = this.editForm.getRawValue();
    this.updating.set(true);
    this.editError.set(null);

    this.adminApi.updateEvent(eventId, {
      title: value.title,
      categoryId: value.categoryId,
      description: value.description.trim() || null,
      eventDate: value.eventDate,
      endDate: value.endDate.trim() || null,
      startTime: value.startTime.trim() || null,
      endTime: value.endTime.trim() || null,
      venue: value.venue.trim() || null,
      status: value.status,
      isPublic: value.isPublic,
      downloadable: value.downloadable
    }).subscribe({
      next: () => {
        const banner = this.editBannerFile();
        const files = this.editAttachmentFiles().map((item) => item.file);
        const removalIds = Array.from(this.pendingAttachmentRemovalIds());
        const operations: Observable<unknown>[] = [
          ...(banner ? [this.adminApi.uploadEventBanner(eventId, banner)] : []),
          ...files.map((file) => this.adminApi.uploadEventAttachment(eventId, file)),
          ...removalIds.map((attachmentId) => this.adminApi.removeEventAttachment(eventId, attachmentId))
        ];

        if (operations.length > 0) {
          forkJoin(operations).subscribe({
            next: () => {
              this.updating.set(false);
              this.toast.success('Event updated successfully.');
              this.closeEditModal();
              this.load(this.page());
            },
            error: (err: HttpErrorResponse) => {
              this.updating.set(false);
              const message = err.error?.message || 'Event updated, but some changes failed.';
              this.editError.set(message);
              this.toast.error(message);
              this.load(this.page());
            }
          });
          return;
        }

        this.updating.set(false);
        this.toast.success('Event updated successfully.');
        this.closeEditModal();
        this.load(this.page());
      },
      error: (err: HttpErrorResponse) => {
        this.updating.set(false);
        const message = err.error?.message || 'Unable to update event. Please try again.';
        this.editError.set(message);
        this.toast.error(message);
      }
    });
  }

  requestDeleteEvent(item: EventRow): void {
    this.eventPendingDelete.set(item);
  }

  closeDeleteEventConfirm(): void {
    if (this.deletingEventId()) {
      return;
    }
    this.eventPendingDelete.set(null);
  }

  confirmDeleteEvent(): void {
    const item = this.eventPendingDelete();
    if (!item) {
      return;
    }
    this.deleteEvent(item);
  }

  deleteEvent(item: EventRow): void {
    this.deletingEventId.set(item.id);
    this.adminApi.deleteEvent(item.id).subscribe({
      next: () => {
        this.deletingEventId.set(null);
        this.eventPendingDelete.set(null);
        this.toast.success('Event removed successfully.');
        const currentPage = this.page();
        const shouldMoveBack = this.rows().length === 1 && currentPage > 0;
        this.load(shouldMoveBack ? currentPage - 1 : currentPage);
      },
      error: (err: HttpErrorResponse) => {
        this.deletingEventId.set(null);
        this.eventPendingDelete.set(null);
        const message = err.error?.message || 'Unable to remove event. Please try again.';
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
    return 'badge badge-soft-primary';
  }

  private loadCategories(): void {
    this.categoriesLoading.set(true);
    this.adminApi.listActiveCategories('EVENT').subscribe({
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
}
