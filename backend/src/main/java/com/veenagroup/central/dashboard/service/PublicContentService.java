package com.veenagroup.central.dashboard.service;

import com.veenagroup.central.dashboard.dto.admin.AttachmentResponse;
import com.veenagroup.central.dashboard.dto.admin.CommitteeResponse;
import com.veenagroup.central.dashboard.dto.admin.DocumentResponse;
import com.veenagroup.central.dashboard.dto.admin.FormResponse;
import com.veenagroup.central.dashboard.dto.admin.GalleryResponse;
import com.veenagroup.central.dashboard.dto.admin.MeetingResponse;
import com.veenagroup.central.dashboard.dto.admin.NoticeResponse;
import com.veenagroup.central.dashboard.entity.Committee;
import com.veenagroup.central.dashboard.entity.Document;
import com.veenagroup.central.dashboard.entity.Form;
import com.veenagroup.central.dashboard.entity.Gallery;
import com.veenagroup.central.dashboard.entity.Meeting;
import com.veenagroup.central.dashboard.entity.Notice;
import com.veenagroup.central.dashboard.entity.Society;
import com.veenagroup.central.dashboard.entity.enums.FeatureKey;
import com.veenagroup.central.dashboard.exception.BusinessException;
import com.veenagroup.central.dashboard.repository.CommitteeRepository;
import com.veenagroup.central.dashboard.repository.DocumentRepository;
import com.veenagroup.central.dashboard.repository.FormRepository;
import com.veenagroup.central.dashboard.repository.GalleryRepository;
import com.veenagroup.central.dashboard.repository.MeetingRepository;
import com.veenagroup.central.dashboard.repository.NoticeRepository;
import com.veenagroup.central.dashboard.repository.SocietyRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Slf4j
@Service
@Transactional(readOnly = true)
public class PublicContentService {

    private final SocietyRepository societyRepository;
    private final FeatureLimitService featureLimitService;
    private final NoticeRepository noticeRepository;
    private final DocumentRepository documentRepository;
    private final FormRepository formRepository;
    private final CommitteeRepository committeeRepository;
    private final MeetingRepository meetingRepository;
    private final GalleryRepository galleryRepository;

    public PublicContentService(SocietyRepository societyRepository,
                                 FeatureLimitService featureLimitService,
                                 NoticeRepository noticeRepository,
                                 DocumentRepository documentRepository,
                                 FormRepository formRepository,
                                 CommitteeRepository committeeRepository,
                                 MeetingRepository meetingRepository,
                                 GalleryRepository galleryRepository) {
        this.societyRepository = societyRepository;
        this.featureLimitService = featureLimitService;
        this.noticeRepository = noticeRepository;
        this.documentRepository = documentRepository;
        this.formRepository = formRepository;
        this.committeeRepository = committeeRepository;
        this.meetingRepository = meetingRepository;
        this.galleryRepository = galleryRepository;
    }

