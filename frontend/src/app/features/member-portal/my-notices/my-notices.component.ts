import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime } from 'rxjs';
import { MemberApiService } from '../../../core/services/member-api.service';
import { CategoryOption } from '../../../core/services/admin-content-api.service';
import { IconComponent } from '../../../shared/icon/icon.component';
import { AttachmentPreviewComponent } from '../../../shared/attachment-preview/attachment-preview.component';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';

interface NoticeRow {
  id: number;
  title: string;
  body: string | null;
  categoryName: string | null;
  publishOn: string;
  expireOn: string | null;
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
  selector: 'app-my-notices',
  imports: [IconComponent, AttachmentPreviewComponent, PaginationComponent, DatePipe, ReactiveFormsModule],
  templateUrl: './my-notices.component.html'
})
export class MyNoticesComponent {
  private static readonly PAGE_SIZE = 5;

  private readonly api = inject(MemberApiService);

  readonly loading = signal(true);
  readonly rows = signal<NoticeRow[]>([]);
  readonly page = signal(0);
  readonly totalPages = signal(0);
  readonly first = signal(true);
  readonly last = signal(true);
  readonly expandedDescriptionIds = signal<ReadonlySet<number>>(new Set());
  readonly categories = signal<CategoryOption[]>([]);
  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly categoryFilter = signal('');
  readonly visibilityFilter = signal('');
  readonly attachmentListTarget = signal<NoticeRow | null>(null);
  readonly attachmentActionInProgress = signal(false);
  readonly previewOpen = signal(false);
  readonly previewLoading = signal(false);
  readonly previewError = signal<string | null>(null);
  readonly previewAttachmentName = signal('');
  readonly previewBlob = signal<Blob | null>(null);

  constructor() {
    this.load(0);
    this.api.listCategories('NOTICE').subscribe((categories) => this.categories.set(categories));
    this.searchControl.valueChanges.pipe(debounceTime(300)).subscribe(() => this.load(0));
  }

  load(page: number): void {
    this.loading.set(true);
    this.api.listPaged<NoticeRow>('/notices', page, MyNoticesComponent.PAGE_SIZE, {
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

  openAttachmentList(row: NoticeRow): void {
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
}
