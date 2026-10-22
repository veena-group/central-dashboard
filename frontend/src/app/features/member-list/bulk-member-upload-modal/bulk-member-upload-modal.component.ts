import { Component, computed, inject, input, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, debounceTime, firstValueFrom } from 'rxjs';
import {
  AdminContentApiService,
  BulkMemberRowResult,
  CreateMemberRequest
} from '../../../core/services/admin-content-api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { LoginType } from '../../../core/models/auth.model';
import { generateMemberPassword } from '../../../core/utils/password-generator';
import { isValidPhoneNumber } from '../../../core/utils/phone-validator';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';

type RowStatus = 'invalid' | 'ready' | 'success' | 'failed';
type EditableField = 'name' | 'email' | 'flat' | 'wing' | 'phone' | 'password';

interface ParsedRow {
  rowNumber: number;
  name: string;
  email: string;
  flat: string | null;
  wing: string | null;
  phone: string | null;
  /** Password typed in the file's Password column, if any. Empty means auto-generate from the name. */
  rawPassword: string;
  password: string;
  status: RowStatus;
  statusMessage: string | null;
}

const MIN_PASSWORD_LENGTH = 4;

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
  /** Same, for mobile numbers within this society (only checked when the society signs in by mobile). */
  private readonly existingPhones = signal<Set<string>>(new Set());

  readonly open = input(false);
  /** How this society's members sign in: decides whether Email or Phone is the mandatory column. */
  readonly loginType = input<LoginType>('EMAIL');
  readonly mobileLogin = computed(() => this.loginType() === 'MOBILE');
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
      void this.flagAlreadyRegisteredContacts();
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
      { Name: 'Rohan Sharma', Email: 'rohan.sharma@example.com', Flat: '302', Wing: 'A', Phone: '9876543210', Password: '' }
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
            return { ...row, phone: BulkMemberUploadModalComponent.cleanPhone(rawValue) };
          case 'password':
            return { ...row, rawPassword: rawValue.trim() };
        }
      })
    );

    this.revalidateAllRows();

    if (field === 'email' || field === 'phone') {
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
      email: row.email || null,
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
      await this.flagAlreadyRegisteredContacts();
    } catch {
      this.parseError.set('Could not read this file. Please upload a valid .xlsx or .xls file.');
    } finally {
      this.parsing.set(false);
    }
  }

  private async flagAlreadyRegisteredContacts(): Promise<void> {
    const readyRows = this.rows().filter((row) => row.status === 'ready');
    const candidateEmails = readyRows.map((row) => row.email).filter((email) => !!email);
    const candidatePhones = this.mobileLogin()
      ? readyRows.map((row) => row.phone).filter((phone): phone is string => !!phone)
      : [];

    if (candidateEmails.length === 0 && candidatePhones.length === 0) {
      return;
    }

    this.checkingEmails.set(true);
    try {
      let changed = false;
      if (candidateEmails.length > 0) {
        const existingEmails = await firstValueFrom(this.adminApi.checkExistingEmails(candidateEmails));
        if (existingEmails.length > 0) {
          const merged = new Set(this.existingEmails());
          existingEmails.forEach((email) => merged.add(email.toLowerCase()));
          this.existingEmails.set(merged);
          changed = true;
        }
      }
      if (candidatePhones.length > 0) {
        const existingPhones = await firstValueFrom(this.adminApi.checkExistingPhones(candidatePhones));
        if (existingPhones.length > 0) {
          const merged = new Set(this.existingPhones());
          existingPhones.forEach((phone) => merged.add(phone));
          this.existingPhones.set(merged);
          changed = true;
        }
      }
      if (changed) {
        this.revalidateAllRows();
      }
    } catch {
      this.toast.warning('Could not verify entries against existing members. Duplicates will be reported when you import.');
    } finally {
      this.checkingEmails.set(false);
    }
  }

  /** Re-applies every validation rule (required fields, formats, in-file duplicates, known-registered emails / phones). */
  private revalidateAllRows(): void {
    const seen = { emails: new Set<string>(), phones: new Set<string>() };
    const existing = { emails: this.existingEmails(), phones: this.existingPhones() };
    this.rows.update((rows) => rows.map((row) => this.validateRow(row, seen, existing)));
  }

  private parseRows(rawRows: Record<string, unknown>[]): ParsedRow[] {
    const seen = { emails: new Set<string>(), phones: new Set<string>() };
    const existing = { emails: this.existingEmails(), phones: this.existingPhones() };

    return rawRows.map((raw, index): ParsedRow => {
      const lookup = this.buildLookup(raw);
      const row: ParsedRow = {
        rowNumber: index + 1,
        name: this.textValue(lookup, 'name'),
        email: this.textValue(lookup, 'email').toLowerCase(),
        flat: this.textValue(lookup, 'flat') || null,
        wing: this.textValue(lookup, 'wing') || null,
        phone: BulkMemberUploadModalComponent.cleanPhone(this.textValue(lookup, 'phone')),
        rawPassword: this.textValue(lookup, 'password'),
        password: '',
        status: 'ready',
        statusMessage: null
      };
      return this.validateRow(row, seen, existing);
    });
  }

  private validateRow(
    row: ParsedRow,
    seen: { emails: Set<string>; phones: Set<string> },
    existing: { emails: Set<string>; phones: Set<string> }
  ): ParsedRow {
    const { name, email, phone } = row;
    const errors: string[] = [];
    const mobileLogin = this.mobileLogin();

    if (!name) {
      errors.push('Name is required');
    }

    // The society's sign-in identifier is mandatory; the other one is optional but still checked when given.
    if (!email) {
      if (!mobileLogin) {
        errors.push('Email is required');
      }
    } else if (!EMAIL_PATTERN.test(email)) {
      errors.push('Email is invalid');
    } else if (seen.emails.has(email)) {
      errors.push('Duplicate email in this file');
    } else {
      seen.emails.add(email);
      if (existing.emails.has(email)) {
        errors.push('Email already registered');
      }
    }

    if (!phone) {
      if (mobileLogin) {
        errors.push('Phone is required');
      }
    } else if (!isValidPhoneNumber(phone)) {
      errors.push('Phone must be a valid 10-digit Indian mobile number');
    } else if (mobileLogin) {
      if (seen.phones.has(phone)) {
        errors.push('Duplicate phone in this file');
      } else {
        seen.phones.add(phone);
        if (existing.phones.has(phone)) {
          errors.push('Phone already registered');
        }
      }
    }

    if (row.rawPassword && row.rawPassword.length < MIN_PASSWORD_LENGTH) {
      errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }

    return {
      ...row,
      password: row.rawPassword || (name ? generateMemberPassword(name) : ''),
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
    this.existingPhones.set(new Set());
  }

  /** Strips spaces and hyphens (e.g. "98765 43210"); blank becomes null. */
  private static cleanPhone(value: string): string | null {
    return value.replace(/[\s-]/g, '') || null;
  }
}
