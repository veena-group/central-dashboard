package com.veenagroup.central.dashboard.util;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Single place that decides what a stored/compared email or mobile number looks like, so the login
 * lookup, member create/update, bulk import and profile edit can never disagree about it.
 */
public final class ContactNormalizer {

    /** 10-digit Indian mobile number; the first digit must be 6-9 per the TRAI numbering plan. */
    private static final Pattern MOBILE_PATTERN = Pattern.compile("^[6-9]\\d{9}$");

    private ContactNormalizer() {
    }

    /** Trims; blank becomes null. Case is left as entered (existing accounts are stored as typed). */
    public static String email(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    public static String emailLower(String value) {
        String email = email(value);
        return email == null ? null : email.toLowerCase(Locale.ROOT);
    }

    /** Strips spaces and hyphens; blank becomes null. Does not validate - see {@link #isValidMobile}. */
    public static String mobile(String value) {
        if (value == null) {
            return null;
        }
        String stripped = value.replaceAll("[\\s-]", "");
        return stripped.isEmpty() ? null : stripped;
    }

    public static boolean isValidMobile(String normalizedMobile) {
        return normalizedMobile != null && MOBILE_PATTERN.matcher(normalizedMobile).matches();
    }
}
