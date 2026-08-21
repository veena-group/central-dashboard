import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SuperAdminApiService } from '../../../core/services/super-admin-api.service';
import {
  DomainRenewalResponse,
  FEATURE_KEYS,
  FeatureResponse,
  PaymentResponse,
  SocietyAdminResponse,
  SocietyResponse
} from '../../../core/models/super-admin.model';
import { featureLimitValidator } from '../../../core/validators/feature-limit.validator';
import { NotificationService } from '../../../core/services/notification.service';
import { IconComponent, IconName } from '../../../shared/icon/icon.component';
import { AvatarComponent } from '../../../shared/avatar/avatar.component';
import { SecureImageComponent } from '../../../shared/secure-image/secure-image.component';
import { MediaUrlService } from '../../../core/services/media-url.service';

type SocietyDetailTab = 'overview' | 'domain' | 'features' | 'admin' | 'payments';

const TAB_ICONS: Record<SocietyDetailTab, IconName> = {
  overview: 'dashboard',
  domain: 'building',
  features: 'categories',
  admin: 'user',
  payments: 'credit-card'
};

@Component({
  selector: 'app-society-detail',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, IconComponent, AvatarComponent, SecureImageComponent],
  templateUrl: './society-detail.component.html'
})
export class SocietyDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(SuperAdminApiService);
  private readonly toast = inject(NotificationService);
  protected readonly mediaUrl = inject(MediaUrlService);

  readonly societyId = Number(this.route.snapshot.paramMap.get('societyId'));

  readonly featureKeys = FEATURE_KEYS;

  readonly loading = signal(true);
  readonly savingDetails = signal(false);
  readonly savingFeatures = signal(false);
  readonly savingPayment = signal(false);
  readonly savingRenewal = signal(false);
  readonly detailsMessage = signal<string | null>(null);
  readonly featuresMessage = signal<string | null>(null);

  readonly society = signal<SocietyResponse | null>(null);
  readonly payments = signal<PaymentResponse[]>([]);
  readonly admins = signal<SocietyAdminResponse[]>([]);
  readonly domainRenewals = signal<DomainRenewalResponse[]>([]);
  readonly activeTab = signal<SocietyDetailTab>('overview');
  readonly showAddPaymentModal = signal(false);
  readonly showAddRenewalModal = signal(false);
  readonly logoFile = signal<File | null>(null);
  readonly logoPreviewUrl = signal<string | null>(null);
  readonly logoDragActive = signal(false);
  readonly logoError = signal<string | null>(null);
  readonly uploadingLogo = signal(false);

  readonly detailsForm = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    domain: ['', [Validators.required]],
    primaryColor: ['#0F766E'],
    secondaryColor: ['#F59E0B']
  });

  readonly featuresForm = this.fb.array(
    this.featureKeys.map(() =>
      this.fb.nonNullable.group(
        {
          enabled: [false],
          limit: this.fb.control<number | null>(null)
        },
        { validators: featureLimitValidator }
      )
    )
  );

  readonly paymentForm = this.fb.nonNullable.group({
    plan: ['', [Validators.required]],
    amount: this.fb.nonNullable.control<number>(0, [Validators.required, Validators.min(0)]),
    paymentDate: ['', [Validators.required]],
    nextDueDate: ['', [Validators.required]]
  });

  readonly renewalForm = this.fb.nonNullable.group({
    startDate: ['', [Validators.required]],
    expiryDate: ['', [Validators.required]],
    notes: ['']
  });

  private featureRowIds: (number | null)[] = [];

  constructor() {
    this.loadSociety();
    this.api.getFeatures(this.societyId).subscribe((features) => this.applyFeatures(features));
    this.api.listAdmins(this.societyId).subscribe((admins) => this.admins.set(admins));
    this.loadPayments();
    this.loadDomainRenewals();
  }

  setTab(tab: SocietyDetailTab): void {
    this.activeTab.set(tab);
  }

  tabIcon(tab: SocietyDetailTab): IconName {
    return TAB_ICONS[tab];
  }

  tabButtonClass(tab: SocietyDetailTab): string {
    const base = 'inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors';
    return this.activeTab() === tab
      ? `${base} border-primary text-primary`
      : `${base} border-transparent text-muted-foreground hover:text-foreground hover:border-border`;
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

  daysLabel(dateStr: string): string {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000);

    if (diffDays > 0) {
      return `${diffDays} day${diffDays === 1 ? '' : 's'} remaining`;
    }
    if (diffDays === 0) {
      return 'Expires today';
    }
    const overdue = Math.abs(diffDays);
    return `Expired ${overdue} day${overdue === 1 ? '' : 's'} ago`;
  }

  private loadSociety(): void {
    this.api.getSociety(this.societyId).subscribe((society) => {
      this.society.set(society);
      this.detailsForm.patchValue({
        name: society.name,
        domain: society.domain,
        primaryColor: society.primaryColor ?? '#0F766E',
        secondaryColor: society.secondaryColor ?? '#F59E0B'
      });
      this.loading.set(false);
    });
  }

  private applyFeatures(features: FeatureResponse[]): void {
    this.featureRowIds = this.featureKeys.map((key) => {
      const match = features.find((f) => f.featureKey === key);
      return match?.id ?? null;
    });

    this.featureKeys.forEach((key, index) => {
      const match = features.find((f) => f.featureKey === key);
      this.featuresForm.at(index).patchValue({
        enabled: match?.enabled ?? false,
        limit: match?.limit ?? null
      });
    });
  }

  loadPayments(): void {
    this.api.listPayments(this.societyId, 0, 10).subscribe((data) => this.payments.set(data.content));
  }

  loadDomainRenewals(): void {
    this.api.listDomainRenewals(this.societyId).subscribe((renewals) => this.domainRenewals.set(renewals));
  }

  saveDetails(): void {
    if (this.detailsForm.invalid) {
      this.detailsForm.markAllAsTouched();
      return;
    }

    this.savingDetails.set(true);
    this.detailsMessage.set(null);

    const value = this.detailsForm.getRawValue();
    this.api
      .updateSociety(this.societyId, {
        name: value.name,
        domain: value.domain,
        primaryColor: value.primaryColor || null,
        secondaryColor: value.secondaryColor || null
      })
      .subscribe({
        next: (society) => {
          this.society.set(society);
          this.savingDetails.set(false);
          this.detailsMessage.set('Society details updated.');
          this.toast.success('Society details updated.');
        },
        error: () => {
          this.savingDetails.set(false);
          this.toast.error('Could not update society details.');
        }
      });
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

  uploadLogo(): void {
    const file = this.logoFile();
    if (!file) {
      return;
    }

    this.uploadingLogo.set(true);
    this.api.uploadSocietyLogo(this.societyId, file).subscribe({
      next: (society) => {
        this.uploadingLogo.set(false);
        this.society.set(society);
        this.clearLogoSelection();
        this.toast.success('Logo updated successfully.');
      },
      error: () => {
        this.uploadingLogo.set(false);
        this.toast.error('Could not upload logo.');
      }
    });
  }

  saveFeatures(): void {
    if (this.featuresForm.invalid) {
      // TEMP DEBUG: remove once VPS "Set a valid limit" mismatch is diagnosed.
      console.log('featuresForm debug', this.featureKeys.map((key, i) => ({
        key,
        value: this.featuresForm.at(i).getRawValue(),
        status: this.featuresForm.at(i).status,
        errors: this.featuresForm.at(i).errors
      })));
      this.featuresForm.markAllAsTouched();
      this.toast.error('Set a valid limit (1 or more) for every enabled feature before saving.');
      return;
    }

    this.savingFeatures.set(true);
    this.featuresMessage.set(null);

    const request = this.featureKeys.map((key, index) => ({
      featureKey: key,
      enabled: this.featuresForm.at(index).getRawValue().enabled,
      limit: this.featuresForm.at(index).getRawValue().limit
    }));

    this.api.updateFeatures(this.societyId, request).subscribe({
      next: (features) => {
        this.savingFeatures.set(false);
        this.featuresMessage.set('Feature access updated.');
        this.toast.success('Feature access updated.');
        this.applyFeatures(features);
      },
      error: () => {
        this.savingFeatures.set(false);
        this.toast.error('Could not update feature access.');
      }
    });
  }

  openAddPaymentModal(): void {
    this.showAddPaymentModal.set(true);
  }

  closeAddPaymentModal(): void {
    if (this.savingPayment()) {
      return;
    }
    this.showAddPaymentModal.set(false);
    this.paymentForm.reset({ plan: '', amount: 0, paymentDate: '', nextDueDate: '' });
  }

  addPayment(): void {
    if (this.paymentForm.invalid) {
      this.paymentForm.markAllAsTouched();
      return;
    }

    this.savingPayment.set(true);

    const value = this.paymentForm.getRawValue();
    this.api
      .addPayment(this.societyId, {
        plan: value.plan,
        amount: value.amount,
        paymentDate: value.paymentDate || null,
        nextDueDate: value.nextDueDate || null
      })
      .subscribe({
        next: () => {
          this.savingPayment.set(false);
          this.toast.success('Payment recorded.');
          this.closeAddPaymentModal();
          this.loadPayments();
          this.loadSociety();
        },
        error: () => {
          this.savingPayment.set(false);
          this.toast.error('Could not record payment.');
        }
      });
  }

  openAddRenewalModal(): void {
    this.showAddRenewalModal.set(true);
  }

  closeAddRenewalModal(): void {
    if (this.savingRenewal()) {
      return;
    }
    this.showAddRenewalModal.set(false);
    this.renewalForm.reset({ startDate: '', expiryDate: '', notes: '' });
  }

  addRenewal(): void {
    if (this.renewalForm.invalid) {
      this.renewalForm.markAllAsTouched();
      return;
    }

    this.savingRenewal.set(true);

    const value = this.renewalForm.getRawValue();
    this.api
      .addDomainRenewal(this.societyId, {
        startDate: value.startDate,
        expiryDate: value.expiryDate,
        notes: value.notes || null
      })
      .subscribe({
        next: () => {
          this.savingRenewal.set(false);
          this.toast.success('Domain renewal recorded.');
          this.closeAddRenewalModal();
          this.loadDomainRenewals();
          this.loadSociety();
        },
        error: (err) => {
          this.savingRenewal.set(false);
          this.toast.error(err?.error?.message ?? 'Could not record domain renewal.');
        }
      });
  }
}
