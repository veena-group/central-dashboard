package com.veenagroup.central.dashboard.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ContactNormalizerTest {

    @Test
    void mobileStripsSpacesAndHyphens() {
        assertEquals("9876543210", ContactNormalizer.mobile(" 98765 43210 "));
        assertEquals("9876543210", ContactNormalizer.mobile("98765-43210"));
    }

    @Test
    void blankValuesBecomeNull() {
        assertNull(ContactNormalizer.mobile(null));
        assertNull(ContactNormalizer.mobile("   "));
        assertNull(ContactNormalizer.email(null));
        assertNull(ContactNormalizer.email("  "));
    }

    @Test
    void emailIsTrimmedButKeepsCase() {
        assertEquals("Rohan@Example.com", ContactNormalizer.email("  Rohan@Example.com "));
        assertEquals("rohan@example.com", ContactNormalizer.emailLower("  Rohan@Example.com "));
    }

    @Test
    void validMobileMustBeTenDigitsStartingSixToNine() {
        assertTrue(ContactNormalizer.isValidMobile("9876543210"));
        assertTrue(ContactNormalizer.isValidMobile("6000000000"));
        assertFalse(ContactNormalizer.isValidMobile("5876543210"));
        assertFalse(ContactNormalizer.isValidMobile("987654321"));
        assertFalse(ContactNormalizer.isValidMobile("98765432101"));
        assertFalse(ContactNormalizer.isValidMobile("98765abcde"));
        assertFalse(ContactNormalizer.isValidMobile(null));
    }
}
