import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime } from 'rxjs';
import { MemberApiService } from '../../../core/services/member-api.service';
import { CategoryOption } from '../../../core/services/admin-content-api.service';
import { MediaUrlService } from '../../../core/services/media-url.service';
import { IconComponent } from '../../../shared/icon/icon.component';
import { SecureImageComponent } from '../../../shared/secure-image/secure-image.component';
import { AttachmentPreviewComponent } from '../../../shared/attachment-preview/attachment-preview.component';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';

interface EventRow {
  id: number;
  title: string;
  categoryName: string | null;
  description: string | null;
  eventDate: string;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  venue: string | null;
  bannerPath: string | null;
  status: string;
  isPublic: boolean;
  downloadable: boolean;
  attachments: AttachmentRow[];
  createdAt: string;
}

interface AttachmentRow {
  id: number;
  fileName: string;
  filePath: string;
}

@Component({
  selector: 'app-my-events',
  imports: [IconComponent, SecureImageComponent, AttachmentPreviewComponent, PaginationComponent, DatePipe, ReactiveFormsModule],
  templateUrl: './my-events.component.html'
})
export class MyEventsComponent {
  private static readonly PAGE_SIZE = 5;

  private readonly api = inject(MemberApiService);
  private readonly mediaUrl = inject(MediaUrlService);

  readonly loading = signal(true);
  readonly rows = signal<EventRow[]>([]);
  readonly page = signal(0);
  readonly totalPages = signal(0);
  readonly first = signal(true);
  readonly last = signal(true);
  readonly expandedDescriptionIds = signal<ReadonlySet<number>>(new Set());
  readonly attachmentListTarget = signal<EventRow | null>(null);
  readonly attachmentActionInProgress = signal(false);
  readonly previewOpen = signal(false);
  readonly previewLoading = signal(false);
  readonly previewError = signal<string | null>(null);
  readonly previewAttachmentName = signal('');
  readonly previewBlob = signal<Blob | null>(null);
  readonly categories = signal<CategoryOption[]>([]);
  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly categoryFilter = signal('');
  readonly statusFilter = signal('');

  readonly statuses: Array<'UPCOMING' | 'COMPLETED' | 'CANCELLED'> = ['UPCOMING', 'COMPLETED', 'CANCELLED'];

  constructor() {
    this.load(0);
    this.api.listCategories('EVENT').subscribe((categories) => this.categories.set(categories));
    this.searchControl.valueChanges.pipe(debounceTime(300)).subscribe(() => this.load(0));
  }

  load(page: number): void {
    this.loading.set(true);
    this.api.listPaged<EventRow>('/events', page, MyEventsComponent.PAGE_SIZE, {
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

  openAttachmentList(row: EventRow): void {
    this.attachmentListTarget.set(row);
  }

  closeAttachmentList(): void {
    if (this.attachmentActionInProgress()) {
      return;
    }
    this.attachmentListTarget.set(null);
  }

  openAttachment(attachment: AttachmentRow): void {
    this.previewOpen.set(true);
    this.previewLoading.set(true);
    this.previewError.set(null);
    this.previewAttachmentName.set(attachment.fileName || 'Attachment');
    this.previewBlob.set(null);
    this.attachmentActionInProgress.set(true);
    this.api.fetchStoredFile(attachment.filePath).subscribe({
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
    return this.attachmentListTarget()?.downloadable ?? false;
  }

  closePreviewModal(): void {
    this.previewOpen.set(false);
    this.previewLoading.set(false);
    this.previewError.set(null);
    this.previewAttachmentName.set('');
    this.previewBlob.set(null);
  }

  downloadAttachment(attachment: AttachmentRow): void {
    this.attachmentActionInProgress.set(true);
    this.api.fetchStoredFile(attachment.filePath).subscribe({
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

  statusVariant(status: string): string {
    switch (status) {
      case 'COMPLETED': return 'success';
      case 'CANCELLED': return 'danger';
      case 'UPCOMING': return 'warning';
      default: return 'info';
    }
  }

  categoryBadgeClass(categoryName: string | null): string {
    if (!categoryName) {
      return 'badge badge-soft-secondary';
    }
    return 'badge badge-soft-primary';
  }
}
