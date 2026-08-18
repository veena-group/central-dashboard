package com.veenagroup.central.dashboard.controller;

import com.veenagroup.central.dashboard.exception.BusinessException;
import com.veenagroup.central.dashboard.security.CurrentUser;
import com.veenagroup.central.dashboard.storage.FileAccessService;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.file.Path;

@RestController
@RequestMapping("/api/files")
public class FileController {

    private final FileAccessService fileAccessService;
    private final CurrentUser currentUser;

    public FileController(FileAccessService fileAccessService, CurrentUser currentUser) {
        this.fileAccessService = fileAccessService;
        this.currentUser = currentUser;
    }

    /**
     * Generic inline viewer used by the authenticated admin/member UI (MediaUrlService) for society
     * logos, avatars, gallery thumbnails, etc. Every stored path starts with "{societyId}_...", so it
     * must be checked against the caller's own society before serving - otherwise any authenticated
     * user could view any other society's files just by knowing/guessing a path.
     */
    @GetMapping("/view")
    public ResponseEntity<Resource> view(@RequestParam("path") String relativePath) {
        if (!currentUser.isSuperAdmin() && !belongsToSociety(relativePath, currentUser.requireSocietyId())) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "FILE_NOT_FOUND", "File not found");
        }

        String fileName = Path.of(relativePath).getFileName().toString();
        return fileAccessService.serve(relativePath, fileName, true, false);
    }

    private boolean belongsToSociety(String relativePath, Long societyId) {
        String normalized = relativePath.replace('\\', '/');
        int slashIdx = normalized.indexOf('/');
        String firstSegment = slashIdx < 0 ? normalized : normalized.substring(0, slashIdx);
        int underscoreIdx = firstSegment.indexOf('_');
        if (underscoreIdx <= 0) {
            return false;
        }
        try {
            return Long.parseLong(firstSegment.substring(0, underscoreIdx)) == societyId;
        } catch (NumberFormatException e) {
            return false;
        }
    }
}
