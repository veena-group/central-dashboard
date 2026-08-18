package com.veenagroup.central.dashboard.controller;

import com.veenagroup.central.dashboard.dto.admin.*;
import com.veenagroup.central.dashboard.entity.enums.CategoryType;
import com.veenagroup.central.dashboard.entity.enums.EventStatus;
import com.veenagroup.central.dashboard.entity.enums.MeetingPlatform;
import com.veenagroup.central.dashboard.entity.enums.MeetingStatus;
import com.veenagroup.central.dashboard.exception.BusinessException;
import com.veenagroup.central.dashboard.security.CurrentUser;
import com.veenagroup.central.dashboard.service.*;
import com.veenagroup.central.dashboard.storage.FileAccessService;
import com.veenagroup.central.dashboard.web.ApiResponse;
import com.veenagroup.central.dashboard.web.PageResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/member")
public class MemberDashboardController {

    private final MemberService memberService;
    private final NoticeService noticeService;
    private final DocumentService documentService;
    private final FormService formService;
    private final CommitteeService committeeService;
    private final MeetingService meetingService;
    private final GalleryService galleryService;
    private final EventService eventService;
    private final CategoryService categoryService;
    private final CurrentUser currentUser;
    private final FileAccessService fileAccessService;
    private final FeatureUsageService featureUsageService;

    public MemberDashboardController(MemberService memberService, NoticeService noticeService,
                                      DocumentService documentService, FormService formService,
                                      CommitteeService committeeService, MeetingService meetingService,
                                      GalleryService galleryService, EventService eventService,
                                      CategoryService categoryService,
                                      CurrentUser currentUser, FileAccessService fileAccessService,
                                      FeatureUsageService featureUsageService) {
        this.memberService = memberService;
        this.noticeService = noticeService;
        this.documentService = documentService;
        this.formService = formService;
        this.committeeService = committeeService;
        this.meetingService = meetingService;
        this.galleryService = galleryService;
        this.eventService = eventService;
        this.categoryService = categoryService;
        this.currentUser = currentUser;
        this.fileAccessService = fileAccessService;
        this.featureUsageService = featureUsageService;
    }

    @GetMapping("/features")
    public ApiResponse<List<FeatureUsageResponse>> features() {
        return ApiResponse.of("Feature usage fetched successfully", featureUsageService.getUsage(currentUser.requireSocietyId()));
    }

    @GetMapping("/categories")
    public ApiResponse<List<CategoryResponse>> categories(@RequestParam CategoryType type) {
        Pageable pageable = PageRequest.of(0, 200, Sort.by("id"));
        return ApiResponse.of("Categories fetched successfully",
                categoryService.list(currentUser.requireSocietyId(), type, true, pageable).content());
    }

    @GetMapping("/profile")
    public ApiResponse<MemberResponse> profile() {
        return ApiResponse.of("Profile fetched successfully", memberService.getById(currentUser.requireSocietyId(), currentUser.userId()));
    }

    @GetMapping("/notices")
    public ApiResponse<List<NoticeResponse>> notices() {
        return ApiResponse.of("Notices fetched successfully", noticeService.list(currentUser.requireSocietyId()));
    }

