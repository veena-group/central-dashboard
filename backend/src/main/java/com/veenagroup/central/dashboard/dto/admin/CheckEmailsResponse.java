package com.veenagroup.central.dashboard.dto.admin;

import java.util.List;

public record CheckEmailsResponse(
        List<String> existingEmails
) {
}
