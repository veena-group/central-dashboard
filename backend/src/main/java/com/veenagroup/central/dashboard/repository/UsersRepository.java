package com.veenagroup.central.dashboard.repository;

import com.veenagroup.central.dashboard.entity.Users;
import com.veenagroup.central.dashboard.entity.enums.Role;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface UsersRepository extends JpaRepository<Users, Long>, JpaSpecificationExecutor<Users> {

    Optional<Users> findByEmail(String email);

    @Query("SELECT LOWER(u.email) FROM Users u WHERE LOWER(u.email) IN :emails")
    List<String> findEmailsIgnoreCaseIn(@Param("emails") Collection<String> emails);

    /**
     * Locks the row for the duration of the caller's transaction, so two concurrent failed-login
     * requests for the same account can't both read the same pre-increment attempt count and both
     * write back count+1, silently losing one of the increments (see LoginAttemptService).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT u FROM Users u WHERE u.email = :email")
    Optional<Users> findByEmailForUpdate(@Param("email") String email);

    List<Users> findBySocietyId(Long societyId);

    List<Users> findBySocietyIdAndRole(Long societyId, Role role);

    Page<Users> findBySocietyId(Long societyId, Pageable pageable);

    Page<Users> findBySocietyIdAndIdNot(Long societyId, Long excludedUserId, Pageable pageable);

    long countBySocietyId(Long societyId);

    long countBySocietyIdAndRole(Long societyId, Role role);
}
