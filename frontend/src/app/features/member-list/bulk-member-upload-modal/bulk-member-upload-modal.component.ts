import { Component, computed, inject, input, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, debounceTime, firstValueFrom } from 'rxjs';
import {
  AdminContentApiService,
  BulkMemberRowResult,
  CreateMemberRequest
} from '../../../core/services/admin-content-api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { generateMemberPassword } from '../../../core/utils/password-generator';
import { isValidPhoneNumber } from '../../../core/utils/phone-validator';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';

type RowStatus = 'invalid' | 'ready' | 'success' | 'failed';
type EditableField = 'name' | 'email' | 'flat' | 'wing' | 'phone';

interface ParsedRow {
  rowNumber: number;
  name: string;
  email: string;
  flat: string | null;
  wing: string | null;
  phone: string | null;
  password: string;
  status: RowStatus;
  statusMessage: string | null;
}

const MAX_ROWS = 500;
const PREVIEW_PAGE_SIZE = 10;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Component({
  selector: 'app-bulk-member-upload-modal',
  imports: [PaginationComponent],
  templateUrl: './bulk-member-upload-modal.component.html'
})
export class BulkMemberUploadModalComponent {
  private readonly adminApi = inject(AdminContentApiService);
  private readonly toast = inject(NotificationService);
  private readonly emailRecheckTrigger = new Subject<void>();

  /** Emails already confirmed to exist in the system, accumulated across every check so far. */
  private readonly existingEmails = signal<Set<string>>(new Set());

  readonly open = input(false);
  readonly closed = output<void>();
  readonly imported = output<void>();

  readonly rows = signal<ParsedRow[]>([]);
  readonly fileName = signal('');
  readonly parsing = signal(false);
  readonly parseError = signal<string | null>(null);
  readonly checkingEmails = signal(false);
  readonly submitting = signal(false);
  readonly submitted = signal(false);
  readonly dragActive = signal(false);
  readonly previewPage = signal(0);

  readonly readyCount = computed(() => this.rows().filter((r) => r.status === 'ready').length);
  readonly invalidCount = computed(() => this.rows().filter((r) => r.status === 'invalid').length);
  readonly successCount = computed(() => this.rows().filter((r) => r.status === 'success').length);
  readonly failedCount = computed(() => this.rows().filter((r) => r.status === 'failed').length);

  readonly previewTotalPages = computed(() => Math.max(1, Math.ceil(this.rows().length / PREVIEW_PAGE_SIZE)));
  readonly previewRows = computed(() => {
    const start = this.previewPage() * PREVIEW_PAGE_SIZE;
    return this.rows().slice(start, start + PREVIEW_PAGE_SIZE);
  });
  readonly previewIsFirst = computed(() => this.previewPage() === 0);
  readonly previewIsLast = computed(() => this.previewPage() >= this.previewTotalPages() - 1);

  constructor() {
    this.emailRecheckTrigger.pipe(debounceTime(400)).subscribe(() => {
      void this.flagAlreadyRegisteredEmails();
    });
  }

  goToPreviewPage(page: number): void {
    this.previewPage.set(Math.min(Math.max(page, 0), this.previewTotalPages() - 1));
  }

  close(): void {
    if (this.submitting()) {
      return;
    }
    this.reset();
    this.closed.emit();
  }

