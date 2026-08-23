import { Component, computed, inject, input, output } from '@angular/core';
import { SecureImageComponent } from '../secure-image/secure-image.component';
import { IconComponent } from '../icon/icon.component';
import { MediaUrlService } from '../../core/services/media-url.service';

type AttachmentKind = 'image' | 'pdf' | 'docx' | 'xlsx' | 'other';

const KIND_META: Record<Exclude<AttachmentKind, 'image'>, { label: string; badgeClass: string }> = {
  pdf: { label: 'PDF', badgeClass: 'bg-red-500/15 text-red-600' },
  docx: { label: 'DOC', badgeClass: 'bg-blue-500/15 text-blue-600' },
  xlsx: { label: 'XLS', badgeClass: 'bg-green-500/15 text-green-700' },
  other: { label: 'FILE', badgeClass: 'bg-slate-500/15 text-slate-600' }
};

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp']);

@Component({
  selector: 'app-attachment-card',
  imports: [SecureImageComponent, IconComponent],
  templateUrl: './attachment-card.component.html'
})
export class AttachmentCardComponent {
  private readonly mediaUrl = inject(MediaUrlService);

  readonly fileName = input.required<string>();
  readonly filePath = input.required<string>();
  readonly disabled = input(false);
  readonly downloadable = input(false);
  readonly view = output<void>();
  readonly download = output<void>();

  protected readonly kind = computed<AttachmentKind>(() => {
    const extension = this.fileName().split('.').pop()?.toLowerCase() ?? '';
    if (IMAGE_EXTENSIONS.has(extension)) {
      return 'image';
    }
    if (extension === 'pdf' || extension === 'docx' || extension === 'xlsx') {
      return extension;
    }
    return 'other';
  });

  protected readonly imageUrl = computed(() => this.mediaUrl.resolve(this.filePath()) ?? '');

  protected readonly label = computed(() => {
    const kind = this.kind();
    return kind === 'image' ? '' : KIND_META[kind].label;
  });

  protected readonly badgeClass = computed(() => {
    const kind = this.kind();
    return kind === 'image' ? '' : KIND_META[kind].badgeClass;
  });

  onDownloadClick(event: MouseEvent): void {
    event.stopPropagation();
    this.download.emit();
  }
}
