package com.veenagroup.central.dashboard.service;

import com.veenagroup.central.dashboard.dto.admin.FeatureUsageResponse;
import com.veenagroup.central.dashboard.entity.enums.FeatureKey;
import com.veenagroup.central.dashboard.repository.*;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class FeatureUsageService {

    private final SocietyFeatureRepository societyFeatureRepository;
    private final UsersRepository usersRepository;
    private final NoticeRepository noticeRepository;
    private final DocumentRepository documentRepository;
    private final FormRepository formRepository;
    private final CommitteeRepository committeeRepository;
    private final MeetingRepository meetingRepository;
    private final GalleryRepository galleryRepository;
    private final EventRepository eventRepository;

    public FeatureUsageService(SocietyFeatureRepository societyFeatureRepository,
                                UsersRepository usersRepository,
                                NoticeRepository noticeRepository,
                                DocumentRepository documentRepository,
                                FormRepository formRepository,
                                CommitteeRepository committeeRepository,
                                MeetingRepository meetingRepository,
                                GalleryRepository galleryRepository,
                                EventRepository eventRepository) {
        this.societyFeatureRepository = societyFeatureRepository;
        this.usersRepository = usersRepository;
        this.noticeRepository = noticeRepository;
        this.documentRepository = documentRepository;
        this.formRepository = formRepository;
        this.committeeRepository = committeeRepository;
        this.meetingRepository = meetingRepository;
        this.galleryRepository = galleryRepository;
        this.eventRepository = eventRepository;
    }

    public List<FeatureUsageResponse> getUsage(Long societyId) {
        var featuresByKey = societyFeatureRepository.findBySocietyId(societyId).stream()
                .collect(java.util.stream.Collectors.toMap(
                        f -> f.getFeatureKey(), f -> f));

        return List.of(FeatureKey.values()).stream()
                .map(key -> {
                    var feature = featuresByKey.get(key);
                    boolean enabled = feature != null && feature.isEnabled();
                    int limit = feature != null ? feature.getLimit() : 0;
                    long used = countFor(key, societyId);
                    return new FeatureUsageResponse(key.name(), enabled, limit, used);
                })
                .toList();
    }

    private long countFor(FeatureKey key, Long societyId) {
        return switch (key) {
            case MEMBERS -> usersRepository.countBySocietyId(societyId);
            case NOTICES -> noticeRepository.countBySocietyId(societyId);
            case DOCUMENTS -> documentRepository.countBySocietyId(societyId);
            case FORMS -> formRepository.countBySocietyId(societyId);
            case COMMITTEE -> committeeRepository.countBySocietyId(societyId);
            case MEETINGS -> meetingRepository.countBySocietyId(societyId);
            case GALLERY -> galleryRepository.countBySocietyId(societyId);
            case EVENTS -> eventRepository.countBySocietyId(societyId);
        };
    }
}
