package com.veenagroup.central.dashboard.dto.superadmin;

import java.math.BigDecimal;
import java.time.LocalDate;

public record PaymentResponse(
        Long id,
        String plan,
        BigDecimal amount,
        LocalDate paymentDate,
        LocalDate nextDueDate
) {
}
