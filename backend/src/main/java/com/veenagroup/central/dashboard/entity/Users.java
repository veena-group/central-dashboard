package com.veenagroup.central.dashboard.entity;

import com.veenagroup.central.dashboard.entity.enums.Role;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Users {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "society_id")
    private Society society;

    @Column(nullable = false)
    private String name;

    private String flat;

    private String wing;

    @Column(nullable = false, unique = true)
    private String email;

    private String phone;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(name = "photo_url")
    private String photoUrl;

    /**
     * columnDefinition provides a SQL-level DEFAULT so Hibernate's schema update can add this NOT
     * NULL column to the existing, already-populated `users` table (a plain "ADD COLUMN ... NOT
     * NULL" with no default fails against a non-empty table in Postgres).
     */
    @Builder.Default
    @Column(name = "failed_login_attempts", nullable = false, columnDefinition = "integer default 0")
    private int failedLoginAttempts = 0;

    @Column(name = "locked_until")
    private LocalDateTime lockedUntil;

    /**
     * Bumped on logout (and can be bumped for a future "log out of all devices" action) to
     * invalidate every access/refresh token issued before the bump, since JWTs are otherwise
     * stateless and can't be revoked individually.
     */
    @Builder.Default
    @Column(name = "token_version", nullable = false, columnDefinition = "integer default 0")
    private int tokenVersion = 0;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
