package com.veenagroup.central.dashboard.dto.auth;

/** What a login page needs to know before the user types anything: which identifier to ask for. */
public record LoginConfigResponse(String loginType) {
}
