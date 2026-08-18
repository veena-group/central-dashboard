package com.veenagroup.central.dashboard.dto.superadmin;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;

public record PaymentRequest(
        @NotBlank String plan,
        @NotNull BigDecimal amount,
        @NotNull LocalDate paymentDate,
        @NotNull LocalDate nextDueDate
) {
}