    @GetMapping(value = "/notices", params = {"page", "size"})
    public ApiResponse<PageResponse<NoticeResponse>> notices(@RequestParam int page, @RequestParam int size,
                                                               @RequestParam(required = false) String search,
                                                               @RequestParam(required = false) Long categoryId,
                                                               @RequestParam(required = false) Boolean isPublic) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("id"));
        return ApiResponse.of("Notices fetched successfully",
                noticeService.list(currentUser.requireSocietyId(), pageable, search, categoryId, isPublic));
    }

    @GetMapping("/notices/{noticeId}")
    public ApiResponse<NoticeResponse> notice(@PathVariable Long noticeId) {
        return ApiResponse.of("Notice fetched successfully", noticeService.getById(currentUser.requireSocietyId(), noticeId));
    }

    @GetMapping("/notices/{noticeId}/attachments/{attachmentId}/view")
    public ResponseEntity<Resource> viewNoticeAttachment(@PathVariable Long noticeId, @PathVariable Long attachmentId) {
        return serveAttachment(noticeService.getById(currentUser.requireSocietyId(), noticeId).attachments(),
                attachmentId, true, false);
    }

    @GetMapping("/notices/{noticeId}/attachments/{attachmentId}/download")
    public ResponseEntity<Resource> downloadNoticeAttachment(@PathVariable Long noticeId, @PathVariable Long attachmentId) {
        NoticeResponse notice = noticeService.getById(currentUser.requireSocietyId(), noticeId);
        return serveAttachment(notice.attachments(), attachmentId, notice.downloadable(), true);
    }

    @GetMapping("/documents")
    public ApiResponse<List<DocumentResponse>> documents() {
        return ApiResponse.of("Documents fetched successfully", documentService.list(currentUser.requireSocietyId()));
    }

    @GetMapping(value = "/documents", params = {"page", "size"})
    public ApiResponse<PageResponse<DocumentResponse>> documents(@RequestParam int page, @RequestParam int size,
                                                                    @RequestParam(required = false) String search,
                                                                    @RequestParam(required = false) Long categoryId,
                                                                    @RequestParam(required = false) Integer year,
                                                                    @RequestParam(required = false) Boolean isPublic) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("id"));
        return ApiResponse.of("Documents fetched successfully",
                documentService.list(currentUser.requireSocietyId(), pageable, search, categoryId, year, isPublic));
    }

    @GetMapping("/documents/{documentId}")
    public ApiResponse<DocumentResponse> document(@PathVariable Long documentId) {
        return ApiResponse.of("Document fetched successfully", documentService.getById(currentUser.requireSocietyId(), documentId));
    }

    @GetMapping("/documents/{documentId}/attachments/{attachmentId}/view")
    public ResponseEntity<Resource> viewDocumentAttachment(@PathVariable Long documentId, @PathVariable Long attachmentId) {
        return serveAttachment(documentService.getById(currentUser.requireSocietyId(), documentId).attachments(),
                attachmentId, true, false);
    }

    @GetMapping("/documents/{documentId}/attachments/{attachmentId}/download")
    public ResponseEntity<Resource> downloadDocumentAttachment(@PathVariable Long documentId, @PathVariable Long attachmentId) {
        DocumentResponse document = documentService.getById(currentUser.requireSocietyId(), documentId);
        return serveAttachment(document.attachments(), attachmentId, document.downloadable(), true);
    }

    @GetMapping("/forms")
    public ApiResponse<List<FormResponse>> forms() {
        return ApiResponse.of("Forms fetched successfully", formService.list(currentUser.requireSocietyId()));
    }

    @GetMapping(value = "/forms", params = {"page", "size"})
    public ApiResponse<PageResponse<FormResponse>> forms(@RequestParam int page, @RequestParam int size,
                                                            @RequestParam(required = false) String search,
                                                            @RequestParam(required = false) Long categoryId,
                                                            @RequestParam(required = false) Integer year,
                                                            @RequestParam(required = false) Boolean isPublic) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("id"));
        return ApiResponse.of("Forms fetched successfully",
                formService.list(currentUser.requireSocietyId(), pageable, search, categoryId, year, isPublic));
    }

    @GetMapping("/forms/{formId}")
    public ApiResponse<FormResponse> form(@PathVariable Long formId) {
        return ApiResponse.of("Form fetched successfully", formService.getById(currentUser.requireSocietyId(), formId));
    }

    @GetMapping("/forms/{formId}/attachments/{attachmentId}/view")
    public ResponseEntity<Resource> viewFormAttachment(@PathVariable Long formId, @PathVariable Long attachmentId) {
        return serveAttachment(formService.getById(currentUser.requireSocietyId(), formId).attachments(),
                attachmentId, true, false);
    }

    @GetMapping("/forms/{formId}/attachments/{attachmentId}/download")
    public ResponseEntity<Resource> downloadFormAttachment(@PathVariable Long formId, @PathVariable Long attachmentId) {
        FormResponse form = formService.getById(currentUser.requireSocietyId(), formId);
        return serveAttachment(form.attachments(), attachmentId, form.downloadable(), true);
    }

    @GetMapping("/committee")
    public ApiResponse<List<CommitteeResponse>> committee() {
        return ApiResponse.of("Committee fetched successfully", committeeService.list(currentUser.requireSocietyId()));
    }

    @GetMapping(value = "/committee", params = {"page", "size"})
    public ApiResponse<PageResponse<CommitteeResponse>> committee(@RequestParam int page, @RequestParam int size,
                                                                    @RequestParam(required = false) String search) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("id"));
        return ApiResponse.of("Committee fetched successfully",
                committeeService.list(currentUser.requireSocietyId(), pageable, search));
    }

    @GetMapping("/meetings")
    public ApiResponse<List<MeetingResponse>> meetings() {
        return ApiResponse.of("Meetings fetched successfully", meetingService.list(currentUser.requireSocietyId()));
    }

    @GetMapping(value = "/meetings", params = {"page", "size"})
    public ApiResponse<PageResponse<MeetingResponse>> meetings(@RequestParam int page, @RequestParam int size,
                                                                 @RequestParam(required = false) String search,
                                                                 @RequestParam(required = false) Long categoryId,
                                                                 @RequestParam(required = false) MeetingStatus status,
                                                                 @RequestParam(required = false) MeetingPlatform platform) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("id"));
        return ApiResponse.of("Meetings fetched successfully",
                meetingService.list(currentUser.requireSocietyId(), pageable, search, categoryId, status, platform));
    }

    @GetMapping("/meetings/{meetingId}")
    public ApiResponse<MeetingResponse> meeting(@PathVariable Long meetingId) {
        return ApiResponse.of("Meeting fetched successfully", meetingService.getById(currentUser.requireSocietyId(), meetingId));
    }

    @GetMapping("/meetings/{meetingId}/attachments/{attachmentId}/view")
    public ResponseEntity<Resource> viewMeetingAttachment(@PathVariable Long meetingId, @PathVariable Long attachmentId) {
        return serveAttachment(meetingService.getById(currentUser.requireSocietyId(), meetingId).attachments(),
                attachmentId, true, false);
    }

    @GetMapping("/meetings/{meetingId}/attachments/{attachmentId}/download")
    public ResponseEntity<Resource> downloadMeetingAttachment(@PathVariable Long meetingId, @PathVariable Long attachmentId) {
        MeetingResponse meeting = meetingService.getById(currentUser.requireSocietyId(), meetingId);
        return serveAttachment(meeting.attachments(), attachmentId, meeting.downloadable(), true);
    }

    @GetMapping("/events")
    public ApiResponse<List<EventResponse>> events() {
        return ApiResponse.of("Events fetched successfully", eventService.list(currentUser.requireSocietyId()));
    }

    @GetMapping(value = "/events", params = {"page", "size"})
    public ApiResponse<PageResponse<EventResponse>> events(@RequestParam int page, @RequestParam int size,
                                                             @RequestParam(required = false) String search,
                                                             @RequestParam(required = false) Long categoryId,
                                                             @RequestParam(required = false) EventStatus status) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("id"));
        return ApiResponse.of("Events fetched successfully",
                eventService.list(currentUser.requireSocietyId(), pageable, search, categoryId, status));
    }

    @GetMapping("/events/{eventId}")
    public ApiResponse<EventResponse> event(@PathVariable Long eventId) {
        return ApiResponse.of("Event fetched successfully", eventService.getById(currentUser.requireSocietyId(), eventId));
    }

    @GetMapping("/events/{eventId}/attachments/{attachmentId}/view")
    public ResponseEntity<Resource> viewEventAttachment(@PathVariable Long eventId, @PathVariable Long attachmentId) {
        return serveAttachment(eventService.getById(currentUser.requireSocietyId(), eventId).attachments(),
                attachmentId, true, false);
    }

    @GetMapping("/events/{eventId}/attachments/{attachmentId}/download")
    public ResponseEntity<Resource> downloadEventAttachment(@PathVariable Long eventId, @PathVariable Long attachmentId) {
        EventResponse event = eventService.getById(currentUser.requireSocietyId(), eventId);
        return serveAttachment(event.attachments(), attachmentId, event.downloadable(), true);
    }

    @GetMapping("/gallery")
    public ApiResponse<List<GalleryResponse>> gallery() {
        return ApiResponse.of("Gallery fetched successfully", galleryService.list(currentUser.requireSocietyId()));
    }

    @GetMapping(value = "/gallery", params = {"page", "size"})
    public ApiResponse<PageResponse<GalleryResponse>> gallery(@RequestParam int page, @RequestParam int size,
                                                                @RequestParam(required = false) Long albumId) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("id"));
        return ApiResponse.of("Gallery fetched successfully",
                galleryService.list(currentUser.requireSocietyId(), pageable, albumId));
    }

    @GetMapping("/gallery/{galleryId}/view")
    public ResponseEntity<Resource> viewGalleryImage(@PathVariable Long galleryId) {
        GalleryResponse gallery = galleryService.getById(currentUser.requireSocietyId(), galleryId);
        return fileAccessService.serve(gallery.attachmentPath(), "image", true, false);
    }

    @GetMapping("/gallery/{galleryId}/download")
    public ResponseEntity<Resource> downloadGalleryImage(@PathVariable Long galleryId) {
        GalleryResponse gallery = galleryService.getById(currentUser.requireSocietyId(), galleryId);
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
