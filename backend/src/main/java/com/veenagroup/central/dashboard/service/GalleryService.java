package com.veenagroup.central.dashboard.service;

import com.veenagroup.central.dashboard.dto.admin.GalleryResponse;
import com.veenagroup.central.dashboard.dto.admin.GalleryUpdateRequest;
import com.veenagroup.central.dashboard.entity.Category;
import com.veenagroup.central.dashboard.entity.Gallery;
import com.veenagroup.central.dashboard.entity.Society;
import com.veenagroup.central.dashboard.entity.Users;
import com.veenagroup.central.dashboard.entity.enums.CategoryType;
import com.veenagroup.central.dashboard.entity.enums.FeatureKey;
import com.veenagroup.central.dashboard.exception.BusinessException;
import com.veenagroup.central.dashboard.repository.CategoryRepository;
import com.veenagroup.central.dashboard.repository.GalleryRepository;
import com.veenagroup.central.dashboard.repository.SocietyRepository;
import com.veenagroup.central.dashboard.repository.UsersRepository;
import com.veenagroup.central.dashboard.storage.FileStorageService;
import com.veenagroup.central.dashboard.web.PageResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Slf4j
@Service
public class GalleryService {

    private final GalleryRepository galleryRepository;
    private final CategoryRepository categoryRepository;
    private final SocietyRepository societyRepository;
    private final UsersRepository usersRepository;
    private final FeatureLimitService featureLimitService;
    private final FileStorageService fileStorageService;

    public GalleryService(GalleryRepository galleryRepository,
                           CategoryRepository categoryRepository,
                           SocietyRepository societyRepository,
                           UsersRepository usersRepository,
                           FeatureLimitService featureLimitService,
                           FileStorageService fileStorageService) {
        this.galleryRepository = galleryRepository;
        this.categoryRepository = categoryRepository;
        this.societyRepository = societyRepository;
        this.usersRepository = usersRepository;
        this.featureLimitService = featureLimitService;
        this.fileStorageService = fileStorageService;
    }

    @Transactional
    public GalleryResponse create(Long societyId, Long userId, Long albumId, String title, String description,
                                   boolean isPublic, boolean downloadable, MultipartFile file) {
        featureLimitService.assertCanCreate(societyId, FeatureKey.GALLERY, () -> galleryRepository.countBySocietyId(societyId));

        Society society = societyRepository.findById(societyId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "SOCIETY_NOT_FOUND", "Society not found"));
        Category album = findOwnedAlbum(societyId, albumId);
        Users createdBy = usersRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "User not found"));

        String path = fileStorageService.store(file, societyId, "gallery");

        Gallery gallery = Gallery.builder()
                .society(society)
                .album(album)
                .title(title)
                .description(description)
                .attachmentPath(path)
                .isPublic(isPublic)
                .downloadable(downloadable)
                .createdBy(createdBy)
                .build();

        Gallery saved = galleryRepository.save(gallery);
        log.info("Created gallery item {} for society {}", saved.getId(), societyId);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<GalleryResponse> list(Long societyId) {
        return galleryRepository.findBySocietyId(societyId).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<GalleryResponse> list(Long societyId, Pageable pageable, Long albumId) {
        featureLimitService.assertEnabled(societyId, FeatureKey.GALLERY);
        Specification<Gallery> spec = buildSpecification(societyId, albumId);
        return PageResponse.of(galleryRepository.findAll(spec, pageable).map(this::toResponse));
    }

    private Specification<Gallery> buildSpecification(Long societyId, Long albumId) {
        Specification<Gallery> spec = (root, query, cb) -> cb.equal(root.get("society").get("id"), societyId);
        if (albumId != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("album").get("id"), albumId));
        }
        return spec;
    }

    @Transactional(readOnly = true)
    public GalleryResponse getById(Long societyId, Long galleryId) {
        return toResponse(findOwned(societyId, galleryId));
    }

    @Transactional
    public GalleryResponse update(Long societyId, Long galleryId, GalleryUpdateRequest request) {
        Gallery gallery = findOwned(societyId, galleryId);
        Category album = findOwnedAlbum(societyId, request.albumId());

        gallery.setAlbum(album);
        gallery.setTitle(request.title());
        gallery.setDescription(request.description());
        gallery.setPublic(request.isPublic());
        gallery.setDownloadable(request.downloadable());

        Gallery updated = galleryRepository.save(gallery);
        log.info("Updated gallery item {} for society {}", updated.getId(), societyId);
        return toResponse(updated);
    }

    @Transactional
    public GalleryResponse replaceImage(Long societyId, Long galleryId, MultipartFile file) {
        Gallery gallery = findOwned(societyId, galleryId);
        fileStorageService.deleteAfterCommit(gallery.getAttachmentPath());
        String path = fileStorageService.store(file, societyId, "gallery");
        gallery.setAttachmentPath(path);
        Gallery updated = galleryRepository.save(gallery);
        log.info("Replaced image for gallery item {} in society {}", updated.getId(), societyId);
        return toResponse(updated);
    }

    @Transactional
    public void delete(Long societyId, Long galleryId) {
        Gallery gallery = findOwned(societyId, galleryId);
        fileStorageService.deleteAfterCommit(gallery.getAttachmentPath());
        galleryRepository.delete(gallery);
        log.info("Deleted gallery item {} for society {}", galleryId, societyId);
    }

    private Category findOwnedAlbum(Long societyId, Long albumId) {
        Category album = categoryRepository.findById(albumId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "ALBUM_NOT_FOUND", "Album not found"));
        if (!album.getSociety().getId().equals(societyId) || album.getType() != CategoryType.GALLERY_ALBUM) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "INVALID_ALBUM", "Invalid album for this society");
        }
        return album;
    }

    private Gallery findOwned(Long societyId, Long galleryId) {
        Gallery gallery = galleryRepository.findById(galleryId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "GALLERY_NOT_FOUND", "Gallery item not found"));
        if (!gallery.getSociety().getId().equals(societyId)) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "GALLERY_NOT_FOUND", "Gallery item not found");
        }
        return gallery;
    }

    private GalleryResponse toResponse(Gallery gallery) {
        return new GalleryResponse(
                gallery.getId(), gallery.getAlbum().getId(), gallery.getAlbum().getName(),
                gallery.getTitle(), gallery.getDescription(), gallery.getAttachmentPath(),
                gallery.isPublic(), gallery.isDownloadable(), gallery.getCreatedAt()
        );
    }
}
