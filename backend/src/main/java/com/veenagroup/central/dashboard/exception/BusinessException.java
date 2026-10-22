package com.veenagroup.central.dashboard.exception;

import org.springframework.http.HttpStatus;

public class BusinessException extends RuntimeException {

    private final HttpStatus status;
    private final String errorCode;
    private final transient Object data;

    public BusinessException(HttpStatus status, String errorCode, String message) {
        this(status, errorCode, message, null);
    }

    /** `data` is serialised into the error response body (e.g. the list of items blocking an operation). */
    public BusinessException(HttpStatus status, String errorCode, String message, Object data) {
        super(message);
        this.status = status;
        this.errorCode = errorCode;
        this.data = data;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getErrorCode() {
        return errorCode;
    }

    public Object getData() {
        return data;
    }
}
