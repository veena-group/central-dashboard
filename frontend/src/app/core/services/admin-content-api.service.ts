import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, PageResponse } from '../models/api-response.model';

export interface CreateMemberRequest {
  name: string;
  flat: string | null;
  wing: string | null;
  email: string;
  phone: string | null;
  role: 'MEMBER' | 'SOCIETY_ADMIN';
  password: string;
}

export interface UpdateMemberRequest {
  name: string;
  flat: string | null;
  wing: string | null;
  phone: string | null;
  role: 'MEMBER' | 'SOCIETY_ADMIN';
}

export interface BulkMemberRowResult {
  rowNumber: number;
  name: string;
  email: string;
  success: boolean;
  message: string;
  memberId: number | null;
}

export interface BulkCreateMembersResponse {
  totalRows: number;
  successCount: number;
  failureCount: number;
  results: BulkMemberRowResult[];
}

export interface CreateNoticeRequest {
  title: string;
  body: string | null;
  categoryId: number;
  publishOn: string;
  expireOn: string;
  isPublic: boolean;
  downloadable: boolean;
}

export interface CreateDocumentRequest {
  title: string;
  categoryId: number;
  year: number | null;
  description: string | null;
  isPublic: boolean;
  downloadable: boolean;
}

export interface CreateFormRequest {
  title: string;
  categoryId: number;
  year: number | null;
  description: string | null;
  isPublic: boolean;
  downloadable: boolean;
}

export interface CreateCommitteeRequest {
  name: string;
  designation: string | null;
  flat: string | null;
  phone: string | null;
  email: string | null;
  servingSince: string | null;
}

export interface CreateMeetingRequest {
  title: string;
  categoryId: number;
  agenda: string | null;
  meetingDate: string;
  platform: 'ZOOM' | 'GOOGLE_MEET' | 'MICROSOFT_TEAMS' | 'IN_PERSON';
  meetingUrl: string | null;
  status: 'UPCOMING' | 'COMPLETED' | 'CANCELLED';
  recordingUrl: string | null;
  isPublic: boolean;
  downloadable: boolean;
}

export interface CreateGalleryRequest {
  albumId: number;
  title: string | null;
  description: string | null;
  isPublic: boolean;
  downloadable: boolean;
  file: File;
}

export interface UpdateGalleryRequest {
  albumId: number;
  title: string | null;
  description: string | null;
  isPublic: boolean;
  downloadable: boolean;
}

export interface CreateEventRequest {
  title: string;
  categoryId: number;
  description: string | null;
  eventDate: string;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  venue: string | null;
  status: 'UPCOMING' | 'COMPLETED' | 'CANCELLED';
  isPublic: boolean;
  downloadable: boolean;
}

export interface CategoryOption {
  id: number;
  type: string;
  name: string;
  active: boolean;
}

export type CategoryType = 'NOTICE' | 'DOCUMENT' | 'FORM' | 'MEETING' | 'GALLERY_ALBUM' | 'EVENT';

export interface AttachmentResponse {
  id: number;
  fileName: string;
  filePath: string;
}

interface CreatedEntityResponse {
  id: number;
}

