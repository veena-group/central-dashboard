package com.veenagroup.central.dashboard.service;

import com.veenagroup.central.dashboard.dto.superadmin.PaymentRequest;
import com.veenagroup.central.dashboard.dto.superadmin.PaymentResponse;
import com.veenagroup.central.dashboard.entity.Payment;
import com.veenagroup.central.dashboard.entity.Society;
import com.veenagroup.central.dashboard.exception.BusinessException;
import com.veenagroup.central.dashboard.repository.PaymentRepository;
import com.veenagroup.central.dashboard.repository.SocietyRepository;
import com.veenagroup.central.dashboard.web.PageResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
public class PaymentService {

    private final SocietyRepository societyRepository;
    private final PaymentRepository paymentRepository;

    public PaymentService(SocietyRepository societyRepository, PaymentRepository paymentRepository) {
        this.societyRepository = societyRepository;
        this.paymentRepository = paymentRepository;
    }

    @Transactional
    public PaymentResponse addPayment(Long societyId, PaymentRequest request) {
        if (request.nextDueDate().isBefore(request.paymentDate())) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "INVALID_PAYMENT_PERIOD", "Next due date must be on or after the payment date");
        }

        Society society = societyRepository.findById(societyId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "SOCIETY_NOT_FOUND", "Society not found"));

        Payment payment = Payment.builder()
                .society(society)
                .plan(request.plan())
                .amount(request.amount())
                .paymentDate(request.paymentDate())
                .nextDueDate(request.nextDueDate())
                .build();

        Payment saved = paymentRepository.save(payment);
        log.info("Recorded payment {} for society {}: amount={}", saved.getId(), societyId, saved.getAmount());
        return toResponse(saved);
    }

    public List<PaymentResponse> listPayments(Long societyId) {
        return paymentRepository.findBySocietyId(societyId).stream().map(this::toResponse).toList();
    }

    public PageResponse<PaymentResponse> listPayments(Long societyId, Pageable pageable) {
        return PageResponse.of(paymentRepository.findBySocietyId(societyId, pageable).map(this::toResponse));
    }

    private PaymentResponse toResponse(Payment payment) {
        return new PaymentResponse(
                payment.getId(),
                payment.getPlan(),
                payment.getAmount(),
                payment.getPaymentDate(),
                payment.getNextDueDate()
        );
    }
}
