/** Derives a predictable, easy-to-share password from a member's first name, e.g. "rohan sharma" -> "Rohan@123". */
export function generateMemberPassword(fullName: string): string {
  const firstName = fullName.trim().split(/\s+/)[0] || '';
  if (!firstName) {
    return '';
  }

  const capitalized = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
  return `${capitalized}@123`;
}