@Injectable({ providedIn: 'root' })
export class AdminContentApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/admin`;

  createMember(request: CreateMemberRequest): Observable<number> {
    return this.http
      .post<ApiResponse<CreatedEntityResponse>>(`${this.base}/members`, request)
      .pipe(map((response) => response.data.id));
  }

  updateMember(memberId: number, request: UpdateMemberRequest): Observable<void> {
    return this.http
      .put<ApiResponse<unknown>>(`${this.base}/members/${memberId}`, request)
      .pipe(map(() => undefined));
  }

  bulkCreateMembers(members: CreateMemberRequest[]): Observable<BulkCreateMembersResponse> {
    return this.http
      .post<ApiResponse<BulkCreateMembersResponse>>(`${this.base}/members/bulk`, { members })
      .pipe(map((response) => response.data));
  }

  checkExistingEmails(emails: string[]): Observable<string[]> {
    return this.http
      .post<ApiResponse<{ existingEmails: string[] }>>(`${this.base}/members/check-emails`, { emails })
      .pipe(map((response) => response.data.existingEmails));
  }

  deleteMember(memberId: number): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(`${this.base}/members/${memberId}`)
      .pipe(map(() => undefined));
  }

  createNotice(request: CreateNoticeRequest): Observable<number> {
    return this.http
      .post<ApiResponse<CreatedEntityResponse>>(`${this.base}/notices`, request)
      .pipe(map((response) => response.data.id));
  }

  updateNotice(noticeId: number, request: CreateNoticeRequest): Observable<void> {
    return this.http
      .put<ApiResponse<unknown>>(`${this.base}/notices/${noticeId}`, request)
      .pipe(map(() => undefined));
  }

  deleteNotice(noticeId: number): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(`${this.base}/notices/${noticeId}`)
      .pipe(map(() => undefined));
  }

  createDocument(request: CreateDocumentRequest): Observable<number> {
    return this.http
      .post<ApiResponse<CreatedEntityResponse>>(`${this.base}/documents`, request)
      .pipe(map((response) => response.data.id));
  }

  updateDocument(documentId: number, request: CreateDocumentRequest): Observable<void> {
    return this.http
      .put<ApiResponse<unknown>>(`${this.base}/documents/${documentId}`, request)
      .pipe(map(() => undefined));
  }

  deleteDocument(documentId: number): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(`${this.base}/documents/${documentId}`)
      .pipe(map(() => undefined));
  }

  createForm(request: CreateFormRequest): Observable<number> {
    return this.http
      .post<ApiResponse<CreatedEntityResponse>>(`${this.base}/forms`, request)
      .pipe(map((response) => response.data.id));
  }

  updateFormEntry(formId: number, request: CreateFormRequest): Observable<void> {
    return this.http
      .put<ApiResponse<unknown>>(`${this.base}/forms/${formId}`, request)
      .pipe(map(() => undefined));
  }

  deleteFormEntry(formId: number): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(`${this.base}/forms/${formId}`)
      .pipe(map(() => undefined));
  }

  createCommitteeMember(request: CreateCommitteeRequest): Observable<number> {
    return this.http
      .post<ApiResponse<CreatedEntityResponse>>(`${this.base}/committee`, request)
      .pipe(map((response) => response.data.id));
  }

  updateCommitteeMember(committeeId: number, request: CreateCommitteeRequest): Observable<void> {
    return this.http
      .put<ApiResponse<unknown>>(`${this.base}/committee/${committeeId}`, request)
      .pipe(map(() => undefined));
  }

  deleteCommitteeMember(committeeId: number): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(`${this.base}/committee/${committeeId}`)
      .pipe(map(() => undefined));
  }

  createMeeting(request: CreateMeetingRequest): Observable<number> {
    return this.http
      .post<ApiResponse<CreatedEntityResponse>>(`${this.base}/meetings`, request)
      .pipe(map((response) => response.data.id));
  }

  updateMeeting(meetingId: number, request: CreateMeetingRequest): Observable<void> {
    return this.http
      .put<ApiResponse<unknown>>(`${this.base}/meetings/${meetingId}`, request)
      .pipe(map(() => undefined));
  }

  deleteMeeting(meetingId: number): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(`${this.base}/meetings/${meetingId}`)
      .pipe(map(() => undefined));
  }

  createEvent(request: CreateEventRequest): Observable<number> {
    return this.http
      .post<ApiResponse<CreatedEntityResponse>>(`${this.base}/events`, request)
      .pipe(map((response) => response.data.id));
  }

  updateEvent(eventId: number, request: CreateEventRequest): Observable<void> {
    return this.http
      .put<ApiResponse<unknown>>(`${this.base}/events/${eventId}`, request)
      .pipe(map(() => undefined));
  }

  deleteEvent(eventId: number): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(`${this.base}/events/${eventId}`)
      .pipe(map(() => undefined));
  }

  uploadEventBanner(eventId: number, file: File): Observable<void> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http
      .post<ApiResponse<unknown>>(`${this.base}/events/${eventId}/banner`, formData)
      .pipe(map(() => undefined));
  }

  uploadEventAttachment(eventId: number, file: File): Observable<void> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http
      .post<ApiResponse<unknown>>(`${this.base}/events/${eventId}/attachments`, formData)
      .pipe(map(() => undefined));
  }

  removeEventAttachment(eventId: number, attachmentId: number): Observable<void> {
    return this.http
      .delete<ApiResponse<unknown>>(`${this.base}/events/${eventId}/attachments/${attachmentId}`)
      .pipe(map(() => undefined));
  }

  createGalleryItem(request: CreateGalleryRequest): Observable<void> {
    const formData = new FormData();
    formData.append('albumId', String(request.albumId));
    formData.append('title', request.title ?? '');
    formData.append('description', request.description ?? '');
    formData.append('isPublic', String(request.isPublic));
    formData.append('downloadable', String(request.downloadable));
    formData.append('file', request.file);

    return this.http
      .post<ApiResponse<unknown>>(`${this.base}/gallery`, formData)
      .pipe(map(() => undefined));
  }

  updateGalleryItem(galleryId: number, request: UpdateGalleryRequest): Observable<void> {
    return this.http
      .put<ApiResponse<unknown>>(`${this.base}/gallery/${galleryId}`, request)
      .pipe(map(() => undefined));
  }

  replaceGalleryImage(galleryId: number, file: File): Observable<void> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http
      .put<ApiResponse<unknown>>(`${this.base}/gallery/${galleryId}/image`, formData)
      .pipe(map(() => undefined));
  }

  deleteGalleryItem(galleryId: number): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(`${this.base}/gallery/${galleryId}`)
      .pipe(map(() => undefined));
  }

  uploadMemberPhoto(memberId: number, file: File): Observable<void> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http
      .post<ApiResponse<unknown>>(`${this.base}/members/${memberId}/photo`, formData)
      .pipe(map(() => undefined));
  }

  uploadCommitteePhoto(committeeId: number, file: File): Observable<void> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http
      .post<ApiResponse<unknown>>(`${this.base}/committee/${committeeId}/photo`, formData)
      .pipe(map(() => undefined));
  }

  uploadNoticeAttachment(noticeId: number, file: File): Observable<void> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http
      .post<ApiResponse<unknown>>(`${this.base}/notices/${noticeId}/attachments`, formData)
      .pipe(map(() => undefined));
  }

  removeNoticeAttachment(noticeId: number, attachmentId: number): Observable<void> {
    return this.http
      .delete<ApiResponse<unknown>>(`${this.base}/notices/${noticeId}/attachments/${attachmentId}`)
      .pipe(map(() => undefined));
  }

  uploadDocumentAttachment(documentId: number, file: File): Observable<void> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http
      .post<ApiResponse<unknown>>(`${this.base}/documents/${documentId}/attachments`, formData)
      .pipe(map(() => undefined));
  }

  removeDocumentAttachment(documentId: number, attachmentId: number): Observable<void> {
    return this.http
      .delete<ApiResponse<unknown>>(`${this.base}/documents/${documentId}/attachments/${attachmentId}`)
      .pipe(map(() => undefined));
  }

  uploadFormAttachment(formId: number, file: File): Observable<void> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http
      .post<ApiResponse<unknown>>(`${this.base}/forms/${formId}/attachments`, formData)
      .pipe(map(() => undefined));
  }

  removeFormAttachment(formId: number, attachmentId: number): Observable<void> {
    return this.http
      .delete<ApiResponse<unknown>>(`${this.base}/forms/${formId}/attachments/${attachmentId}`)
      .pipe(map(() => undefined));
  }

  fetchStoredFile(filePath: string): Observable<Blob> {
    return this.http.get(`${environment.apiBaseUrl}/files/view`, {
      params: { path: filePath },
      responseType: 'blob'
    });
  }

  uploadMeetingAttachment(meetingId: number, file: File): Observable<void> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http
      .post<ApiResponse<unknown>>(`${this.base}/meetings/${meetingId}/attachments`, formData)
      .pipe(map(() => undefined));
  }

  removeMeetingAttachment(meetingId: number, attachmentId: number): Observable<void> {
    return this.http
      .delete<ApiResponse<unknown>>(`${this.base}/meetings/${meetingId}/attachments/${attachmentId}`)
      .pipe(map(() => undefined));
  }

  listActiveCategories(type: CategoryType): Observable<CategoryOption[]> {
    return this.http
      .get<ApiResponse<PageResponse<CategoryOption>>>(`${this.base}/categories`, {
        params: {
          type,
          activeOnly: true,
          page: 0,
          size: 200
        }
      })
      .pipe(map((response) => response.data.content));
  }

  listCategories(type: CategoryType, activeOnly: boolean, page: number, size: number): Observable<PageResponse<CategoryOption>> {
    return this.http
      .get<ApiResponse<PageResponse<CategoryOption>>>(`${this.base}/categories`, {
        params: {
          type,
          activeOnly,
          page,
          size
        }
      })
      .pipe(map((response) => response.data));
  }

  createCategory(type: CategoryType, name: string): Observable<CategoryOption> {
    return this.http
      .post<ApiResponse<CategoryOption>>(`${this.base}/categories`, { type, name })
      .pipe(map((response) => response.data));
  }

  setCategoryActive(categoryId: number, active: boolean): Observable<void> {
    return this.http
      .put<ApiResponse<void>>(`${this.base}/categories/${categoryId}/active`, null, { params: { active } })
      .pipe(map(() => undefined));
  }
}