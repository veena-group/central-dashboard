package com.veenagroup.central.dashboard.storage;

import com.veenagroup.central.dashboard.entity.Society;
import com.veenagroup.central.dashboard.exception.BusinessException;
import com.veenagroup.central.dashboard.repository.SocietyRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

@Slf4j
@Service
public class FileStorageService {

    /**
     * Extensions this app ever needs to accept. Deliberately excludes html/htm/svg/xml/js and any
     * executable-capable type - FileAccessService serves files by extension-derived content type,
     * so anything not on this list could otherwise be uploaded and later rendered/executed inline.
     */
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            "jpg", "jpeg", "png", "gif", "webp",
            "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv"
    );

    private static final Set<String> PDF_ONLY_EXTENSIONS = Set.of("pdf");

    private final Path basePath;
    private final SocietyRepository societyRepository;
    private final long maxBytesPerSociety;

    /**
     * Serializes the "measure current usage, then write" critical section per society, so two
     * concurrent uploads to the same society can't both pass the quota check before either file is
     * actually written (a filesystem check-then-act race that DB transactions can't cover). Uploads
     * to different societies never block each other since each gets its own lock instance.
     */
    private final ConcurrentHashMap<Long, Lock> societyUploadLocks = new ConcurrentHashMap<>();

    public FileStorageService(@Value("${app.storage.base-path}") String basePath,
                               @Value("${app.storage.max-bytes-per-society}") long maxBytesPerSociety,
                               SocietyRepository societyRepository) {
        this.basePath = Path.of(basePath).toAbsolutePath().normalize();
        this.maxBytesPerSociety = maxBytesPerSociety;
        this.societyRepository = societyRepository;
        try {
            Files.createDirectories(this.basePath);
        } catch (IOException e) {
            throw new IllegalStateException("Could not initialize storage directory: " + this.basePath, e);
        }
    }

    /**
     * Stores a file under {basePath}/{societyId}_{societyName}/{subfolder}/ with a random prefix to avoid name clashes.
     * Returns the relative path to store in the DB (not the absolute filesystem path).
     */
    public String store(MultipartFile file, Long societyId, String subfolder) {
        return store(file, societyId, subfolder, ALLOWED_EXTENSIONS,
                "This file type is not allowed. Supported types: images, PDF, Word, Excel, PowerPoint, and plain text/CSV files.");
    }

    /**
     * Restricts the upload to PDF only. Used for notice/form/meeting/event attachments, which
     * (unlike the general Documents repository) are meant to hold a single printable/shareable
     * PDF rather than arbitrary office file types.
     */
    public String storePdfOnly(MultipartFile file, Long societyId, String subfolder) {
        return store(file, societyId, subfolder, PDF_ONLY_EXTENSIONS, "Only PDF files are allowed for this attachment.");
    }

    private String store(MultipartFile file, Long societyId, String subfolder, Set<String> allowedExtensions, String unsupportedTypeMessage) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "EMPTY_FILE", "File must not be empty");
        }

        String extension = extensionOf(file.getOriginalFilename());
        if (!allowedExtensions.contains(extension)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "UNSUPPORTED_FILE_TYPE", unsupportedTypeMessage);
        }

        String originalName = sanitize(file.getOriginalFilename());
        String storedName = UUID.randomUUID() + "_" + originalName;
        String relativePath = societyFolder(societyId) + "/" + subfolder + "/" + storedName;

        Path targetPath = basePath.resolve(relativePath).normalize();
        if (!targetPath.startsWith(basePath)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "INVALID_FILE_PATH", "Invalid file path");
        }

        Lock lock = societyUploadLocks.computeIfAbsent(societyId, id -> new ReentrantLock());
        lock.lock();
        try {
            if (currentUsageBytes(societyId) + file.getSize() > maxBytesPerSociety) {
                throw new BusinessException(HttpStatus.PAYLOAD_TOO_LARGE, "STORAGE_QUOTA_EXCEEDED",
                        "Your society has reached its storage limit. Please remove unused files or contact support to increase it.");
            }

            try {
                Files.createDirectories(targetPath.getParent());
                file.transferTo(targetPath);
            } catch (IOException e) {
                log.error("Failed to store file for society {} in subfolder {}: {}", societyId, subfolder, e.getMessage(), e);
                throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "FILE_STORAGE_FAILED", "Failed to store file");
            }
        } finally {
            lock.unlock();
        }

        log.info("Stored file for society {} at {}", societyId, relativePath);
        return relativePath;
    }

    private long currentUsageBytes(Long societyId) {
        Path societyDir = basePath.resolve(societyFolder(societyId)).normalize();
        if (!societyDir.startsWith(basePath) || !Files.isDirectory(societyDir)) {
            return 0L;
        }
        try (var stream = Files.walk(societyDir)) {
            return stream.filter(Files::isRegularFile).mapToLong(p -> {
                try {
                    return Files.size(p);
                } catch (IOException e) {
                    return 0L;
                }
            }).sum();
        } catch (IOException e) {
            log.warn("Could not compute storage usage for society {}: {}", societyId, e.getMessage());
            return 0L;
        }
    }

    private String extensionOf(String filename) {
        if (filename == null) {
            return "";
        }
        int idx = filename.lastIndexOf('.');
        if (idx < 0 || idx == filename.length() - 1) {
            return "";
        }
        return filename.substring(idx + 1).toLowerCase(Locale.ROOT);
    }

    public Resource loadAsResource(String relativePath) {
        try {
            Path filePath = resolve(relativePath);
            Resource resource = new UrlResource(filePath.toUri());
            if (!resource.exists() || !resource.isReadable()) {
                log.warn("File not found or not readable: {}", relativePath);
                throw new BusinessException(HttpStatus.NOT_FOUND, "FILE_NOT_FOUND", "File not found");
            }
            return resource;
        } catch (MalformedURLException e) {
            log.warn("File not found or invalid path: {} ({})", relativePath, e.getMessage());
            throw new BusinessException(HttpStatus.NOT_FOUND, "FILE_NOT_FOUND", "File not found");
        }
    }

    public void delete(String relativePath) {
        try {
            Path filePath = resolve(relativePath);
            if (filePath.startsWith(basePath)) {
                Files.deleteIfExists(filePath);
            }
        } catch (IOException e) {
            log.warn("Failed to delete file at {}: {}", relativePath, e.getMessage());
            // best-effort delete; DB record removal is the source of truth
        }
    }

    /**
     * Same as delete(), but defers the actual filesystem delete until the caller's transaction
     * commits successfully. Use this instead of delete() whenever the physical file is being
     * removed/replaced alongside a DB change (attachment removal, record deletion, logo/photo
     * replacement) - if the DB transaction later rolls back (constraint violation, connection
     * drop, etc.), the file is left in place instead of being deleted out from under a DB row
     * that still references it.
     */
    public void deleteAfterCommit(String relativePath) {
        if (relativePath == null || relativePath.isBlank()) {
            return;
        }
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            delete(relativePath);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                delete(relativePath);
            }
        });
    }

    public Path resolve(String relativePath) {
        Path filePath = basePath.resolve(relativePath).normalize();
        if (!filePath.startsWith(basePath)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "INVALID_FILE_PATH", "Invalid file path");
        }
        return filePath;
    }

    private String sanitize(String filename) {
        if (filename == null || filename.isBlank()) {
            return "file";
        }
        return filename.replaceAll("[^a-zA-Z0-9._-]", "_");
    }

    private String societyFolder(Long societyId) {
        String name = societyRepository.findById(societyId)
                .map(Society::getName)
                .orElse("unknown");
        String sanitizedName = name.trim().replaceAll("[^a-zA-Z0-9]+", "-").replaceAll("^-+|-+$", "");
        return societyId + "_" + sanitizedName;
    }
}
