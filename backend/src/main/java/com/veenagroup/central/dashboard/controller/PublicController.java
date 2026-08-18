package com.veenagroup.central.dashboard.controller;

import com.veenagroup.central.dashboard.dto.admin.*;
import com.veenagroup.central.dashboard.exception.BusinessException;
import com.veenagroup.central.dashboard.service.PublicContentService;
import com.veenagroup.central.dashboard.storage.FileAccessService;
import com.veenagroup.central.dashboard.web.ApiResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/public/{domain}")
public class PublicController {

    private final PublicContentService publicContentService;
    private final FileAccessService fileAccessService;

    public PublicController(PublicContentService publicContentService, FileAccessService fileAccessService) {
        this.publicContentService = publicContentService;
        this.fileAccessService = fileAccessService;
    }

    private Long societyId(String domain) {
        return publicContentService.resolveSociety(domain).getId();
    }

    @GetMapping("/notices")
    public ApiResponse<List<NoticeResponse>> notices(@PathVariable String domain) {
        return ApiResponse.of("Notices fetched successfully", publicContentService.listNotices(societyId(domain)));
    }

    @GetMapping("/notices/{noticeId}")
    public ApiResponse<NoticeResponse> notice(@PathVariable String domain, @PathVariable Long noticeId) {
        return ApiResponse.of("Notice fetched successfully", publicContentService.getNotice(societyId(domain), noticeId));
    }

    @GetMapping("/notices/{noticeId}/attachments/{attachmentId}/view")
    public ResponseEntity<Resource> viewNoticeAttachment(@PathVariable String domain, @PathVariable Long noticeId,
                                                           @PathVariable Long attachmentId) {
        NoticeResponse notice = publicContentService.getNotice(societyId(domain), noticeId);
        return serveAttachment(notice.attachments(), attachmentId, true, false);
    }

    @GetMapping("/notices/{noticeId}/attachments/{attachmentId}/download")
    public ResponseEntity<Resource> downloadNoticeAttachment(@PathVariable String domain, @PathVariable Long noticeId,
                                                               @PathVariable Long attachmentId) {
        NoticeResponse notice = publicContentService.getNotice(societyId(domain), noticeId);
        return serveAttachment(notice.attachments(), attachmentId, notice.downloadable(), true);
    }

    @GetMapping("/documents")
    public ApiResponse<List<DocumentResponse>> documents(@PathVariable String domain) {
        return ApiResponse.of("Documents fetched successfully", publicContentService.listDocuments(societyId(domain)));
    }

    @GetMapping("/documents/{documentId}")
    public ApiResponse<DocumentResponse> document(@PathVariable String domain, @PathVariable Long documentId) {
        return ApiResponse.of("Document fetched successfully", publicContentService.getDocument(societyId(domain), documentId));
    }

    @GetMapping("/documents/{documentId}/attachments/{attachmentId}/view")
    public ResponseEntity<Resource> viewDocumentAttachment(@PathVariable String domain, @PathVariable Long documentId,
                                                             @PathVariable Long attachmentId) {
        DocumentResponse document = publicContentService.getDocument(societyId(domain), documentId);
        return serveAttachment(document.attachments(), attachmentId, true, false);
    }

    @GetMapping("/documents/{documentId}/attachments/{attachmentId}/download")
    public ResponseEntity<Resource> downloadDocumentAttachment(@PathVariable String domain, @PathVariable Long documentId,
                                                                 @PathVariable Long attachmentId) {
        DocumentResponse document = publicContentService.getDocument(societyId(domain), documentId);
        return serveAttachment(document.attachments(), attachmentId, document.downloadable(), true);
    }

    @GetMapping("/forms")
    public ApiResponse<List<FormResponse>> forms(@PathVariable String domain) {
        return ApiResponse.of("Forms fetched successfully", publicContentService.listForms(societyId(domain)));
    }

    @GetMapping("/forms/{formId}")
    public ApiResponse<FormResponse> form(@PathVariable String domain, @PathVariable Long formId) {
        return ApiResponse.of("Form fetched successfully", publicContentService.getForm(societyId(domain), formId));
    }

