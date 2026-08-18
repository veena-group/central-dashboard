/** Returns an error message if the file is not a PDF, or null if it's valid. */
export function validatePdfFile(file: File): string | null {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension !== 'pdf') {
    return 'Only PDF files are allowed.';
  }
  return null;
}
