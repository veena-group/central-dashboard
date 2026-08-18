package com.veenagroup.central.dashboard.web;

import java.time.Instant;

public record ApiErrorResponse(boolean success, String message, String errorCode, Object data, Instant timestamp, String path) {

    public static ApiErrorResponse of(String message, String errorCode, Object data, String path) {
        return new ApiErrorResponse(false, message, errorCode, data, Instant.now(), path);
    }
}
