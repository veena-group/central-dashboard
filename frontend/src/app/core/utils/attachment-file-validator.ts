const ALLOWED_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'docx', 'xlsx']);

/**
 * Legacy binary Word/Excel formats aren't reliably parsed by the client-side preview libraries
 * (mammoth.js only supports .docx, SheetJS's .xls support is inconsistent) - rejected at upload
 * with a specific message rather than uploading successfully and then failing to preview.
 */
const LEGACY_OFFICE_EXTENSIONS = new Set(['doc', 'xls', 'ppt']);

/** Returns an error message if the file type isn't supported for attachments, or null if it's valid. */
export function validateAttachmentFile(file: File): string | null {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension && LEGACY_OFFICE_EXTENSIONS.has(extension)) {
    return 'Legacy .doc/.xls/.ppt files are not supported. Please save as .docx/.xlsx or upload a PDF instead.';
  }
  if (!extension || !ALLOWED_EXTENSIONS.has(extension)) {
    return 'Only PDF, Word (.docx), Excel (.xlsx), and image files are allowed.';
  }
  return null;
}
