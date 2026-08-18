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
import { generateMemberPassword } from '../../core/utils/password-generator';
import { phoneNumberValidator } from '../../core/utils/phone-validator';
import { BulkMemberUploadModalComponent } from './bulk-member-upload-modal/bulk-member-upload-modal.component';

interface MemberRow {
  id: number;
  name: string;
  flat: string;
  wing: string;
  email: string;
  phone: string;
  role: string;
  photoUrl: string | null;
}

@Component({
  selector: 'app-member-list',
  imports: [PaginationComponent, AvatarComponent, ReactiveFormsModule, ConfirmModalComponent, IconComponent, BulkMemberUploadModalComponent],
  templateUrl: './member-list.component.html'
})
export class MemberListComponent {
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
  readonly showBulkUploadModal = signal(false);
  readonly creating = signal(false);
  readonly updating = signal(false);
  readonly deletingMemberId = signal<number | null>(null);
  readonly memberPendingDelete = signal<MemberRow | null>(null);
  readonly createError = signal<string | null>(null);
  readonly editError = signal<string | null>(null);
  readonly createPhotoError = signal<string | null>(null);
  readonly createPhotoFileName = signal('');
  readonly createPhotoFileType = signal('');
  readonly createPhotoFileSize = signal('');
  readonly createPhotoPreviewUrl = signal<string | null>(null);
  readonly createPhotoDragActive = signal(false);
  readonly rows = signal<MemberRow[]>([]);
  readonly page = signal(0);
  readonly totalPages = signal(0);
  readonly first = signal(true);
  readonly last = signal(true);
  readonly editingMemberId = signal<number | null>(null);

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly roleFilter = signal('');

  private selectedCreatePhotoFile: File | null = null;

