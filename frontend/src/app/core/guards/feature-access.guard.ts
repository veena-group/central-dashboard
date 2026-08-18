import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { FeatureAccessService, FeatureKey } from '../services/feature-access.service';

/**
 * Loads the current society's enabled features once, before the admin/member shell (and its
 * sidebar) renders. Only SOCIETY_ADMIN and MEMBER are society-scoped — SUPER_ADMIN has no single
 * society's feature set to load.
 */
export const loadFeaturesGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const featureAccess = inject(FeatureAccessService);

  const role = authService.currentUser()?.role;
  if (role !== 'SOCIETY_ADMIN' && role !== 'MEMBER') {
    return of(true);
  }

  return featureAccess.load().pipe(map(() => true));
};

/**
 * Blocks direct navigation to a feature's route when that feature is disabled for the society,
 * even if the corresponding sidebar link is hidden.
 */
export function featureEnabledGuard(key: FeatureKey): CanActivateFn {
  return () => {
    const authService = inject(AuthService);
    const featureAccess = inject(FeatureAccessService);
    const router = inject(Router);

    if (featureAccess.isEnabled(key)) {
      return true;
    }

    const home = authService.currentUser()?.role === 'MEMBER' ? '/member/dashboard' : '/admin/dashboard';
    return router.createUrlTree([home]);
  };
}
