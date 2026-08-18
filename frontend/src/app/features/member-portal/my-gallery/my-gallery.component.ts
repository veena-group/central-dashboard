import { Component, inject, signal } from '@angular/core';
import { MemberApiService } from '../../../core/services/member-api.service';
import { CategoryOption } from '../../../core/services/admin-content-api.service';
import { SecureImageComponent } from '../../../shared/secure-image/secure-image.component';
import { IconComponent } from '../../../shared/icon/icon.component';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';
import { environment } from '../../../../environments/environment';

interface GalleryRow {
  id: number;
  albumName: string | null;
  title: string | null;
  description: string | null;
}

@Component({
  selector: 'app-my-gallery',
  imports: [SecureImageComponent, IconComponent, PaginationComponent],
  templateUrl: './my-gallery.component.html'
})
export class MyGalleryComponent {
  private static readonly PAGE_SIZE = 10;

  private readonly api = inject(MemberApiService);

  readonly loading = signal(true);
  readonly rows = signal<GalleryRow[]>([]);
  readonly page = signal(0);
  readonly totalPages = signal(0);
  readonly first = signal(true);
  readonly last = signal(true);
  readonly zoomTarget = signal<GalleryRow | null>(null);
  readonly categories = signal<CategoryOption[]>([]);
  readonly albumFilter = signal('');

  constructor() {
    this.load(0);
    this.api.listCategories('GALLERY_ALBUM').subscribe((categories) => this.categories.set(categories));
  }

  load(page: number): void {
    this.loading.set(true);
    this.api.listPaged<GalleryRow>('/gallery', page, MyGalleryComponent.PAGE_SIZE, {
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

  viewUrl(galleryId: number): string {
    return `${environment.apiBaseUrl}/member/gallery/${galleryId}/view`;
  }

  openZoom(item: GalleryRow): void {
    this.zoomTarget.set(item);
  }

  closeZoom(): void {
    this.zoomTarget.set(null);
  }
}
