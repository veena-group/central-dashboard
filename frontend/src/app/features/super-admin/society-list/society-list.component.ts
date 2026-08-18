import { Component, ElementRef, inject, QueryList, signal, ViewChild, ViewChildren } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { debounceTime } from 'rxjs';
import { SuperAdminApiService } from '../../../core/services/super-admin-api.service';
import { SocietyResponse, FEATURE_KEYS } from '../../../core/models/super-admin.model';
import { featureLimitValidator } from '../../../core/validators/feature-limit.validator';
import { NotificationService } from '../../../core/services/notification.service';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';
import { IconComponent } from '../../../shared/icon/icon.component';
import { generateMemberPassword } from '../../../core/utils/password-generator';

@Component({
  selector: 'app-society-list',
  imports: [ReactiveFormsModule, RouterLink, PaginationComponent, IconComponent],
  templateUrl: './society-list.component.html'
})
export class SocietyListComponent {
  private readonly api = inject(SuperAdminApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);

  readonly featureKeys = FEATURE_KEYS;

  readonly loading = signal(true);
  readonly rows = signal<SocietyResponse[]>([]);
  readonly page = signal(0);
  readonly totalPages = signal(0);
  readonly first = signal(true);
  readonly last = signal(true);

  readonly hostingStateOptions = ['ACTIVE', 'EXPIRING_SOON', 'EXPIRED'];
  readonly subscriptionStateOptions = ['PAID_UP', 'DUE_SOON', 'OVERDUE'];
  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly hostingStateFilter = signal('');
  readonly subscriptionStateFilter = signal('');

