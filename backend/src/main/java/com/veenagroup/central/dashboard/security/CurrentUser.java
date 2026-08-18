package com.veenagroup.central.dashboard.security;

import com.veenagroup.central.dashboard.entity.enums.Role;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
public class CurrentUser {

    public CustomUserDetails get() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (!(principal instanceof CustomUserDetails userDetails)) {
            throw new IllegalStateException("No authenticated user in security context");
        }
        return userDetails;
    }

    public Long userId() {
        return get().getUserId();
    }

    public Long societyId() {
        return get().getSocietyId();
    }

    public Role role() {
        return get().getRole();
    }

    public boolean isSuperAdmin() {
        return role() == Role.SUPER_ADMIN;
    }

    /**
     * Society-scoped endpoints (admin/member) should always have a societyId on the token.
     * Super Admin endpoints pass society_id explicitly instead of relying on this.
     */
    public Long requireSocietyId() {
        Long societyId = societyId();
        if (societyId == null) {
            throw new IllegalStateException("Current user has no society context");
        }
        return societyId;
    }
}
