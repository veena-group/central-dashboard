package com.veenagroup.central.dashboard.storage;

import com.veenagroup.central.dashboard.exception.BusinessException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.Set;

@Slf4j
@Service
public class FileAccessService {

    /**
     * Only these content types are ever safe to render inline in a browser tab/iframe without risking
     * script execution. Everything else (including any legacy file whose extension we no longer
     * accept on upload) is forced to download instead of inline, regardless of what the caller asked for.
     */
    private static final Set<MediaType> INLINE_SAFE_TYPES = Set.of(
            MediaType.IMAGE_JPEG, MediaType.IMAGE_PNG, MediaType.IMAGE_GIF,
            MediaType.parseMediaType("image/webp"), MediaType.APPLICATION_PDF,
            MediaType.TEXT_PLAIN, MediaType.parseMediaType("text/csv")
    );

    private final FileStorageService fileStorageService;

    public FileAccessService(FileStorageService fileStorageService) {
        this.fileStorageService = fileStorageService;
    }

    /**
     * asAttachment=true is a real download and is blocked when the parent record has downloadable=false.
     * asAttachment=false is an inline view, always allowed once the caller already has visibility of the record,
     * but is only actually served inline when the resolved content type is in INLINE_SAFE_TYPES - anything else
     * (e.g. a legacy html/svg file uploaded before type validation existed) is forced to download instead,
     * since a browser must never be allowed to render arbitrary uploaded content as an executable document.
     */
    public ResponseEntity<Resource> serve(String relativePath, String fileName, boolean downloadable, boolean asAttachment) {
        if (asAttachment && !downloadable) {
            log.warn("Download blocked for non-downloadable file: {}", relativePath);
            throw new BusinessException(HttpStatus.FORBIDDEN, "FILE_NOT_DOWNLOADABLE", "This file is not available for download");
        }

        Resource resource = fileStorageService.loadAsResource(relativePath);
        MediaType contentType = resolveContentType(fileName, relativePath);
        boolean serveInline = !asAttachment && INLINE_SAFE_TYPES.contains(contentType);
        ContentDisposition disposition = (serveInline ? ContentDisposition.inline() : ContentDisposition.attachment())
                .filename(fileName != null ? fileName : resource.getFilename())
                .build();

        log.debug("Serving file {} (attachment={})", relativePath, !serveInline);
        return ResponseEntity.ok()
                .contentType(contentType)
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .header("X-Content-Type-Options", "nosniff")
                .body(resource);
    }

    private MediaType resolveContentType(String fileName, String relativePath) {
        String value = fileName != null && !fileName.isBlank() ? fileName : relativePath;
        String extension = extensionOf(value);
        return switch (extension) {
            case "jpg", "jpeg" -> MediaType.IMAGE_JPEG;
            case "png" -> MediaType.IMAGE_PNG;
            case "gif" -> MediaType.IMAGE_GIF;
            case "webp" -> MediaType.parseMediaType("image/webp");
            case "pdf" -> MediaType.APPLICATION_PDF;
            case "txt" -> MediaType.TEXT_PLAIN;
            case "csv" -> MediaType.parseMediaType("text/csv");
            case "doc" -> MediaType.parseMediaType("application/msword");
            case "docx" -> MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
            case "xls" -> MediaType.parseMediaType("application/vnd.ms-excel");
            case "xlsx" -> MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            case "ppt" -> MediaType.parseMediaType("application/vnd.ms-powerpoint");
            case "pptx" -> MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.presentationml.presentation");
            // html/htm/svg/json/xml and anything unrecognized are intentionally NOT mapped to their
            // "real" content type - they're served as octet-stream (forced download) so a browser
            // can never be tricked into rendering/executing them.
            default -> MediaType.APPLICATION_OCTET_STREAM;
        };
    }

    private String extensionOf(String value) {
        if (value == null) {
            return "";
        }
        int idx = value.lastIndexOf('.');
        if (idx < 0 || idx == value.length() - 1) {
            return "";
        }
        return value.substring(idx + 1).toLowerCase(Locale.ROOT);
    }
}
