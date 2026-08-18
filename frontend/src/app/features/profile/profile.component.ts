import { Component, OnDestroy, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProfileApiService } from '../../core/services/profile-api.service';
import { MyProfileResponse } from '../../core/models/profile.model';
import { AvatarComponent } from '../../shared/avatar/avatar.component';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-profile',
  imports: [ReactiveFormsModule, AvatarComponent, DatePipe],
  templateUrl: './profile.component.html'
})
export class ProfileComponent implements OnDestroy {
  private readonly api = inject(ProfileApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(NotificationService);
  private readonly auth = inject(AuthService);

  readonly profile = signal<MyProfileResponse | null>(null);
  readonly loading = signal(true);
  readonly editingProfile = signal(false);
  readonly savingProfile = signal(false);
  readonly uploadingPhoto = signal(false);
  readonly showPhotoModal = signal(false);
  readonly photoDropActive = signal(false);
  readonly stagedPhotoFile = signal<File | null>(null);
  readonly stagedPhotoPreviewUrl = signal<string | null>(null);

  readonly submitting = signal(false);
  readonly successMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly showCurrentPassword = signal(false);
  readonly showNewPassword = signal(false);

  readonly profileForm = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    phone: [''],
    wing: [''],
    flat: ['']
  });

  readonly passwordForm = this.fb.nonNullable.group({
    currentPassword: ['', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(8)]]
  });

  constructor() {
    this.api.getMyProfile().subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.auth.syncCurrentUserFromProfile(profile);
        this.patchProfileForm(profile);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  startEditProfile(): void {
    const current = this.profile();
    if (!current) {
      return;
    }
    this.patchProfileForm(current);
    this.editingProfile.set(true);
  }

  cancelEditProfile(): void {
    this.editingProfile.set(false);
    const current = this.profile();
    if (current) {
      this.patchProfileForm(current);
    }
  }

  saveProfile(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    const value = this.profileForm.getRawValue();
    this.savingProfile.set(true);
    this.api.updateMyProfile({
      name: value.name.trim(),
      phone: this.normalizeOptional(value.phone),
      wing: this.normalizeOptional(value.wing),
      flat: this.normalizeOptional(value.flat)
    }).subscribe({
      next: (updated) => {
        this.profile.set(updated);
        this.auth.syncCurrentUserFromProfile(updated);
        this.patchProfileForm(updated);
        this.savingProfile.set(false);
        this.editingProfile.set(false);
        this.toast.success('Profile updated successfully.');
      },
      error: (err) => {
        this.savingProfile.set(false);
        const message = err?.error?.message ?? 'Could not update profile';
        this.toast.error(message);
      }
    });
  }

  onProfilePhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }

    this.stageProfilePhoto(file);
  }

  openPhotoModal(): void {
    this.showPhotoModal.set(true);
  }

  closePhotoModal(): void {
    if (this.uploadingPhoto()) {
      return;
    }
    this.showPhotoModal.set(false);
    this.clearStagedPhoto();
  }

  onPhotoDragOver(event: DragEvent): void {
    event.preventDefault();
    this.photoDropActive.set(true);
  }

  onPhotoDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.photoDropActive.set(false);
  }

  onPhotoDrop(event: DragEvent): void {
    event.preventDefault();
    this.photoDropActive.set(false);
    const file = event.dataTransfer?.files?.[0] ?? null;
    if (!file) {
      return;
    }
    this.stageProfilePhoto(file);
  }

  uploadStagedPhoto(): void {
    const file = this.stagedPhotoFile();
    if (!file) {
      this.toast.warning('Please select a photo first.');
      return;
    }

    this.uploadingPhoto.set(true);
    this.api.uploadMyPhoto(file).subscribe({
      next: (updated) => {
        this.profile.set(updated);
        this.auth.syncCurrentUserFromProfile(updated);
        this.patchProfileForm(updated);
        this.uploadingPhoto.set(false);
        this.showPhotoModal.set(false);
        this.clearStagedPhoto();
        this.toast.success('Profile photo updated successfully.');
      },
      error: (err) => {
        this.uploadingPhoto.set(false);
        const message = err?.error?.message ?? 'Could not update profile photo';
        this.toast.error(message);
      }
    });
  }

  clearStagedPhoto(): void {
    const currentUrl = this.stagedPhotoPreviewUrl();
    if (currentUrl) {
      URL.revokeObjectURL(currentUrl);
    }
    this.stagedPhotoFile.set(null);
    this.stagedPhotoPreviewUrl.set(null);
    this.photoDropActive.set(false);
  }

  ngOnDestroy(): void {
    this.clearStagedPhoto();
  }

  private stageProfilePhoto(file: File): void {
    if (file.size > 10 * 1024 * 1024) {
      this.toast.warning('Photo size must be less than 10 MB.');
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.toast.warning('Please select an image file.');
      return;
    }

    this.clearStagedPhoto();
    this.stagedPhotoFile.set(file);
    this.stagedPhotoPreviewUrl.set(URL.createObjectURL(file));
  }

  submitPasswordChange(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.successMessage.set(null);
    this.errorMessage.set(null);

    this.api.changePassword(this.passwordForm.getRawValue()).subscribe({
      next: () => {
        this.submitting.set(false);
        this.successMessage.set('Password changed successfully.');
        this.toast.success('Password changed successfully.');
        this.passwordForm.reset();
      },
      error: (err) => {
        this.submitting.set(false);
        const message = err?.error?.message ?? 'Could not change password';
        this.errorMessage.set(message);
        this.toast.error(message);
      }
    });
  }

  private patchProfileForm(profile: MyProfileResponse): void {
    this.profileForm.reset({
      name: profile.name ?? '',
      phone: profile.phone ?? '',
      wing: profile.wing ?? '',
      flat: profile.flat ?? ''
    });
  }

  private normalizeOptional(value: string): string | null {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}