    /**
     * Called on essentially every public-site request to resolve the tenant from its custom domain -
     * cached since a society's domain changes extremely rarely (evicted in SocietyService.update).
     */
    @Cacheable(cacheNames = "societyByDomain", key = "#domain")
    public Society resolveSociety(String domain) {
        return societyRepository.findByDomain(domain)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "SOCIETY_NOT_FOUND", "Society not found"));
    }

    private boolean isEnabled(Long societyId, FeatureKey key) {
        return featureLimitService.isEnabledCached(societyId, key);
    }

    public List<NoticeResponse> listNotices(Long societyId) {
        if (!isEnabled(societyId, FeatureKey.NOTICES)) {
            return List.of();
        }
        LocalDate today = LocalDate.now();
        return noticeRepository
                .findBySocietyIdAndIsPublicTrueAndPublishOnLessThanEqualAndExpireOnGreaterThanEqual(societyId, today, today)
                .stream().map(this::toResponse).toList();
    }

    public NoticeResponse getNotice(Long societyId, Long noticeId) {
        if (!isEnabled(societyId, FeatureKey.NOTICES)) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "NOTICE_NOT_FOUND", "Notice not found");
        }
        Notice notice = noticeRepository.findById(noticeId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "NOTICE_NOT_FOUND", "Notice not found"));
        LocalDate today = LocalDate.now();
        if (!notice.getSociety().getId().equals(societyId) || !notice.isPublic()
                || notice.getPublishOn().isAfter(today) || notice.getExpireOn().isBefore(today)) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "NOTICE_NOT_FOUND", "Notice not found");
        }
        return toResponse(notice);
    }

    public List<DocumentResponse> listDocuments(Long societyId) {
        if (!isEnabled(societyId, FeatureKey.DOCUMENTS)) {
            return List.of();
        }
        return documentRepository.findBySocietyIdAndIsPublicTrue(societyId).stream().map(this::toResponse).toList();
    }

    public DocumentResponse getDocument(Long societyId, Long documentId) {
        if (!isEnabled(societyId, FeatureKey.DOCUMENTS)) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "DOCUMENT_NOT_FOUND", "Document not found");
        }
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "DOCUMENT_NOT_FOUND", "Document not found"));
        if (!document.getSociety().getId().equals(societyId) || !document.isPublic()) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "DOCUMENT_NOT_FOUND", "Document not found");
        }
        return toResponse(document);
    }

    public List<FormResponse> listForms(Long societyId) {
        if (!isEnabled(societyId, FeatureKey.FORMS)) {
            return List.of();
        }
        return formRepository.findBySocietyIdAndIsPublicTrue(societyId).stream().map(this::toResponse).toList();
    }

    public FormResponse getForm(Long societyId, Long formId) {
        if (!isEnabled(societyId, FeatureKey.FORMS)) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "FORM_NOT_FOUND", "Form not found");
        }
        Form form = formRepository.findById(formId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "FORM_NOT_FOUND", "Form not found"));
        if (!form.getSociety().getId().equals(societyId) || !form.isPublic()) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "FORM_NOT_FOUND", "Form not found");
        }
        return toResponse(form);
    }

    public List<CommitteeResponse> listCommittee(Long societyId) {
        if (!isEnabled(societyId, FeatureKey.COMMITTEE)) {
            return List.of();
        }
        return committeeRepository.findBySocietyId(societyId).stream().map(this::toResponse).toList();
    }

    public List<MeetingResponse> listMeetings(Long societyId) {
        if (!isEnabled(societyId, FeatureKey.MEETINGS)) {
            return List.of();
        }
        return meetingRepository.findBySocietyIdAndIsPublicTrue(societyId).stream().map(this::toResponse).toList();
    }

    public MeetingResponse getMeeting(Long societyId, Long meetingId) {
        if (!isEnabled(societyId, FeatureKey.MEETINGS)) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "MEETING_NOT_FOUND", "Meeting not found");
        }
        Meeting meeting = meetingRepository.findById(meetingId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "MEETING_NOT_FOUND", "Meeting not found"));
        if (!meeting.getSociety().getId().equals(societyId) || !meeting.isPublic()) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "MEETING_NOT_FOUND", "Meeting not found");
        }
        return toResponse(meeting);
    }

    public List<GalleryResponse> listGallery(Long societyId) {
        if (!isEnabled(societyId, FeatureKey.GALLERY)) {
            return List.of();
        }
        return galleryRepository.findBySocietyIdAndIsPublicTrue(societyId).stream().map(this::toResponse).toList();
    }

    public GalleryResponse getGalleryItem(Long societyId, Long galleryId) {
        if (!isEnabled(societyId, FeatureKey.GALLERY)) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "GALLERY_NOT_FOUND", "Gallery item not found");
        }
        Gallery gallery = galleryRepository.findById(galleryId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "GALLERY_NOT_FOUND", "Gallery item not found"));
        if (!gallery.getSociety().getId().equals(societyId) || !gallery.isPublic()) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "GALLERY_NOT_FOUND", "Gallery item not found");
        }
        return toResponse(gallery);
    }

    private NoticeResponse toResponse(Notice notice) {
        List<AttachmentResponse> attachments = notice.getAttachments().stream()
                .map(a -> new AttachmentResponse(a.getId(), a.getFileName(), a.getFilePath()))
                .toList();
        return new NoticeResponse(notice.getId(), notice.getTitle(), notice.getBody(),
                notice.getCategory().getId(), notice.getCategory().getName(),
                notice.getPublishOn(), notice.getExpireOn(), notice.isPublic(), notice.isDownloadable(),
                attachments, notice.getCreatedAt());
    }

    private DocumentResponse toResponse(Document document) {
        List<AttachmentResponse> attachments = document.getAttachments().stream()
                .map(a -> new AttachmentResponse(a.getId(), a.getFileName(), a.getFilePath()))
                .toList();
        return new DocumentResponse(document.getId(), document.getTitle(),
                document.getCategory().getId(), document.getCategory().getName(),
                document.getYear(), document.getDescription(), document.isPublic(), document.isDownloadable(),
                attachments, document.getCreatedAt());
    }

    private FormResponse toResponse(Form form) {
        List<AttachmentResponse> attachments = form.getAttachments().stream()
                .map(a -> new AttachmentResponse(a.getId(), a.getFileName(), a.getFilePath()))
                .toList();
        return new FormResponse(form.getId(), form.getTitle(),
                form.getCategory().getId(), form.getCategory().getName(),
                form.getYear(), form.getDescription(), form.isPublic(), form.isDownloadable(),
                attachments, form.getCreatedAt());
    }

    private CommitteeResponse toResponse(Committee committee) {
        return new CommitteeResponse(committee.getId(), committee.getName(), committee.getDesignation(),
                committee.getFlat(), committee.getPhone(), committee.getEmail(),
                committee.getServingSince(), committee.getPhotoUrl(), committee.getCreatedAt());
    }

    private MeetingResponse toResponse(Meeting meeting) {
        List<AttachmentResponse> attachments = meeting.getAttachments().stream()
                .map(a -> new AttachmentResponse(a.getId(), a.getFileName(), a.getFilePath()))
                .toList();
        return new MeetingResponse(meeting.getId(), meeting.getTitle(),
                meeting.getCategory().getId(), meeting.getCategory().getName(),
                meeting.getAgenda(), meeting.getMeetingDate(), attachments,
                meeting.getPlatform() != null ? meeting.getPlatform().name() : null,
                meeting.getMeetingUrl(),
                meeting.getStatus().name(),
                meeting.getRecordingUrl(),
                meeting.isPublic(), meeting.isDownloadable(), meeting.getCreatedAt());
    }

    private GalleryResponse toResponse(Gallery gallery) {
        return new GalleryResponse(gallery.getId(), gallery.getAlbum().getId(), gallery.getAlbum().getName(),
                gallery.getTitle(), gallery.getDescription(), gallery.getAttachmentPath(), gallery.isPublic(), gallery.isDownloadable(),
                gallery.getCreatedAt());
    }
}
