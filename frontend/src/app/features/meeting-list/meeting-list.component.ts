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
import { IconComponent } from '../../shared/icon/icon.component';
import { AttachmentPreviewComponent } from '../../shared/attachment-preview/attachment-preview.component';
import { validatePdfFile } from '../../core/utils/pdf-file-validator';

interface MeetingRow {
  id: number;
  title: string;
  categoryId: number;
  categoryName: string | null;
  agenda: string | null;
  meetingDate: string;
  meetingUrl: string | null;
  recordingUrl: string | null;
  attachments: AttachmentResponse[];
  platform: string;
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
  selector: 'app-meeting-list',
  imports: [PaginationComponent, ReactiveFormsModule, ConfirmModalComponent, IconComponent, DatePipe, AttachmentPreviewComponent],
  templateUrl: './meeting-list.component.html'
})
export class MeetingListComponent {
  private readonly api = inject(PagedApiService);
  private readonly adminApi = inject(AdminContentApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(NotificationService);

  readonly loading = signal(true);
  readonly showCreateModal = signal(false);
  readonly showEditModal = signal(false);
  readonly creating = signal(false);
  readonly updating = signal(false);
  readonly deletingMeetingId = signal<number | null>(null);
  readonly meetingPendingDelete = signal<MeetingRow | null>(null);
  readonly categoriesLoading = signal(false);
  readonly createError = signal<string | null>(null);
  readonly editError = signal<string | null>(null);
  readonly createAttachmentFiles = signal<SelectedAttachmentFile[]>([]);
  readonly createAttachmentDragActive = signal(false);
  readonly editAttachments = signal<AttachmentResponse[]>([]);
  readonly editAttachmentFiles = signal<SelectedAttachmentFile[]>([]);
  readonly attachmentActionInProgress = signal(false);
  readonly attachmentListTarget = signal<MeetingRow | null>(null);
  readonly pendingAttachmentRemovalIds = signal<ReadonlySet<number>>(new Set());
  readonly previewOpen = signal(false);
  readonly previewLoading = signal(false);
  readonly previewError = signal<string | null>(null);
  readonly previewAttachmentName = signal('');
  readonly previewBlob = signal<Blob | null>(null);
  readonly categories = signal<CategoryOption[]>([]);
  readonly rows = signal<MeetingRow[]>([]);
  readonly page = signal(0);
  readonly totalPages = signal(0);
  readonly first = signal(true);
  readonly last = signal(true);
  readonly editingMeetingId = signal<number | null>(null);
  readonly expandedDescriptionIds = signal<ReadonlySet<number>>(new Set());

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly categoryFilter = signal('');
  readonly statusFilter = signal('');
  readonly platformFilter = signal('');

  readonly platforms: Array<'ZOOM' | 'GOOGLE_MEET' | 'MICROSOFT_TEAMS' | 'IN_PERSON'> = [
    'ZOOM',
    'GOOGLE_MEET',
    'MICROSOFT_TEAMS',
    'IN_PERSON'
  ];

  readonly statuses: Array<'UPCOMING' | 'COMPLETED' | 'CANCELLED'> = [
    'UPCOMING',
    'COMPLETED',
    'CANCELLED'
  ];

  readonly createForm = this.fb.nonNullable.group({
    title: ['', [Validators.required]],
    categoryId: [0, [Validators.min(1)]],
    agenda: [''],
    meetingDate: ['', [Validators.required]],
    platform: ['ZOOM' as 'ZOOM' | 'GOOGLE_MEET' | 'MICROSOFT_TEAMS' | 'IN_PERSON', [Validators.required]],
    meetingUrl: ['', [Validators.pattern(/^https?:\/\/.+/i)]],
    status: ['UPCOMING' as 'UPCOMING' | 'COMPLETED' | 'CANCELLED', [Validators.required]],
    isPublic: [false],
    downloadable: [false]
  });

  readonly editForm = this.fb.nonNullable.group({
    title: ['', [Validators.required]],
    categoryId: [0, [Validators.min(1)]],
    agenda: [''],
    meetingDate: ['', [Validators.required]],
    platform: ['ZOOM' as 'ZOOM' | 'GOOGLE_MEET' | 'MICROSOFT_TEAMS' | 'IN_PERSON', [Validators.required]],
    meetingUrl: ['', [Validators.pattern(/^https?:\/\/.+/i)]],
    status: ['UPCOMING' as 'UPCOMING' | 'COMPLETED' | 'CANCELLED', [Validators.required]],
    recordingUrl: ['', [Validators.pattern(/^https?:\/\/.+/i)]],
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
    this.api.list<MeetingRow>('/admin/meetings', page, 5, {
      search: this.searchControl.value.trim() || undefined,
      categoryId: this.categoryFilter() || undefined,
      status: this.statusFilter() || undefined,
      platform: this.platformFilter() || undefined
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

  setPlatformFilter(value: string): void {
    this.platformFilter.set(value);
    this.load(0);
  }

  hasActiveFilters(): boolean {
    return !!this.searchControl.value.trim() || !!this.categoryFilter() || !!this.statusFilter() || !!this.platformFilter();
  }

  clearFilters(): void {
    this.searchControl.setValue('', { emitEvent: false });
    this.categoryFilter.set('');
    this.statusFilter.set('');
    this.platformFilter.set('');
    this.load(0);
  }

  statusDotClass(status: string): string {
    switch (this.statusVariant(status)) {
      case 'success': return 'bg-success';
      case 'danger': return 'bg-destructive';
      case 'warning': return 'bg-warning';
      default: return 'bg-info';
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
    this.createForm.reset({
      title: '',
      categoryId: 0,
      agenda: '',
      meetingDate: '',
      platform: 'ZOOM',
      meetingUrl: '',
      status: 'UPCOMING',
      isPublic: false,
      downloadable: false
    });
  }

  createMeeting(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    const value = this.createForm.getRawValue();
    this.creating.set(true);
    this.createError.set(null);

    this.adminApi.createMeeting({
      title: value.title,
      categoryId: value.categoryId,
      agenda: value.agenda.trim() || null,
      meetingDate: value.meetingDate,
      platform: value.platform,
      meetingUrl: value.meetingUrl.trim() || null,
      status: value.status,
      recordingUrl: null,
      isPublic: value.isPublic,
      downloadable: value.downloadable
    }).subscribe({
      next: (meetingId) => {
        const files = this.createAttachmentFiles().map((item) => item.file);
        if (files.length > 0) {
          forkJoin(files.map((file) => this.adminApi.uploadMeetingAttachment(meetingId, file))).subscribe({
            next: () => {
              this.creating.set(false);
              this.toast.success(`Meeting created with ${files.length} attachment(s) successfully.`);
              this.closeCreateModal();
              this.load(0);
            },
            error: (err: HttpErrorResponse) => {
              this.creating.set(false);
              const message = err.error?.message || 'Meeting created, but attachment upload failed.';
              this.createError.set(message);
              this.toast.error(message);
              this.closeCreateModal();
              this.load(0);
            }
          });
          return;
        }

        this.creating.set(false);
        this.toast.success('Meeting created successfully.');
        this.closeCreateModal();
        this.load(0);
      },
      error: (err: HttpErrorResponse) => {
        this.creating.set(false);
        const message = err.error?.message || 'Unable to create meeting. Please try again.';
        this.createError.set(message);
        this.toast.error(message);
      }
    });
  }

  openEditModal(meeting: MeetingRow): void {
    this.editingMeetingId.set(meeting.id);
    this.editError.set(null);
    this.editForm.reset({
      title: meeting.title,
      categoryId: meeting.categoryId,
      agenda: meeting.agenda ?? '',
      meetingDate: meeting.meetingDate,
      platform: (meeting.platform as 'ZOOM' | 'GOOGLE_MEET' | 'MICROSOFT_TEAMS' | 'IN_PERSON') ?? 'ZOOM',
      meetingUrl: meeting.meetingUrl ?? '',
      status: (meeting.status as 'UPCOMING' | 'COMPLETED' | 'CANCELLED') ?? 'UPCOMING',
      recordingUrl: meeting.recordingUrl ?? '',
      isPublic: meeting.isPublic,
      downloadable: meeting.downloadable
    });
    this.editAttachments.set(meeting.attachments ?? []);
    this.editAttachmentFiles.set([]);
    this.pendingAttachmentRemovalIds.set(new Set());
    this.showEditModal.set(true);
    this.loadCategories();
  }

  openAttachmentList(meeting: MeetingRow): void {
    this.attachmentListTarget.set(meeting);
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
    this.editingMeetingId.set(null);
    this.editError.set(null);
    this.editAttachments.set([]);
    this.editAttachmentFiles.set([]);
    this.pendingAttachmentRemovalIds.set(new Set());
    this.attachmentActionInProgress.set(false);
    this.editForm.reset({
      title: '',
      categoryId: 0,
      agenda: '',
      meetingDate: '',
      platform: 'ZOOM',
      meetingUrl: '',
      status: 'UPCOMING',
      recordingUrl: '',
      isPublic: false,
      downloadable: false
    });
  }

  saveEditedMeeting(): void {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    const meetingId = this.editingMeetingId();
    if (!meetingId) {
      return;
    }

    const value = this.editForm.getRawValue();
    this.updating.set(true);
    this.editError.set(null);

    this.adminApi.updateMeeting(meetingId, {
      title: value.title,
      categoryId: value.categoryId,
      agenda: value.agenda.trim() || null,
      meetingDate: value.meetingDate,
      platform: value.platform,
      meetingUrl: value.meetingUrl.trim() || null,
      status: value.status,
      recordingUrl: value.recordingUrl.trim() || null,
      isPublic: value.isPublic,
      downloadable: value.downloadable
    }).subscribe({
      next: () => {
        const files = this.editAttachmentFiles().map((item) => item.file);
        const removalIds = Array.from(this.pendingAttachmentRemovalIds());
        const operations: Observable<unknown>[] = [
          ...files.map((file) => this.adminApi.uploadMeetingAttachment(meetingId, file)),
          ...removalIds.map((attachmentId) => this.adminApi.removeMeetingAttachment(meetingId, attachmentId))
        ];

        if (operations.length > 0) {
          forkJoin(operations).subscribe({
            next: () => {
              this.updating.set(false);
              this.toast.success('Meeting and attachments updated successfully.');
              this.closeEditModal();
              this.load(this.page());
            },
            error: (err: HttpErrorResponse) => {
              this.updating.set(false);
              const message = err.error?.message || 'Meeting updated, but some attachment changes failed.';
              this.editError.set(message);
              this.toast.error(message);
              this.load(this.page());
            }
          });
          return;
        }

        this.updating.set(false);
        this.toast.success('Meeting updated successfully.');
        this.closeEditModal();
        this.load(this.page());
      },
      error: (err: HttpErrorResponse) => {
        this.updating.set(false);
        const message = err.error?.message || 'Unable to update meeting. Please try again.';
        this.editError.set(message);
        this.toast.error(message);
      }
    });
  }

  requestDeleteMeeting(meeting: MeetingRow): void {
    this.meetingPendingDelete.set(meeting);
  }

  closeDeleteMeetingConfirm(): void {
    if (this.deletingMeetingId()) {
      return;
    }
    this.meetingPendingDelete.set(null);
  }

  confirmDeleteMeeting(): void {
    const meeting = this.meetingPendingDelete();
    if (!meeting) {
      return;
    }

    this.deleteMeeting(meeting);
  }

  deleteMeeting(meeting: MeetingRow): void {
    this.deletingMeetingId.set(meeting.id);
    this.adminApi.deleteMeeting(meeting.id).subscribe({
      next: () => {
        this.deletingMeetingId.set(null);
        this.meetingPendingDelete.set(null);
        this.toast.success('Meeting removed successfully.');
        const currentPage = this.page();
        const shouldMoveBack = this.rows().length === 1 && currentPage > 0;
        this.load(shouldMoveBack ? currentPage - 1 : currentPage);
      },
      error: (err: HttpErrorResponse) => {
        this.deletingMeetingId.set(null);
        this.meetingPendingDelete.set(null);
        const message = err.error?.message || 'Unable to remove meeting. Please try again.';
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

  statusVariant(status: string): string {
    switch (status) {
      case 'COMPLETED': return 'success';
      case 'CANCELLED': return 'danger';
      case 'UPCOMING': return 'warning';
      case 'ONGOING': return 'warning';
      default: return 'info';
    }
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

  private loadCategories(): void {
    this.categoriesLoading.set(true);
    this.adminApi.listActiveCategories('MEETING').subscribe({
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
