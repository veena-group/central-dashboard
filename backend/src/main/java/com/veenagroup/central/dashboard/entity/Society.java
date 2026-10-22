package com.veenagroup.central.dashboard.entity;

import com.veenagroup.central.dashboard.entity.enums.LoginType;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "societies")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Society {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true)
    private String domain;

    @Column(name = "logo_url")
    private String logoUrl;

    @Column(name = "primary_color")
    private String primaryColor;

    @Column(name = "secondary_color")
    private String secondaryColor;

    /**
     * The SQL-level DEFAULT (ColumnDefault) lets Hibernate's schema update add this
     * NOT NULL column to the existing, already-populated `societies` table (a plain "ADD COLUMN ... NOT
     * NULL" with no default fails against a non-empty table in Postgres). Existing societies keep
     * signing in with email.
     */
    @Builder.Default
    @Enumerated(EnumType.STRING)
    @ColumnDefault("'EMAIL'")
    @Column(name = "login_type", nullable = false, length = 20)
    private LoginType loginType = LoginType.EMAIL;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
