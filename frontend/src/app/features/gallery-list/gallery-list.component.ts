import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin, of, switchMap } from 'rxjs';
import { PagedApiService } from '../../core/services/paged-api.service';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { ConfirmModalComponent } from '../../shared/confirm-modal/confirm-modal.component';
import { AdminContentApiService, CategoryOption } from '../../core/services/admin-content-api.service';
import { NotificationService } from '../../core/services/notification.service';
import { MediaUrlService } from '../../core/services/media-url.service';
import { SecureImageComponent } from '../../shared/secure-image/secure-image.component';
import { IconComponent } from '../../shared/icon/icon.component';

interface GalleryRow {
  id: number;
  albumId: number;
  albumName: string | null;
  title: string | null;
  description: string | null;
  attachmentPath: string;
  isPublic: boolean;
  downloadable: boolean;
}

interface SelectedGalleryImage {
  file: File;
  name: string;
  type: string;
  sizeLabel: string;
  previewUrl: string;
}

@Component({
  selector: 'app-gallery-list',
  imports: [PaginationComponent, ReactiveFormsModule, ConfirmModalComponent, SecureImageComponent, IconComponent],
  templateUrl: './gallery-list.component.html'
})
export class GalleryListComponent {
  private static readonly MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
  private static readonly MIN_IMAGE_WIDTH = 400;
  private static readonly MIN_IMAGE_HEIGHT = 400;
  private static readonly PAGE_SIZE = 8;

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
  readonly deletingGalleryId = signal<number | null>(null);
  readonly galleryPendingDelete = signal<GalleryRow | null>(null);
  readonly categoriesLoading = signal(false);
  readonly createError = signal<string | null>(null);
  readonly editError = signal<string | null>(null);
  readonly selectedImages = signal<SelectedGalleryImage[]>([]);
  readonly uploadDragActive = signal(false);
  readonly categories = signal<CategoryOption[]>([]);
  readonly rows = signal<GalleryRow[]>([]);
  readonly page = signal(0);
  readonly totalPages = signal(0);
  readonly first = signal(true);
  readonly last = signal(true);
  readonly editingGalleryId = signal<number | null>(null);
  readonly editingImagePath = signal<string | null>(null);
  readonly editReplacementImage = signal<SelectedGalleryImage | null>(null);
  readonly editUploadDragActive = signal(false);
  readonly zoomTarget = signal<GalleryRow | null>(null);
  readonly albumFilter = signal('');

  readonly createForm = this.fb.nonNullable.group({
    albumId: [0, [Validators.min(1)]],
    title: [''],
    description: [''],
    isPublic: [true],
    downloadable: [false]
  });

  readonly editForm = this.fb.nonNullable.group({
    albumId: [0, [Validators.min(1)]],
    title: [''],
    description: [''],
    isPublic: [false],
    downloadable: [false]
  });

  constructor() {
    this.load(0);
    this.loadCategories();
  }

