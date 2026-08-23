import { Component, DestroyRef, effect, inject, input, output, signal, untracked } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { IconComponent } from '../icon/icon.component';

type PreviewMode = 'image' | 'pdf' | 'docx' | 'xlsx' | 'unsupported' | null;

interface SheetPreview {
  name: string;
  rows: string[][];
  truncated: boolean;
}

const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MAX_PREVIEW_ROWS = 300;

// Deliberately excludes html/htm/svg - those must never be rendered inline (iframe/blob-url) since
// they can contain executable script; anything not recognized here falls through to 'unsupported'.
const EXTENSION_MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf',
  docx: MIME_DOCX,
  xlsx: MIME_XLSX
};

@Component({
  selector: 'app-attachment-preview',
  imports: [IconComponent],
  templateUrl: './attachment-preview.component.html'
})
export class AttachmentPreviewComponent {
  private readonly sanitizer = inject(DomSanitizer);

  // Mobile browsers generally don't give an iframe-embedded PDF the same full, touch-scrollable
  // native viewer that desktop browsers do, so phones/tablets get the "open in native viewer"
  // fallback instead. Deliberately checks for NO fine pointer available at all (not just "is a
  // coarse pointer available") - `pointer: coarse` alone also matches touchscreen laptops/desktops
  // that still have a mouse/trackpad, which don't have this PDF-in-iframe limitation.
  protected readonly isTouchDevice =
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(pointer: coarse)').matches &&
    !window.matchMedia?.('(any-pointer: fine)').matches;

  readonly open = input(false);
  readonly loading = input(false);
  readonly loadingProgress = input<number | null>(null);
  readonly error = input<string | null>(null);
  readonly fileName = input('');
  readonly blob = input<Blob | null>(null);
  readonly downloadable = input(true);
  readonly closed = output<void>();
  readonly download = output<void>();

  readonly mode = signal<PreviewMode>(null);
  readonly objectUrl = signal<string | null>(null);
  readonly safeUrl = signal<SafeResourceUrl | null>(null);
  readonly converting = signal(false);
  readonly docHtml = signal<string | null>(null);
  readonly sheets = signal<SheetPreview[]>([]);
  readonly activeSheetIndex = signal(0);

  // Guards against a stale docx/xlsx conversion (still running when the user switches to a
  // different attachment) overwriting the state of the render that superseded it.
  private renderToken = 0;

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
    if (this.loading() || this.converting()) {
      return;
    }
    this.closed.emit();
  }

  setActiveSheet(index: number): void {
    this.activeSheetIndex.set(index);
  }

  private render(blob: Blob | null, fileName: string, downloadable: boolean): void {
    this.revokeObjectUrl();
    const token = ++this.renderToken;
    this.mode.set(null);
    this.converting.set(false);
    this.docHtml.set(null);
    this.sheets.set([]);
    this.activeSheetIndex.set(0);

    if (!blob) {
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

    if (mimeType === MIME_DOCX) {
      this.converting.set(true);
      void this.renderDocx(blob, token);
      return;
    }

    if (mimeType === MIME_XLSX) {
      this.converting.set(true);
      void this.renderXlsx(blob, token);
      return;
    }

    this.mode.set('unsupported');
  }

  private async renderDocx(blob: Blob, token: number): Promise<void> {
    try {
      const mammoth = await import('mammoth');
      const arrayBuffer = await blob.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      if (token !== this.renderToken) {
        return;
      }
      this.docHtml.set(result.value);
      this.mode.set('docx');
    } catch {
      if (token === this.renderToken) {
        this.mode.set('unsupported');
      }
    } finally {
      if (token === this.renderToken) {
        this.converting.set(false);
      }
    }
  }

  private async renderXlsx(blob: Blob, token: number): Promise<void> {
    try {
      const { read, utils } = await import('xlsx');
      const arrayBuffer = await blob.arrayBuffer();
      const workbook = read(arrayBuffer, { type: 'array' });
      if (token !== this.renderToken) {
        return;
      }

      const sheets: SheetPreview[] = workbook.SheetNames.map((name) => {
        const raw = utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1, defval: '' }) as unknown[][];
        const truncated = raw.length > MAX_PREVIEW_ROWS;
        const rows = (truncated ? raw.slice(0, MAX_PREVIEW_ROWS) : raw)
          .map((row) => row.map((cell) => String(cell ?? '')));
        return { name, rows, truncated };
      });

      if (!sheets.length) {
        this.mode.set('unsupported');
        return;
      }

      this.sheets.set(sheets);
      this.activeSheetIndex.set(0);
      this.mode.set('xlsx');
    } catch {
      if (token === this.renderToken) {
        this.mode.set('unsupported');
      }
    } finally {
      if (token === this.renderToken) {
        this.converting.set(false);
      }
    }
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
