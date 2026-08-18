package com.veenagroup.central.dashboard.controller;

import com.veenagroup.central.dashboard.dto.me.ChangePasswordRequest;
import com.veenagroup.central.dashboard.dto.me.MyProfileResponse;
import com.veenagroup.central.dashboard.dto.me.UpdateMyProfileRequest;
import com.veenagroup.central.dashboard.security.CurrentUser;
import com.veenagroup.central.dashboard.service.ProfileService;
import com.veenagroup.central.dashboard.web.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/me")
public class MeController {

    private final ProfileService profileService;
    private final CurrentUser currentUser;

    public MeController(ProfileService profileService, CurrentUser currentUser) {
        this.profileService = profileService;
        this.currentUser = currentUser;
    }

    @GetMapping
    public ApiResponse<MyProfileResponse> profile() {
        return ApiResponse.of("Profile fetched successfully", profileService.getProfile(currentUser.userId()));
    }

    @PutMapping
    public ApiResponse<MyProfileResponse> updateProfile(@Valid @RequestBody UpdateMyProfileRequest request) {
        return ApiResponse.of("Profile updated successfully", profileService.updateProfile(currentUser.userId(), request));
    }

    @PutMapping("/password")
    public ResponseEntity<ApiResponse<Void>> changePassword(@Valid @RequestBody ChangePasswordRequest request) {
        profileService.changePassword(currentUser.userId(), request);
        return ResponseEntity.ok(ApiResponse.of("Password changed successfully", null));
    }

    @PostMapping("/photo")
    public ApiResponse<MyProfileResponse> uploadPhoto(@RequestParam("file") MultipartFile file) {
        return ApiResponse.of("Photo uploaded successfully", profileService.uploadPhoto(currentUser.userId(), file));
    }
}
