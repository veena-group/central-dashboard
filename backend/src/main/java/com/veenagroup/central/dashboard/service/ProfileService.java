package com.veenagroup.central.dashboard.service;

import com.veenagroup.central.dashboard.dto.me.ChangePasswordRequest;
import com.veenagroup.central.dashboard.dto.me.MyProfileResponse;
import com.veenagroup.central.dashboard.dto.me.UpdateMyProfileRequest;
import com.veenagroup.central.dashboard.entity.Users;
import com.veenagroup.central.dashboard.exception.BusinessException;
import com.veenagroup.central.dashboard.repository.UsersRepository;
import com.veenagroup.central.dashboard.storage.FileStorageService;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class ProfileService {

    private final UsersRepository usersRepository;
    private final PasswordEncoder passwordEncoder;
    private final FileStorageService fileStorageService;

    public ProfileService(UsersRepository usersRepository, PasswordEncoder passwordEncoder, FileStorageService fileStorageService) {
        this.usersRepository = usersRepository;
        this.passwordEncoder = passwordEncoder;
        this.fileStorageService = fileStorageService;
    }

    public MyProfileResponse getProfile(Long userId) {
        return toResponse(findOrThrow(userId));
    }

    @Transactional
    public MyProfileResponse updateProfile(Long userId, UpdateMyProfileRequest request) {
        Users user = findOrThrow(userId);
        user.setName(request.name().trim());
        user.setFlat(normalize(request.flat()));
        user.setWing(normalize(request.wing()));
        user.setPhone(normalize(request.phone()));
        Users updated = usersRepository.save(user);
        return toResponse(updated);
    }

    @Transactional
    public void changePassword(Long userId, ChangePasswordRequest request) {
        Users user = findOrThrow(userId);

        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "INVALID_CURRENT_PASSWORD", "Current password is incorrect");
        }

        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        usersRepository.save(user);
    }

    @Transactional
    public MyProfileResponse uploadPhoto(Long userId, MultipartFile file) {
        Users user = findOrThrow(userId);
        if (user.getSociety() == null) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "PHOTO_UPLOAD_UNAVAILABLE", "Photo upload is unavailable for this account");
        }

        String path = fileStorageService.store(file, user.getSociety().getId(), "members");
        user.setPhotoUrl(path);
        Users updated = usersRepository.save(user);
        return toResponse(updated);
    }

    private Users findOrThrow(Long userId) {
        return usersRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "User not found"));
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private MyProfileResponse toResponse(Users user) {
        return new MyProfileResponse(
                user.getId(),
                user.getName(),
                user.getFlat(),
                user.getWing(),
                user.getEmail(),
                user.getPhone(),
                user.getRole().name(),
                user.getSociety() != null ? user.getSociety().getId() : null,
                user.getPhotoUrl(),
                user.getCreatedAt()
        );
    }
}
