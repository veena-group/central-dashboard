import { Component, DestroyRef, effect, inject, input, output, signal, untracked } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { IconComponent } from '../icon/icon.component';

type PreviewMode = 'image' | 'pdf' | 'unsupported' | null;

// Deliberately excludes html/htm/svg - those must never be rendered inline (iframe/blob-url) since
// they can contain executable script; anything not recognized here falls through to 'unsupported'.
const EXTENSION_MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf'
};

@Component({
  selector: 'app-attachment-preview',
  imports: [IconComponent],
  templateUrl: './attachment-preview.component.html'
})
export class AttachmentPreviewComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly open = input(false);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly fileName = input('');
  readonly blob = input<Blob | null>(null);
  readonly downloadable = input(true);
  readonly closed = output<void>();

  readonly mode = signal<PreviewMode>(null);
  readonly objectUrl = signal<string | null>(null);
  readonly safeUrl = signal<SafeResourceUrl | null>(null);

  constructor() {
    effect(() => {
      const blob = this.blob();
      const fileName = this.fileName();
      const downloadable = this.downloadable();
      this.render(blob, fileName, downloadable);
    });

    inject(DestroyRef).onDestroy(() => this.revokeObjectUrl());
  }

  close(): void {
    this.closed.emit();
  }

  private render(blob: Blob | null, fileName: string, downloadable: boolean): void {
    this.revokeObjectUrl();

    if (!blob) {
      this.mode.set(null);
      return;
    }

    const mimeType = this.inferMimeType(fileName, blob.type);

    if (mimeType.startsWith('image/')) {
      this.objectUrl.set(URL.createObjectURL(blob));
      this.mode.set('image');
      return;
    }

    if (mimeType === 'application/pdf') {
      const url = URL.createObjectURL(blob);
      this.objectUrl.set(url);
      const finalUrl = !downloadable ? `${url}#toolbar=0&navpanes=0&scrollbar=1&view=FitH` : url;
      this.safeUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(finalUrl));
      this.mode.set('pdf');
      return;
    }

    this.mode.set('unsupported');
  }

  private revokeObjectUrl(): void {
    // untracked: this runs inside the render effect, which also writes objectUrl a few lines later
    // (new blob/pdf case) - reading it as a normal signal here would make the effect depend on its
    // own write, re-triggering itself forever (write -> marks effect dirty -> re-run -> write -> ...).
    const current = untracked(this.objectUrl);
    if (current) {
      URL.revokeObjectURL(current);
    }
    this.objectUrl.set(null);
    this.safeUrl.set(null);
  }

  private inferMimeType(fileName: string, fallbackType: string): string {
    if (fallbackType && fallbackType !== 'application/octet-stream') {
      return fallbackType;
    }

    const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
    return EXTENSION_MIME_MAP[extension] ?? fallbackType ?? 'application/octet-stream';
  }
}