    @GetMapping("/forms/{formId}/attachments/{attachmentId}/view")
    public ResponseEntity<Resource> viewFormAttachment(@PathVariable String domain, @PathVariable Long formId,
                                                         @PathVariable Long attachmentId) {
        FormResponse form = publicContentService.getForm(societyId(domain), formId);
        return serveAttachment(form.attachments(), attachmentId, true, false);
    }

    @GetMapping("/forms/{formId}/attachments/{attachmentId}/download")
    public ResponseEntity<Resource> downloadFormAttachment(@PathVariable String domain, @PathVariable Long formId,
                                                             @PathVariable Long attachmentId) {
        FormResponse form = publicContentService.getForm(societyId(domain), formId);
        return serveAttachment(form.attachments(), attachmentId, form.downloadable(), true);
    }

    @GetMapping("/committee")
    public ApiResponse<List<CommitteeResponse>> committee(@PathVariable String domain) {
        return ApiResponse.of("Committee fetched successfully", publicContentService.listCommittee(societyId(domain)));
    }

    @GetMapping("/meetings")
    public ApiResponse<List<MeetingResponse>> meetings(@PathVariable String domain) {
        return ApiResponse.of("Meetings fetched successfully", publicContentService.listMeetings(societyId(domain)));
    }

    @GetMapping("/meetings/{meetingId}")
    public ApiResponse<MeetingResponse> meeting(@PathVariable String domain, @PathVariable Long meetingId) {
        return ApiResponse.of("Meeting fetched successfully", publicContentService.getMeeting(societyId(domain), meetingId));
    }

    @GetMapping("/meetings/{meetingId}/attachments/{attachmentId}/view")
    public ResponseEntity<Resource> viewMeetingAttachment(@PathVariable String domain, @PathVariable Long meetingId,
                                                            @PathVariable Long attachmentId) {
        MeetingResponse meeting = publicContentService.getMeeting(societyId(domain), meetingId);
        return serveAttachment(meeting.attachments(), attachmentId, true, false);
    }

    @GetMapping("/meetings/{meetingId}/attachments/{attachmentId}/download")
    public ResponseEntity<Resource> downloadMeetingAttachment(@PathVariable String domain, @PathVariable Long meetingId,
                                                                @PathVariable Long attachmentId) {
        MeetingResponse meeting = publicContentService.getMeeting(societyId(domain), meetingId);
        return serveAttachment(meeting.attachments(), attachmentId, meeting.downloadable(), true);
    }

    @GetMapping("/gallery")
    public ApiResponse<List<GalleryResponse>> gallery(@PathVariable String domain) {
        return ApiResponse.of("Gallery fetched successfully", publicContentService.listGallery(societyId(domain)));
    }

    @GetMapping("/gallery/{galleryId}/view")
    public ResponseEntity<Resource> viewGalleryImage(@PathVariable String domain, @PathVariable Long galleryId) {
        GalleryResponse gallery = publicContentService.getGalleryItem(societyId(domain), galleryId);
        return fileAccessService.serve(gallery.attachmentPath(), "image", true, false);
    }

    @GetMapping("/gallery/{galleryId}/download")
    public ResponseEntity<Resource> downloadGalleryImage(@PathVariable String domain, @PathVariable Long galleryId) {
        GalleryResponse gallery = publicContentService.getGalleryItem(societyId(domain), galleryId);
        return fileAccessService.serve(gallery.attachmentPath(), "image", gallery.downloadable(), true);
    }

    private ResponseEntity<Resource> serveAttachment(List<AttachmentResponse> attachments, Long attachmentId,
                                                       boolean downloadable, boolean asAttachment) {
        AttachmentResponse attachment = attachments.stream()
                .filter(a -> a.id().equals(attachmentId))
                .findFirst()
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "ATTACHMENT_NOT_FOUND", "Attachment not found"));
        return fileAccessService.serve(attachment.filePath(), attachment.fileName(), downloadable, asAttachment);
    }
}
