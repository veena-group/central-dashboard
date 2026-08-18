import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// Indian mobile numbers: 10 digits, first digit must be 6-9 per the TRAI numbering plan.
const PHONE_DIGITS_PATTERN = /^[6-9]\d{9}$/;

function normalizePhoneDigits(value: string): string {
  return value.replace(/[\s-]/g, '');
}

/** A blank phone is valid - phone is an optional field everywhere it's used. */
export function isValidPhoneNumber(phone: string): boolean {
  const trimmed = phone.trim();
  if (!trimmed) {
    return true;
  }
  return PHONE_DIGITS_PATTERN.test(normalizePhoneDigits(trimmed));
}

export function phoneNumberValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = (control.value ?? '').toString();
    return isValidPhoneNumber(value) ? null : { invalidPhone: true };
  };
}
