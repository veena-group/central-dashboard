package com.veenagroup.central.dashboard.repository;

import com.veenagroup.central.dashboard.entity.Society;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SocietyRepository extends JpaRepository<Society, Long> {

    Optional<Society> findByDomain(String domain);
}