  readonly showAddModal = signal(false);
  readonly creating = signal(false);
  readonly createError = signal<string | null>(null);
  readonly logoFile = signal<File | null>(null);
  readonly logoPreviewUrl = signal<string | null>(null);
  readonly logoDragActive = signal(false);
  readonly logoError = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    societyName: ['', [Validators.required]],
    domain: ['', [Validators.required]],
    primaryColor: ['#0F766E'],
    secondaryColor: ['#F59E0B'],
    domainStartDate: ['', [Validators.required]],
    domainExpiryDate: ['', [Validators.required]],
    adminName: ['', [Validators.required]],
    adminEmail: ['', [Validators.required, Validators.email]],
    adminPhone: [''],
    adminPassword: ['', [Validators.required]],
    features: this.fb.array(
      this.featureKeys.map((key) =>
        this.fb.nonNullable.group(
          {
            featureKey: [key],
            enabled: [false],
            limit: this.fb.control<number | null>(null)
          },
          { validators: featureLimitValidator }
        )
      )
    )
  });

  @ViewChildren('limitInput') private readonly limitInputs!: QueryList<ElementRef<HTMLInputElement>>;
  @ViewChild('modalCard') private readonly modalCard?: ElementRef<HTMLElement>;

  get featureControls() {
    return this.form.controls.features.controls;
  }

  onFeatureToggle(index: number, event: Event): void {
    if ((event.target as HTMLInputElement).checked) {
      this.limitInputs.get(index)?.nativeElement.focus();
    }
  }

  constructor() {
    const queryParams = this.route.snapshot.queryParamMap;
    this.hostingStateFilter.set(queryParams.get('hostingState') ?? '');
    this.subscriptionStateFilter.set(queryParams.get('subscriptionState') ?? '');

    this.load(0);

    this.searchControl.valueChanges.pipe(debounceTime(300)).subscribe(() => this.load(0));
    this.form.controls.adminName.valueChanges.subscribe((name) => {
      this.form.controls.adminPassword.setValue(generateMemberPassword(name), { emitEvent: false });
    });
  }

  load(page: number): void {
    this.loading.set(true);
    this.api
      .listSocieties(page, 10, {
        search: this.searchControl.value.trim() || undefined,
        hostingState: this.hostingStateFilter() || undefined,
        subscriptionState: this.subscriptionStateFilter() || undefined
      })
      .subscribe({
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

  setHostingStateFilter(value: string): void {
    this.hostingStateFilter.set(value);
    this.load(0);
  }

  setSubscriptionStateFilter(value: string): void {
    this.subscriptionStateFilter.set(value);
    this.load(0);
  }

  hasActiveFilters(): boolean {
    return !!this.searchControl.value.trim() || !!this.hostingStateFilter() || !!this.subscriptionStateFilter();
  }

  clearFilters(): void {
    this.searchControl.setValue('', { emitEvent: false });
    this.hostingStateFilter.set('');
    this.subscriptionStateFilter.set('');
    this.load(0);
  }

  hostingVariant(state: string): string {
    switch (state) {
      case 'ACTIVE': return 'success';
      case 'EXPIRED': return 'danger';
      case 'EXPIRING_SOON': return 'warning';
      default: return 'secondary';
    }
  }

  subscriptionVariant(state: string): string {
    switch (state) {
      case 'PAID_UP': return 'success';
      case 'OVERDUE': return 'danger';
      case 'DUE_SOON': return 'warning';
      default: return 'secondary';
    }
  }

  dotClass(variant: string): string {
    switch (variant) {
      case 'success': return 'bg-success';
      case 'warning': return 'bg-warning';
      case 'danger': return 'bg-destructive';
      default: return 'bg-muted-foreground/40';
    }
  }

  openAddModal(): void {
    this.createError.set(null);
    this.form.controls.adminPassword.setValue(generateMemberPassword(this.form.controls.adminName.value));
    this.showAddModal.set(true);
  }

  closeAddModal(): void {
    if (this.creating()) {
      return;
    }
    this.showAddModal.set(false);
    this.form.reset({
      societyName: '',
      domain: '',
      primaryColor: '#0F766E',
      secondaryColor: '#F59E0B',
      domainStartDate: '',
      domainExpiryDate: '',
      adminName: '',
      adminEmail: '',
      adminPhone: '',
      adminPassword: ''
    });
    this.featureKeys.forEach((key, index) => {
      this.form.controls.features.at(index).reset({
        featureKey: key,
        enabled: false,
        limit: null
      });
    });
    this.clearLogoSelection();
  }

  onLogoFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (file) {
      this.setLogoFile(file);
    }
  }

  onLogoDragOver(event: DragEvent): void {
    event.preventDefault();
    this.logoDragActive.set(true);
  }

  onLogoDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.logoDragActive.set(false);
  }

  onLogoDrop(event: DragEvent): void {
    event.preventDefault();
    this.logoDragActive.set(false);
    const file = event.dataTransfer?.files?.[0] ?? null;
    if (file) {
      this.setLogoFile(file);
    }
  }

  clearLogoSelection(): void {
    this.logoDragActive.set(false);
    this.logoError.set(null);
    const current = this.logoPreviewUrl();
    if (current) {
      URL.revokeObjectURL(current);
    }
    this.logoFile.set(null);
    this.logoPreviewUrl.set(null);
  }

  private setLogoFile(file: File): void {
    if (!file.type.startsWith('image/')) {
      this.logoError.set('Only image files are allowed.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.logoError.set('Logo image must be less than 5 MB.');
      return;
    }

    this.clearLogoSelection();
    this.logoError.set(null);
    this.logoFile.set(file);
    this.logoPreviewUrl.set(URL.createObjectURL(file));
  }

  submitAddSociety(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.modalCard?.nativeElement.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    this.creating.set(true);
    this.createError.set(null);

    const value = this.form.getRawValue();
    this.api
      .onboardSociety({
        societyName: value.societyName,
        domain: value.domain,
        primaryColor: value.primaryColor || null,
        secondaryColor: value.secondaryColor || null,
        domainStartDate: value.domainStartDate,
        domainExpiryDate: value.domainExpiryDate,
        adminName: value.adminName,
        adminEmail: value.adminEmail,
        adminPhone: value.adminPhone || null,
        adminPassword: value.adminPassword,
        features: value.features
      })
      .subscribe({
        next: (response) => {
          const logoFile = this.logoFile();
          if (!logoFile) {
            this.creating.set(false);
            this.toast.success('Society onboarded successfully.');
            this.closeAddModal();
            this.load(0);
            return;
          }

          this.api.uploadSocietyLogo(response.societyId, logoFile).subscribe({
            next: () => {
              this.creating.set(false);
              this.toast.success('Society onboarded successfully.');
              this.closeAddModal();
              this.load(0);
            },
            error: () => {
              this.creating.set(false);
              this.toast.warning('Society onboarded, but the logo could not be uploaded.');
              this.closeAddModal();
              this.load(0);
            }
          });
        },
        error: (err) => {
          this.creating.set(false);
          const message = err?.error?.message ?? 'Could not onboard society';
          this.createError.set(message);
          this.toast.error(message);
          this.modalCard?.nativeElement.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
  }
}
