import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { debounceTime } from 'rxjs';
import { PagedApiService } from '../../core/services/paged-api.service';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { AvatarComponent } from '../../shared/avatar/avatar.component';
import { ConfirmModalComponent } from '../../shared/confirm-modal/confirm-modal.component';
import { AdminContentApiService } from '../../core/services/admin-content-api.service';
import { NotificationService } from '../../core/services/notification.service';
import { IconComponent } from '../../shared/icon/icon.component';

interface CommitteeRow {
  id: number;
  name: string;
  designation: string;
  flat: string | null;
  phone: string | null;
  email: string | null;
  servingSince: string | null;
  photoUrl: string | null;
}

@Component({
  selector: 'app-committee-list',
  imports: [PaginationComponent, AvatarComponent, ReactiveFormsModule, ConfirmModalComponent, IconComponent],
  templateUrl: './committee-list.component.html'
})
export class CommitteeListComponent {
  private static readonly MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
  private static readonly MIN_IMAGE_WIDTH = 400;
  private static readonly MIN_IMAGE_HEIGHT = 400;

  private readonly api = inject(PagedApiService);
  private readonly adminApi = inject(AdminContentApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(NotificationService);

  readonly loading = signal(true);
  readonly showCreateModal = signal(false);
  readonly showEditModal = signal(false);
  readonly creating = signal(false);
  readonly updating = signal(false);
  readonly deletingCommitteeId = signal<number | null>(null);
  readonly committeePendingDelete = signal<CommitteeRow | null>(null);
  readonly createError = signal<string | null>(null);
  readonly editError = signal<string | null>(null);
  readonly createPhotoError = signal<string | null>(null);
  readonly createPhotoFileName = signal('');
  readonly createPhotoFileType = signal('');
  readonly createPhotoFileSize = signal('');
  readonly createPhotoPreviewUrl = signal<string | null>(null);
  readonly createPhotoDragActive = signal(false);
  readonly rows = signal<CommitteeRow[]>([]);
  readonly page = signal(0);
  readonly totalPages = signal(0);
  readonly first = signal(true);
  readonly last = signal(true);
  readonly editingCommitteeId = signal<number | null>(null);
  readonly searchControl = new FormControl('', { nonNullable: true });

  private selectedCreatePhotoFile: File | null = null;

  readonly createForm = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    designation: [''],
    flat: [''],
    phone: [''],
    email: ['', [Validators.email]],
    servingSince: ['']
  });

  readonly editForm = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    designation: [''],
    flat: [''],
    phone: [''],
    email: ['', [Validators.email]],
    servingSince: ['']
  });

  constructor() {
    this.load(0);
    this.searchControl.valueChanges.pipe(debounceTime(300)).subscribe(() => this.load(0));
  }

  load(page: number): void {
    this.loading.set(true);
    this.api.list<CommitteeRow>('/admin/committee', page, 10, {
      search: this.searchControl.value.trim() || undefined
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

  hasActiveFilters(): boolean {
    return !!this.searchControl.value.trim();
  }

  clearFilters(): void {
    this.searchControl.setValue('', { emitEvent: false });
    this.load(0);
  }

  openCreateModal(): void {
    this.showCreateModal.set(true);
    this.createError.set(null);
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
    this.creating.set(false);
    this.createError.set(null);
    this.clearCreatePhotoPreview();
    this.createPhotoError.set(null);
    this.createPhotoFileName.set('');
    this.createPhotoFileType.set('');
    this.createPhotoFileSize.set('');
    this.createPhotoDragActive.set(false);
    this.selectedCreatePhotoFile = null;
    this.createForm.reset({
      name: '',
      designation: '',
      flat: '',
      phone: '',
      email: '',
      servingSince: ''
    });
  }

  createCommitteeMember(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    const value = this.createForm.getRawValue();
    this.creating.set(true);
    this.createError.set(null);

    this.adminApi.createCommitteeMember({
      name: value.name,
      designation: value.designation.trim() || null,
      flat: value.flat.trim() || null,
      phone: value.phone.trim() || null,
      email: value.email.trim() || null,
      servingSince: value.servingSince.trim() || null
    }).subscribe({
      next: (committeeId) => {
        if (this.selectedCreatePhotoFile) {
          this.adminApi.uploadCommitteePhoto(committeeId, this.selectedCreatePhotoFile).subscribe({
            next: () => {
              this.creating.set(false);
              this.toast.success('Committee member created with photo successfully.');
              this.closeCreateModal();
              this.load(0);
            },
            error: (err: HttpErrorResponse) => {
              this.creating.set(false);
              const message = err.error?.message || 'Committee member created, but photo upload failed.';
              this.createError.set(message);
              this.toast.error(message);
              this.closeCreateModal();
              this.load(0);
            }
          });
          return;
        }

        this.creating.set(false);
        this.toast.success('Committee member created successfully.');
        this.closeCreateModal();
        this.load(0);
      },
      error: (err: HttpErrorResponse) => {
        this.creating.set(false);
        const message = err.error?.message || 'Unable to create committee member. Please try again.';
        this.createError.set(message);
        this.toast.error(message);
      }
    });
  }

  openEditModal(member: CommitteeRow): void {
    this.editingCommitteeId.set(member.id);
    this.editError.set(null);
    this.editForm.reset({
      name: member.name,
      designation: member.designation || '',
      flat: member.flat || '',
      phone: member.phone || '',
      email: member.email || '',
      servingSince: member.servingSince || ''
    });
    this.showEditModal.set(true);
  }

  closeEditModal(): void {
    this.showEditModal.set(false);
    this.updating.set(false);
    this.editingCommitteeId.set(null);
    this.editError.set(null);
    this.editForm.reset({
      name: '',
      designation: '',
      flat: '',
      phone: '',
      email: '',
      servingSince: ''
    });
  }

  saveEditedCommitteeMember(): void {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    const committeeId = this.editingCommitteeId();
    if (!committeeId) {
      return;
    }

    const value = this.editForm.getRawValue();
    this.updating.set(true);
    this.editError.set(null);

    this.adminApi.updateCommitteeMember(committeeId, {
      name: value.name,
      designation: value.designation.trim() || null,
      flat: value.flat.trim() || null,
      phone: value.phone.trim() || null,
      email: value.email.trim() || null,
      servingSince: value.servingSince.trim() || null
    }).subscribe({
      next: () => {
        this.updating.set(false);
        this.toast.success('Committee member updated successfully.');
        this.closeEditModal();
        this.load(this.page());
      },
      error: (err: HttpErrorResponse) => {
        this.updating.set(false);
        const message = err.error?.message || 'Unable to update committee member. Please try again.';
        this.editError.set(message);
        this.toast.error(message);
      }
    });
  }

  requestDeleteCommitteeMember(member: CommitteeRow): void {
    this.committeePendingDelete.set(member);
  }

  closeDeleteCommitteeConfirm(): void {
    if (this.deletingCommitteeId()) {
      return;
    }
    this.committeePendingDelete.set(null);
  }

  confirmDeleteCommitteeMember(): void {
    const member = this.committeePendingDelete();
    if (!member) {
      return;
    }

    this.deleteCommitteeMember(member);
  }

  deleteCommitteeMember(member: CommitteeRow): void {
    this.deletingCommitteeId.set(member.id);
    this.adminApi.deleteCommitteeMember(member.id).subscribe({
      next: () => {
        this.deletingCommitteeId.set(null);
        this.committeePendingDelete.set(null);
        this.toast.success('Committee member removed successfully.');
        const currentPage = this.page();
        const shouldMoveBack = this.rows().length === 1 && currentPage > 0;
        this.load(shouldMoveBack ? currentPage - 1 : currentPage);
      },
      error: (err: HttpErrorResponse) => {
        this.deletingCommitteeId.set(null);
        this.committeePendingDelete.set(null);
        const message = err.error?.message || 'Unable to remove committee member. Please try again.';
        this.toast.error(message);
      }
    });
  }

  onCreatePhotoFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    void this.setCreatePhotoFile(file);
  }

  onCreatePhotoDragOver(event: DragEvent): void {
    event.preventDefault();
    this.createPhotoDragActive.set(true);
  }

  onCreatePhotoDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.createPhotoDragActive.set(false);
  }

  onCreatePhotoDrop(event: DragEvent): void {
    event.preventDefault();
    this.createPhotoDragActive.set(false);
    const file = event.dataTransfer?.files?.[0] ?? null;
    void this.setCreatePhotoFile(file);
  }

  clearCreatePhotoSelection(): void {
    this.createPhotoDragActive.set(false);
    this.createPhotoError.set(null);
    void this.setCreatePhotoFile(null);
  }

  private async setCreatePhotoFile(file: File | null): Promise<void> {
    this.clearCreatePhotoPreview();

    if (!file) {
      this.selectedCreatePhotoFile = null;
      this.createPhotoFileName.set('');
      this.createPhotoFileType.set('');
      this.createPhotoFileSize.set('');
      return;
    }

    const validationError = await this.validateImageFile(file);
    if (validationError) {
      this.selectedCreatePhotoFile = null;
      this.createPhotoFileName.set('');
      this.createPhotoFileType.set('');
      this.createPhotoFileSize.set('');
      this.createPhotoError.set(validationError);
      this.toast.warning(validationError);
      return;
    }

    this.createPhotoError.set(null);
    this.selectedCreatePhotoFile = file;
    this.createPhotoFileName.set(file.name);
    this.createPhotoFileType.set(this.fileTypeLabel(file));
    this.createPhotoFileSize.set(this.formatBytes(file.size));
    this.createPhotoPreviewUrl.set(URL.createObjectURL(file));
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

  private clearCreatePhotoPreview(): void {
    const previewUrl = this.createPhotoPreviewUrl();
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      this.createPhotoPreviewUrl.set(null);
    }
  }

  private async validateImageFile(file: File): Promise<string | null> {
    if (!file.type.startsWith('image/')) {
      return 'Only image files are allowed.';
    }

    if (file.size > CommitteeListComponent.MAX_IMAGE_SIZE_BYTES) {
      return 'Image is too large. Maximum allowed size is 10 MB.';
    }

    try {
      const { width, height } = await this.readImageDimensions(file);
      if (width < CommitteeListComponent.MIN_IMAGE_WIDTH || height < CommitteeListComponent.MIN_IMAGE_HEIGHT) {
        return 'Image dimensions are too small. Minimum size is 400x400 px.';
      }
    } catch {
      return 'Could not read image. Please choose a valid image file.';
    }

    return null;
  }

  private readImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const tempUrl = URL.createObjectURL(file);
      const image = new Image();

      image.onload = () => {
        const width = image.naturalWidth;
        const height = image.naturalHeight;
        URL.revokeObjectURL(tempUrl);
        resolve({ width, height });
      };

      image.onerror = () => {
        URL.revokeObjectURL(tempUrl);
        reject(new Error('invalid image'));
      };

      image.src = tempUrl;
    });
  }
}