  load(page: number): void {
    this.loading.set(true);
    this.api.list<GalleryRow>('/admin/gallery', page, GalleryListComponent.PAGE_SIZE, {
      albumId: this.albumFilter() || undefined
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

  setAlbumFilter(value: string): void {
    this.albumFilter.set(value);
    this.load(0);
  }

  hasActiveFilters(): boolean {
    return !!this.albumFilter();
  }

  clearFilters(): void {
    this.albumFilter.set('');
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
    this.uploadDragActive.set(false);
    this.clearSelectedImages();
    this.createForm.reset({
      albumId: 0,
      title: '',
      description: '',
      isPublic: true,
      downloadable: false
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    void this.addUploadFiles(files);
    input.value = '';
  }

  onUploadDragOver(event: DragEvent): void {
    event.preventDefault();
    this.uploadDragActive.set(true);
  }

  onUploadDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.uploadDragActive.set(false);
  }

  onUploadDrop(event: DragEvent): void {
    event.preventDefault();
    this.uploadDragActive.set(false);
    const files = Array.from(event.dataTransfer?.files ?? []);
    void this.addUploadFiles(files);
  }

  clearSelectedGalleryImages(): void {
    this.uploadDragActive.set(false);
    this.clearSelectedImages();
    this.createError.set(null);
  }

  galleryImageUrl(path: string): string {
    return this.mediaUrl.resolve(path) ?? '';
  }

  openZoom(item: GalleryRow): void {
    this.zoomTarget.set(item);
  }

  closeZoom(): void {
    this.zoomTarget.set(null);
  }

  removeSelectedGalleryImage(index: number): void {
    const items = [...this.selectedImages()];
    const [removed] = items.splice(index, 1);
    if (removed) {
      URL.revokeObjectURL(removed.previewUrl);
    }
    this.selectedImages.set(items);
  }

  createGalleryItem(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    const images = this.selectedImages();
    if (!images.length) {
      const message = 'Please select an image file.';
      this.createError.set(message);
      this.toast.warning(message);
      return;
    }

    const value = this.createForm.getRawValue();
    this.creating.set(true);
    this.createError.set(null);

    forkJoin(
      images.map((item) =>
        this.adminApi.createGalleryItem({
          albumId: value.albumId,
          title: value.title.trim() || null,
          description: value.description.trim() || null,
          isPublic: value.isPublic,
          downloadable: value.downloadable,
          file: item.file
        })
      )
    ).subscribe({
      next: () => {
        this.creating.set(false);
        this.toast.success(`${images.length} photo(s) added successfully.`);
        this.closeCreateModal();
        this.load(0);
      },
      error: (err: HttpErrorResponse) => {
        this.creating.set(false);
        const message = err.error?.message || 'Unable to add gallery item. Please try again.';
        this.createError.set(message);
        this.toast.error(message);
      }
    });
  }

  openEditModal(item: GalleryRow): void {
    this.editingGalleryId.set(item.id);
    this.editingImagePath.set(item.attachmentPath);
    this.editUploadDragActive.set(false);
    this.clearEditReplacementImage();
    this.editError.set(null);
    this.editForm.reset({
      albumId: item.albumId,
      title: item.title ?? '',
      description: item.description ?? '',
      isPublic: item.isPublic,
      downloadable: item.downloadable
    });
    this.showEditModal.set(true);
    this.loadCategories();
  }

  closeEditModal(): void {
    this.showEditModal.set(false);
    this.updating.set(false);
    this.editingGalleryId.set(null);
    this.editingImagePath.set(null);
    this.editUploadDragActive.set(false);
    this.clearEditReplacementImage();
    this.editError.set(null);
    this.editForm.reset({
      albumId: 0,
      title: '',
      description: '',
      isPublic: false,
      downloadable: false
    });
  }

  saveEditedGalleryItem(): void {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    const galleryId = this.editingGalleryId();
    if (!galleryId) {
      return;
    }

    const value = this.editForm.getRawValue();
    const replacement = this.editReplacementImage();
    this.updating.set(true);
    this.editError.set(null);

    this.adminApi.updateGalleryItem(galleryId, {
      albumId: value.albumId,
      title: value.title.trim() || null,
      description: value.description.trim() || null,
      isPublic: value.isPublic,
      downloadable: value.downloadable
    }).pipe(
      switchMap(() => {
        if (!replacement) {
          return of(undefined);
        }
        return this.adminApi.replaceGalleryImage(galleryId, replacement.file);
      })
    ).subscribe({
      next: () => {
        this.updating.set(false);
        this.toast.success(replacement ? 'Gallery item and image updated successfully.' : 'Gallery item updated successfully.');
        this.closeEditModal();
        this.load(this.page());
      },
      error: (err: HttpErrorResponse) => {
        this.updating.set(false);
        const message = err.error?.message || 'Unable to update gallery item. Please try again.';
        this.editError.set(message);
        this.toast.error(message);
      }
    });
  }

  onEditImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file) {
      return;
    }

    void this.setEditReplacementImage(file);
  }

  clearEditReplacementImage(): void {
    this.editUploadDragActive.set(false);
    const current = this.editReplacementImage();
    if (current) {
      URL.revokeObjectURL(current.previewUrl);
    }
    this.editReplacementImage.set(null);
  }

  onEditImageDragOver(event: DragEvent): void {
    event.preventDefault();
    this.editUploadDragActive.set(true);
  }

  onEditImageDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.editUploadDragActive.set(false);
  }

  onEditImageDrop(event: DragEvent): void {
    event.preventDefault();
    this.editUploadDragActive.set(false);
    const file = event.dataTransfer?.files?.[0] ?? null;
    if (!file) {
      return;
    }

    void this.setEditReplacementImage(file);
  }

  requestDeleteGalleryItem(item: GalleryRow): void {
    this.galleryPendingDelete.set(item);
  }

  closeDeleteGalleryConfirm(): void {
    if (this.deletingGalleryId()) {
      return;
    }
    this.galleryPendingDelete.set(null);
  }

  confirmDeleteGalleryItem(): void {
    const item = this.galleryPendingDelete();
    if (!item) {
      return;
    }

    this.deleteGalleryItem(item);
  }

  deleteGalleryItem(item: GalleryRow): void {
    this.deletingGalleryId.set(item.id);
    this.adminApi.deleteGalleryItem(item.id).subscribe({
      next: () => {
        this.deletingGalleryId.set(null);
        this.galleryPendingDelete.set(null);
        this.toast.success('Gallery item removed successfully.');
        const currentPage = this.page();
        const shouldMoveBack = this.rows().length === 1 && currentPage > 0;
        this.load(shouldMoveBack ? currentPage - 1 : currentPage);
      },
      error: (err: HttpErrorResponse) => {
        this.deletingGalleryId.set(null);
        this.galleryPendingDelete.set(null);
        const message = err.error?.message || 'Unable to remove gallery item. Please try again.';
        this.toast.error(message);
      }
    });
  }

  private loadCategories(): void {
    this.categoriesLoading.set(true);
    this.adminApi.listActiveCategories('GALLERY_ALBUM').subscribe({
      next: (categories) => {
        this.categories.set(categories);
        this.categoriesLoading.set(false);

        if (categories.length > 0 && this.createForm.controls.albumId.value === 0) {
          this.createForm.patchValue({ albumId: categories[0].id });
        }
      },
      error: () => {
        this.categoriesLoading.set(false);
      }
    });
  }

  private async addUploadFiles(files: File[]): Promise<void> {
    if (!files.length) {
      return;
    }

    const next = [...this.selectedImages()];
    const known = new Set(next.map((item) => `${item.file.name}:${item.file.size}:${item.file.lastModified}`));

    for (const file of files) {
      const key = `${file.name}:${file.size}:${file.lastModified}`;
      if (known.has(key)) {
        continue;
      }

      const validationError = await this.validateImageFile(file);
      if (validationError) {
        this.createError.set(validationError);
        this.toast.warning(`${file.name}: ${validationError}`);
        continue;
      }

      known.add(key);
      next.push({
        file,
        name: file.name,
        type: this.fileTypeLabel(file),
        sizeLabel: this.formatBytes(file.size),
        previewUrl: URL.createObjectURL(file)
      });
    }

    this.createError.set(null);
    this.selectedImages.set(next);
  }

  private clearSelectedImages(): void {
    this.selectedImages().forEach((item) => URL.revokeObjectURL(item.previewUrl));
    this.selectedImages.set([]);
  }

  private async setEditReplacementImage(file: File): Promise<void> {
    const validationError = await this.validateImageFile(file);
    if (validationError) {
      this.editError.set(validationError);
      this.toast.warning(`${file.name}: ${validationError}`);
      return;
    }

    this.clearEditReplacementImage();
    this.editError.set(null);
    this.editReplacementImage.set({
      file,
      name: file.name,
      type: this.fileTypeLabel(file),
      sizeLabel: this.formatBytes(file.size),
      previewUrl: URL.createObjectURL(file)
    });
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

  private async validateImageFile(file: File): Promise<string | null> {
    if (!file.type.startsWith('image/')) {
      return 'Only image files are allowed.';
    }

    if (file.size > GalleryListComponent.MAX_IMAGE_SIZE_BYTES) {
      return 'Image is too large. Maximum allowed size is 10 MB.';
    }

    try {
      const { width, height } = await this.readImageDimensions(file);
      if (width < GalleryListComponent.MIN_IMAGE_WIDTH || height < GalleryListComponent.MIN_IMAGE_HEIGHT) {
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
