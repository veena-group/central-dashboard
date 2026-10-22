package com.veenagroup.central.dashboard.service;

import com.veenagroup.central.dashboard.dto.me.ChangePasswordRequest;
import com.veenagroup.central.dashboard.dto.me.MyProfileResponse;
import com.veenagroup.central.dashboard.dto.me.UpdateMyProfileRequest;
import com.veenagroup.central.dashboard.entity.Users;
import com.veenagroup.central.dashboard.entity.enums.LoginType;
import com.veenagroup.central.dashboard.exception.BusinessException;
import com.veenagroup.central.dashboard.repository.UsersRepository;
import com.veenagroup.central.dashboard.storage.FileStorageService;
import com.veenagroup.central.dashboard.util.ContactNormalizer;
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

    /** Transactional because toResponse reads the lazy society (login type) and open-in-view is off. */
    @Transactional(readOnly = true)
    public MyProfileResponse getProfile(Long userId) {
        return toResponse(findOrThrow(userId));
    }

    @Transactional
    public MyProfileResponse updateProfile(Long userId, UpdateMyProfileRequest request) {
        Users user = findOrThrow(userId);
        user.setName(request.name().trim());
        user.setFlat(normalize(request.flat()));
        user.setWing(normalize(request.wing()));
        applyPhone(user, request.phone());
        Users updated = usersRepository.save(user);
        return toResponse(updated);
    }

    /**
     * For a society that signs in by mobile, the phone number *is* the login, so it can't be cleared
     * and can't collide with a colleague's. Elsewhere it's optional contact info, but still format-checked.
     */
    private void applyPhone(Users user, String requested) {
        String phone = ContactNormalizer.mobile(requested);
        if (phone != null && !ContactNormalizer.isValidMobile(phone)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "INVALID_PHONE", "Phone number must be a valid 10-digit Indian mobile number");
        }
        if (user.getSociety() != null && user.getSociety().getLoginType() == LoginType.MOBILE) {
            if (phone == null) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "PHONE_REQUIRED", "Mobile number is required because it is your login");
            }
            if (usersRepository.existsBySocietyIdAndPhoneAndIdNot(user.getSociety().getId(), phone, user.getId())) {
                throw new BusinessException(HttpStatus.CONFLICT, "PHONE_ALREADY_IN_USE", "Mobile number already in use");
            }
        }
        user.setPhone(phone);
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
                user.getCreatedAt(),
                (user.getSociety() != null ? user.getSociety().getLoginType() : LoginType.EMAIL).name()
        );
    }
}
