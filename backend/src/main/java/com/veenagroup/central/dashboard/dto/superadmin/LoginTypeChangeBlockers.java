package com.veenagroup.central.dashboard.dto.superadmin;

import java.util.List;

/**
 * Why a society's login type can't be switched yet. `items` is capped (see SocietyService) so a
 * huge society doesn't produce a huge error body; `totalCount` is the real number of problems.
 */
public record LoginTypeChangeBlockers(String targetLoginType, int totalCount, List<Blocker> items) {

    /** `reason` is MISSING_EMAIL, MISSING_PHONE, INVALID_PHONE or DUPLICATE_PHONE. */
    public record Blocker(Long memberId, String name, String flat, String wing, String reason) {
    }
}
