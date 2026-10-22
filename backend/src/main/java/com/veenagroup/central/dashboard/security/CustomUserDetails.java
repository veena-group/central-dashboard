package com.veenagroup.central.dashboard.security;

import com.veenagroup.central.dashboard.entity.Users;
import com.veenagroup.central.dashboard.entity.enums.LoginType;
import com.veenagroup.central.dashboard.entity.enums.Role;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;

public class CustomUserDetails implements UserDetails {

    private final Long userId;
    private final Long societyId;
    private final String name;
    private final String email;
    private final String phone;
    private final LoginType loginType;
    private final String photoUrl;
    private final String societyName;
    private final String societyDomain;
    private final String societyLogoUrl;
    private final String primaryColor;
    private final String secondaryColor;
    private final String passwordHash;
    private final Role role;
    private final int tokenVersion;

    public CustomUserDetails(Users user) {
        this.userId = user.getId();
        this.tokenVersion = user.getTokenVersion();
        this.societyId = user.getSociety() != null ? user.getSociety().getId() : null;
        this.name = user.getName();
        this.email = user.getEmail();
        this.phone = user.getPhone();
        // Super admin has no society and always signs in by email.
        this.loginType = user.getSociety() != null ? user.getSociety().getLoginType() : LoginType.EMAIL;
        this.photoUrl = user.getPhotoUrl();
        this.societyName = user.getSociety() != null ? user.getSociety().getName() : null;
        this.societyDomain = user.getSociety() != null ? user.getSociety().getDomain() : null;
        this.societyLogoUrl = user.getSociety() != null ? user.getSociety().getLogoUrl() : null;
        this.primaryColor = user.getSociety() != null ? user.getSociety().getPrimaryColor() : null;
        this.secondaryColor = user.getSociety() != null ? user.getSociety().getSecondaryColor() : null;
        this.passwordHash = user.getPasswordHash();
        this.role = user.getRole();
    }

    public Long getUserId() {
        return userId;
    }

    public String getName() {
        return name;
    }

    /** May be null for a society that signs in by mobile. */
    public String getEmail() {
        return email;
    }

    public String getPhone() {
        return phone;
    }

    public LoginType getLoginType() {
        return loginType;
    }

    public Long getSocietyId() {
        return societyId;
    }

    public String getPhotoUrl() {
        return photoUrl;
    }

    public String getSocietyName() {
        return societyName;
    }

    public String getSocietyDomain() {
        return societyDomain;
    }

    public String getSocietyLogoUrl() {
        return societyLogoUrl;
    }

    public String getPrimaryColor() {
        return primaryColor;
    }

    public String getSecondaryColor() {
        return secondaryColor;
    }

    public Role getRole() {
        return role;
    }

    public int getTokenVersion() {
        return tokenVersion;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role.name()));
    }

    @Override
    public String getPassword() {
        return passwordHash;
    }

    /**
     * The user id, not the email: a mobile-login member may have no email at all, and ids never
     * change when a member's email or phone does. CustomUserDetailsService resolves it back.
     */
    @Override
    public String getUsername() {
        return String.valueOf(userId);
    }
}
