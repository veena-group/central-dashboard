package com.veenagroup.central.dashboard.entity;

import com.veenagroup.central.dashboard.entity.enums.FeatureKey;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "society_features", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"society_id", "feature_key"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SocietyFeature {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "society_id", nullable = false)
    private Society society;

    @Enumerated(EnumType.STRING)
    @Column(name = "feature_key", nullable = false)
    private FeatureKey featureKey;

    @Column(nullable = false)
    private boolean enabled;

    @Column(name = "feature_limit", nullable = false)
    private Integer limit;
}