  readonly createForm = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    flat: [''],
    wing: [''],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [phoneNumberValidator()]],
    role: ['MEMBER' as 'MEMBER' | 'SOCIETY_ADMIN', [Validators.required]],
    password: ['', [Validators.required]]
  });

  readonly editForm = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    flat: [''],
    wing: [''],
    phone: ['', [phoneNumberValidator()]],
    role: ['MEMBER' as 'MEMBER' | 'SOCIETY_ADMIN', [Validators.required]]
  });

  constructor() {
    this.load(0);
    this.searchControl.valueChanges.pipe(debounceTime(300)).subscribe(() => this.load(0));
    this.createForm.controls.name.valueChanges.subscribe((name) => {
      this.createForm.controls.password.setValue(generateMemberPassword(name), { emitEvent: false });
    });
  }

  load(page: number): void {
    this.loading.set(true);
    this.api.list<MemberRow>('/admin/members', page, 10, {
      search: this.searchControl.value.trim() || undefined,
      role: this.roleFilter() || undefined
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

  setRoleFilter(value: string): void {
    this.roleFilter.set(value);
    this.load(0);
  }

  hasActiveFilters(): boolean {
    return !!this.searchControl.value.trim() || !!this.roleFilter();
  }

  clearFilters(): void {
    this.searchControl.setValue('', { emitEvent: false });
    this.roleFilter.set('');
    this.load(0);
  }

  openCreateModal(): void {
    this.createError.set(null);
    this.createForm.controls.password.setValue(generateMemberPassword(this.createForm.controls.name.value));
    this.showCreateModal.set(true);
  }

  openBulkUploadModal(): void {
    this.showBulkUploadModal.set(true);
  }

  closeBulkUploadModal(): void {
    this.showBulkUploadModal.set(false);
  }

  onBulkImportComplete(): void {
    this.load(0);
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
      flat: '',
      wing: '',
      email: '',
      phone: '',
      role: 'MEMBER',
      password: ''
    });
  }

  createMember(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    const value = this.createForm.getRawValue();
    this.creating.set(true);
    this.createError.set(null);

    this.adminApi.createMember({
      name: value.name,
      flat: value.flat.trim() || null,
      wing: value.wing.trim() || null,
      email: value.email,
      phone: value.phone.trim() || null,
      role: value.role,
      password: value.password
    }).subscribe({
      next: (memberId) => {
        if (this.selectedCreatePhotoFile) {
          this.adminApi.uploadMemberPhoto(memberId, this.selectedCreatePhotoFile).subscribe({
            next: () => {
              this.creating.set(false);
              this.toast.success('Member created with photo successfully.');
              this.closeCreateModal();
              this.load(0);
            },
            error: (err: HttpErrorResponse) => {
              this.creating.set(false);
              const message = err.error?.message || 'Member created, but photo upload failed.';
              this.createError.set(message);
              this.toast.error(message);
              this.closeCreateModal();
              this.load(0);
            }
          });
          return;
        }

        this.creating.set(false);
        this.toast.success('Member created successfully.');
        this.closeCreateModal();
        this.load(0);
      },
      error: (err: HttpErrorResponse) => {
        this.creating.set(false);
        const message = err.error?.message || 'Unable to create member. Please try again.';
        this.createError.set(message);
        this.toast.error(message);
      }
    });
  }

  openEditModal(member: MemberRow): void {
    this.editingMemberId.set(member.id);
    this.editError.set(null);
    this.editForm.reset({
      name: member.name,
      flat: member.flat || '',
      wing: member.wing || '',
      phone: member.phone || '',
      role: (member.role as 'MEMBER' | 'SOCIETY_ADMIN')
    });
    this.showEditModal.set(true);
  }

  closeEditModal(): void {
    this.showEditModal.set(false);
    this.updating.set(false);
    this.editingMemberId.set(null);
    this.editError.set(null);
    this.editForm.reset({
      name: '',
      flat: '',
      wing: '',
      phone: '',
      role: 'MEMBER'
    });
  }

  saveEditedMember(): void {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    const memberId = this.editingMemberId();
    if (!memberId) {
      return;
    }

    const value = this.editForm.getRawValue();

    this.updating.set(true);
    this.editError.set(null);

    this.adminApi.updateMember(memberId, {
      name: value.name,
      flat: value.flat.trim() || null,
      wing: value.wing.trim() || null,
      phone: value.phone.trim() || null,
      role: value.role
    }).subscribe({
      next: () => {
        this.updating.set(false);
        this.toast.success('Member updated successfully.');
        this.closeEditModal();
        this.load(this.page());
      },
      error: (err: HttpErrorResponse) => {
        this.updating.set(false);
        const message = err.error?.message || 'Unable to update member. Please try again.';
        this.editError.set(message);
        this.toast.error(message);
      }
    });
  }

  requestDeleteMember(member: MemberRow): void {
    this.memberPendingDelete.set(member);
  }

  closeDeleteMemberConfirm(): void {
    if (this.deletingMemberId()) {
      return;
    }
    this.memberPendingDelete.set(null);
  }

  confirmDeleteMember(): void {
    const member = this.memberPendingDelete();
    if (!member) {
      return;
    }

    this.deleteMember(member);
  }

  deleteMember(member: MemberRow): void {
    this.deletingMemberId.set(member.id);
    this.adminApi.deleteMember(member.id).subscribe({
      next: () => {
        this.deletingMemberId.set(null);
        this.memberPendingDelete.set(null);
        this.toast.success('Member removed successfully.');
        const currentPage = this.page();
        const shouldMoveBack = this.rows().length === 1 && currentPage > 0;
        this.load(shouldMoveBack ? currentPage - 1 : currentPage);
      },
      error: (err: HttpErrorResponse) => {
        this.deletingMemberId.set(null);
        this.memberPendingDelete.set(null);
        const message = err.error?.message || 'Unable to remove member. Please try again.';
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

  canRemoveMember(member: MemberRow): boolean {
    return this.deletingMemberId() !== member.id;
  }

  removeMemberTitle(): string {
    return 'Remove member';
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

    if (file.size > MemberListComponent.MAX_IMAGE_SIZE_BYTES) {
      return 'Image is too large. Maximum allowed size is 10 MB.';
    }

    try {
      const { width, height } = await this.readImageDimensions(file);
      if (width < MemberListComponent.MIN_IMAGE_WIDTH || height < MemberListComponent.MIN_IMAGE_HEIGHT) {
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
