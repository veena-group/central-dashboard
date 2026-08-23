import { HttpEvent, HttpEventType, HttpResponse } from '@angular/common/http';
import { Observable, filter, map, tap } from 'rxjs';

/**
 * Wraps a batch of progress-emitting upload calls (e.g. for a parallel forkJoin) so they share one
 * aggregate percentage instead of each reporting independently. Tracks each file's own loaded bytes
 * against the batch's total bytes and calls onProgress as any file reports progress; only the final
 * HTTP response reaches the returned observables, progress events are absorbed internally.
 */
export function uploadFilesWithAggregateProgress<T>(
  files: File[],
  uploadFn: (file: File) => Observable<HttpEvent<T>>,
  onProgress: (percent: number | null) => void
): Observable<T>[] {
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  const loadedByIndex = new Array(files.length).fill(0);

  return files.map((file, index) =>
    uploadFn(file).pipe(
      tap((event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          loadedByIndex[index] = event.loaded;
          const loaded = loadedByIndex.reduce((sum, n) => sum + n, 0);
          onProgress(totalBytes ? Math.round((100 * loaded) / totalBytes) : null);
        }
      }),
      filter((event): event is HttpResponse<T> => event.type === HttpEventType.Response),
      map((event) => event.body as T)
    )
  );
}
