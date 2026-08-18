import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Backend rule: a feature with enabled=true must have limit >= 1 (it's a hard usage
 * cap, not "null = unlimited"). Applied to a FormGroup with `enabled`/`limit` controls.
 */
export const featureLimitValidator: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const enabled = group.get('enabled')?.value;
  const limit = group.get('limit')?.value;

  if (enabled && (limit === null || limit === undefined || limit < 1)) {
    return { limitRequired: true };
  }

  return null;
};
