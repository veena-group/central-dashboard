package com.veenagroup.central.dashboard.service;

import com.veenagroup.central.dashboard.dto.admin.CreateMemberRequest;
import com.veenagroup.central.dashboard.dto.admin.MemberResponse;
import com.veenagroup.central.dashboard.dto.admin.UpdateMemberRequest;
import com.veenagroup.central.dashboard.entity.Society;
import com.veenagroup.central.dashboard.entity.Users;
import com.veenagroup.central.dashboard.entity.enums.FeatureKey;
import com.veenagroup.central.dashboard.entity.enums.Role;
import com.veenagroup.central.dashboard.exception.BusinessException;
import com.veenagroup.central.dashboard.repository.SocietyRepository;
import com.veenagroup.central.dashboard.repository.UsersRepository;
import com.veenagroup.central.dashboard.storage.FileStorageService;
import com.veenagroup.central.dashboard.web.PageResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Slf4j
@Service
public class MemberService {

    private final UsersRepository usersRepository;
    private final SocietyRepository societyRepository;
    private final PasswordEncoder passwordEncoder;
    private final FeatureLimitService featureLimitService;
    private final FileStorageService fileStorageService;

    public MemberService(UsersRepository usersRepository,
                          SocietyRepository societyRepository,
                          PasswordEncoder passwordEncoder,
                          FeatureLimitService featureLimitService,
                          FileStorageService fileStorageService) {
        this.usersRepository = usersRepository;
        this.societyRepository = societyRepository;
        this.passwordEncoder = passwordEncoder;
        this.featureLimitService = featureLimitService;
        this.fileStorageService = fileStorageService;
    }

    @Transactional
    public MemberResponse create(Long societyId, CreateMemberRequest request) {
        if (request.role() == Role.SUPER_ADMIN) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "INVALID_ROLE_ASSIGNMENT", "Cannot create a Super Admin here");
        }
        Society society = societyRepository.findById(societyId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "SOCIETY_NOT_FOUND", "Society not found"));

        featureLimitService.assertCanCreate(societyId, FeatureKey.MEMBERS, () -> usersRepository.countBySocietyId(societyId));

        if (usersRepository.findByEmail(request.email()).isPresent()) {
            throw new BusinessException(HttpStatus.CONFLICT, "EMAIL_ALREADY_IN_USE", "Email already in use");
        }

        Users user = Users.builder()
                .society(society)
                .name(request.name())
                .flat(request.flat())
                .wing(request.wing())
                .email(request.email())
                .phone(request.phone())
                .role(request.role())
                .passwordHash(passwordEncoder.encode(request.password()))
                .build();

        Users saved = usersRepository.save(user);
        log.info("Created member {} for society {}", saved.getId(), societyId);
        return toResponse(saved);
    }

    public List<String> findExistingEmails(List<String> emails) {
        List<String> normalized = emails.stream()
                .filter(email -> email != null && !email.isBlank())
                .map(email -> email.trim().toLowerCase())
                .distinct()
                .toList();
        if (normalized.isEmpty()) {
            return List.of();
        }
        return usersRepository.findEmailsIgnoreCaseIn(normalized);
    }

    public List<MemberResponse> list(Long societyId) {
        return usersRepository.findBySocietyId(societyId).stream().map(this::toResponse).toList();
    }

    public PageResponse<MemberResponse> list(Long societyId, Long excludeUserId, Pageable pageable, String search, Role role) {
        featureLimitService.assertEnabled(societyId, FeatureKey.MEMBERS);
        Specification<Users> spec = buildSpecification(societyId, excludeUserId, search, role);
        return PageResponse.of(usersRepository.findAll(spec, pageable).map(this::toResponse));
    }

    private Specification<Users> buildSpecification(Long societyId, Long excludeUserId, String search, Role role) {
        Specification<Users> spec = (root, query, cb) -> cb.and(
                cb.equal(root.get("society").get("id"), societyId),
                cb.notEqual(root.get("id"), excludeUserId));

        if (search != null && !search.isBlank()) {
            String pattern = "%" + search.trim().toLowerCase() + "%";
            spec = spec.and((root, query, cb) -> cb.or(
                    cb.like(cb.lower(root.get("name")), pattern),
                    cb.like(cb.lower(cb.coalesce(root.<String>get("flat"), "")), pattern),
                    cb.like(cb.lower(cb.coalesce(root.<String>get("wing"), "")), pattern)));
        }
        if (role != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("role"), role));
        }
        return spec;
    }

    public MemberResponse getById(Long societyId, Long memberId) {
        return toResponse(findOwned(societyId, memberId));
    }

    @Transactional
    public MemberResponse update(Long societyId, Long memberId, UpdateMemberRequest request) {
        if (request.role() == Role.SUPER_ADMIN) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "INVALID_ROLE_ASSIGNMENT", "Cannot assign Super Admin role here");
        }
        Users user = findOwned(societyId, memberId);

        // Prevent leaving a society without any admin by demotion.
        if (user.getRole() == Role.SOCIETY_ADMIN && request.role() != Role.SOCIETY_ADMIN && isLastSocietyAdmin(societyId)) {
            throw new BusinessException(
                    HttpStatus.CONFLICT,
                    "LAST_ADMIN_PROTECTION",
                    "At least one society admin is required. Add another admin before changing this role."
            );
        }

        user.setName(request.name());
        user.setFlat(request.flat());
        user.setWing(request.wing());
        user.setPhone(request.phone());
        user.setRole(request.role());
        Users updated = usersRepository.save(user);
        log.info("Updated member {} for society {}", updated.getId(), societyId);
        return toResponse(updated);
    }

    @Transactional
    public MemberResponse uploadPhoto(Long societyId, Long memberId, MultipartFile file) {
        Users user = findOwned(societyId, memberId);
        String path = fileStorageService.store(file, societyId, "members");
        user.setPhotoUrl(path);
        Users updated = usersRepository.save(user);
        log.info("Uploaded photo for member {} in society {}", updated.getId(), societyId);
        return toResponse(updated);
    }

    @Transactional
    public void delete(Long societyId, Long memberId) {
        Users user = findOwned(societyId, memberId);

        // Prevent deleting the only admin for a society.
        if (user.getRole() == Role.SOCIETY_ADMIN && isLastSocietyAdmin(societyId)) {
            throw new BusinessException(
                    HttpStatus.CONFLICT,
                    "LAST_ADMIN_PROTECTION",
                    "At least one society admin is required. Add another admin before deleting this account."
            );
        }

        usersRepository.delete(user);
        log.info("Deleted member {} for society {}", memberId, societyId);
    }

    private boolean isLastSocietyAdmin(Long societyId) {
        return usersRepository.countBySocietyIdAndRole(societyId, Role.SOCIETY_ADMIN) <= 1;
    }

    private Users findOwned(Long societyId, Long memberId) {
        Users user = usersRepository.findById(memberId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "Member not found"));
        if (user.getSociety() == null || !user.getSociety().getId().equals(societyId)) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "Member not found");
        }
        return user;
    }

    private MemberResponse toResponse(Users user) {
        return new MemberResponse(
                user.getId(), user.getName(), user.getFlat(), user.getWing(), user.getEmail(),
                user.getPhone(), user.getRole().name(), user.getPhotoUrl(), user.getCreatedAt()
        );
    }
}
