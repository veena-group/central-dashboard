package com.veenagroup.central.dashboard.security;

import com.veenagroup.central.dashboard.entity.Society;
import com.veenagroup.central.dashboard.entity.Users;
import com.veenagroup.central.dashboard.entity.enums.LoginType;
import com.veenagroup.central.dashboard.repository.SocietyRepository;
import com.veenagroup.central.dashboard.repository.UsersRepository;
import com.veenagroup.central.dashboard.util.ContactNormalizer;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * Turns whatever a person typed into the login box (email or mobile number) into a user id, applying
 * the society's login-type rule: a society that signs in by mobile rejects email logins and vice
 * versa. Super admin has no society and always signs in by email.
 *
 * Deliberately returns "not found" for every kind of mismatch (unknown identifier, wrong login type,
 * ambiguous mobile) so a caller can't tell them apart - they all surface as "Invalid credentials".
 */
@Service
public class LoginIdentityService {

    private final UsersRepository usersRepository;
    private final SocietyRepository societyRepository;

    public LoginIdentityService(UsersRepository usersRepository, SocietyRepository societyRepository) {
        this.usersRepository = usersRepository;
        this.societyRepository = societyRepository;
    }

    /**
     * Not the cached PublicContentService.resolveSociety: a cached Society would keep serving the
     * old login type for up to its TTL after a super admin changes it.
     */
    @Transactional(readOnly = true)
    public Optional<Society> findSocietyByDomain(String domain) {
        if (domain == null || domain.isBlank()) {
            return Optional.empty();
        }
        return societyRepository.findByDomain(domain.trim());
    }

    /**
     * @param society the society whose site the request came from, or null when it came from the
     *                central dashboard (super admin) or the domain couldn't be determined.
     */
    @Transactional(readOnly = true)
    public Optional<Long> resolveUserId(String identifier, Society society) {
        if (identifier == null || identifier.isBlank()) {
            return Optional.empty();
        }

        LoginType usedType = identifier.contains("@") ? LoginType.EMAIL : LoginType.MOBILE;
        Optional<Users> found = usedType == LoginType.EMAIL
                ? usersRepository.findByEmail(identifier.trim())
                : findByMobile(identifier, society);

        return found.filter(user -> isAllowedToUse(user, usedType)).map(Users::getId);
    }

    private Optional<Users> findByMobile(String identifier, Society society) {
        String mobile = ContactNormalizer.mobile(identifier);
        if (mobile == null) {
            return Optional.empty();
        }
        // Mobile numbers are only unique within a society, so scope by it whenever it is known.
        List<Users> matches = society != null
                ? usersRepository.findAllBySocietyIdAndPhone(society.getId(), mobile)
                : usersRepository.findAllByPhone(mobile);
        // Legacy data may hold the same number twice; signing in as "whichever came first" would be worse than refusing.
        return matches.size() == 1 ? Optional.of(matches.get(0)) : Optional.empty();
    }

    private boolean isAllowedToUse(Users user, LoginType usedType) {
        if (user.getSociety() == null) {
            return usedType == LoginType.EMAIL;
        }
        return user.getSociety().getLoginType() == usedType;
    }
}