  async downloadTemplate(): Promise<void> {
    const { utils, writeFile } = await import('xlsx');
    const worksheet = utils.json_to_sheet([
      { Name: 'Rohan Sharma', Email: 'rohan.sharma@example.com', Flat: '302', Wing: 'A', Phone: '9876543210' }
    ]);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, 'Members');
    writeFile(workbook, 'member-import-template.xlsx');
  }

  onFileChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0] ?? null;
    void this.handleFile(file);
    target.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragActive.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragActive.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragActive.set(false);
    const file = event.dataTransfer?.files?.[0] ?? null;
    void this.handleFile(file);
  }

  /** Lets the admin fix a flagged row (typo, invalid email/phone, etc.) directly in the preview table. */
  updateRowField(rowNumber: number, field: EditableField, rawValue: string): void {
    if (this.submitted()) {
      return;
    }

    this.rows.update((rows) =>
      rows.map((row) => {
        if (row.rowNumber !== rowNumber) {
          return row;
        }
        switch (field) {
          case 'name':
            return { ...row, name: rawValue.trim() };
          case 'email':
            return { ...row, email: rawValue.trim().toLowerCase() };
          case 'flat':
            return { ...row, flat: rawValue.trim() || null };
          case 'wing':
            return { ...row, wing: rawValue.trim() || null };
          case 'phone':
            return { ...row, phone: rawValue.trim() || null };
        }
      })
    );

    this.revalidateAllRows();

    if (field === 'email') {
      this.emailRecheckTrigger.next();
    }
  }

  submit(): void {
    const readyRows = this.rows().filter((row) => row.status === 'ready');
    if (readyRows.length === 0) {
      return;
    }

    this.submitting.set(true);
    const payload: CreateMemberRequest[] = readyRows.map((row) => ({
      name: row.name,
      flat: row.flat,
      wing: row.wing,
      email: row.email,
      phone: row.phone,
      role: 'MEMBER',
      password: row.password
    }));

    this.adminApi.bulkCreateMembers(payload).subscribe({
      next: (response) => {
        this.submitting.set(false);
        this.submitted.set(true);
        this.applyResults(readyRows, response.results);
        this.toast.success(`Imported ${response.successCount} of ${response.totalRows} members.`);
        if (response.successCount > 0) {
          this.imported.emit();
        }
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        const message = err.error?.message || 'Bulk import failed. Please try again.';
        this.toast.error(message);
      }
    });
  }

  private applyResults(submittedRows: ParsedRow[], results: BulkMemberRowResult[]): void {
    const resultByRowNumber = new Map(submittedRows.map((row, index) => [row.rowNumber, results[index]]));
    this.rows.update((rows) =>
      rows.map((row) => {
        const result = resultByRowNumber.get(row.rowNumber);
        if (!result) {
          return row;
        }
        return {
          ...row,
          status: (result.success ? 'success' : 'failed') as RowStatus,
          statusMessage: result.message
        };
      })
    );
  }

  private async handleFile(file: File | null): Promise<void> {
    if (!file) {
      return;
    }

    this.reset();
    this.fileName.set(file.name);
    this.parsing.set(true);

    try {
      const { read, utils } = await import('xlsx');
      const arrayBuffer = await file.arrayBuffer();
      const workbook = read(arrayBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        this.parseError.set('The file has no sheets to read.');
        return;
      }

      const rawRows = utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheetName], { defval: '' });
      if (rawRows.length === 0) {
        this.parseError.set('No rows found in the sheet. Use the template and fill in at least one member.');
        return;
      }
      if (rawRows.length > MAX_ROWS) {
        this.parseError.set(`This file has ${rawRows.length} rows. A maximum of ${MAX_ROWS} members can be imported at once.`);
        return;
      }

      this.rows.set(this.parseRows(rawRows));
      await this.flagAlreadyRegisteredEmails();
    } catch {
      this.parseError.set('Could not read this file. Please upload a valid .xlsx or .xls file.');
    } finally {
      this.parsing.set(false);
    }
  }

  private async flagAlreadyRegisteredEmails(): Promise<void> {
    const candidateEmails = this.rows()
      .filter((row) => row.status === 'ready')
      .map((row) => row.email);

    if (candidateEmails.length === 0) {
      return;
    }

    this.checkingEmails.set(true);
    try {
      const existingEmails = await firstValueFrom(this.adminApi.checkExistingEmails(candidateEmails));
      if (existingEmails.length > 0) {
        const merged = new Set(this.existingEmails());
        existingEmails.forEach((email) => merged.add(email.toLowerCase()));
        this.existingEmails.set(merged);
        this.revalidateAllRows();
      }
    } catch {
      this.toast.warning('Could not verify emails against existing members. Duplicate emails will be reported when you import.');
    } finally {
      this.checkingEmails.set(false);
    }
  }

  /** Re-applies every validation rule (required fields, formats, in-file duplicates, known-registered emails). */
  private revalidateAllRows(): void {
    const seenEmails = new Set<string>();
    const existingEmails = this.existingEmails();
    this.rows.update((rows) => rows.map((row) => this.validateRow(row, seenEmails, existingEmails)));
  }

  private parseRows(rawRows: Record<string, unknown>[]): ParsedRow[] {
    const seenEmails = new Set<string>();
    const existingEmails = this.existingEmails();

    return rawRows.map((raw, index): ParsedRow => {
      const lookup = this.buildLookup(raw);
      const row: ParsedRow = {
        rowNumber: index + 1,
        name: this.textValue(lookup, 'name'),
        email: this.textValue(lookup, 'email').toLowerCase(),
        flat: this.textValue(lookup, 'flat') || null,
        wing: this.textValue(lookup, 'wing') || null,
        phone: this.textValue(lookup, 'phone') || null,
        password: '',
        status: 'ready',
        statusMessage: null
      };
      return this.validateRow(row, seenEmails, existingEmails);
    });
  }

  private validateRow(row: ParsedRow, seenEmails: Set<string>, existingEmails: Set<string>): ParsedRow {
    const { name, email, phone } = row;
    const errors: string[] = [];

    if (!name) {
      errors.push('Name is required');
    }

    if (!email) {
      errors.push('Email is required');
    } else if (!EMAIL_PATTERN.test(email)) {
      errors.push('Email is invalid');
    } else if (seenEmails.has(email)) {
      errors.push('Duplicate email in this file');
    } else {
      seenEmails.add(email);
      if (existingEmails.has(email)) {
        errors.push('Email already registered');
      }
    }

    if (phone && !isValidPhoneNumber(phone)) {
      errors.push('Phone must be a valid 10-digit Indian mobile number');
    }

    return {
      ...row,
      password: name ? generateMemberPassword(name) : '',
      status: errors.length > 0 ? 'invalid' : 'ready',
      statusMessage: errors.length > 0 ? errors.join('; ') : null
    };
  }

  private buildLookup(raw: Record<string, unknown>): Map<string, unknown> {
    const map = new Map<string, unknown>();
    for (const [key, value] of Object.entries(raw)) {
      map.set(key.trim().toLowerCase(), value);
    }
    return map;
  }

  private textValue(lookup: Map<string, unknown>, key: string): string {
    const value = lookup.get(key);
    return value === undefined || value === null ? '' : String(value).trim();
  }

  private reset(): void {
    this.rows.set([]);
    this.fileName.set('');
    this.parseError.set(null);
    this.checkingEmails.set(false);
    this.dragActive.set(false);
    this.submitted.set(false);
    this.previewPage.set(0);
    this.existingEmails.set(new Set());
  }
}
