package com.veenagroup.central.dashboard.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.TimeUnit;

/**
 * Two hot, rarely-changing lookups get cached here: resolving a society by its public domain, and
 * checking whether a feature is enabled for display purposes. Both are hit on essentially every
 * request to the unauthenticated public site (PublicController), which previously meant a fresh DB
 * round trip per visitor per request for data that changes maybe a few times a year per society.
 *
 * Deliberately NOT used for FeatureLimitService.assertCanCreate's limit check - that one relies on
 * a pessimistic DB lock for correctness (see FeatureLimitService), and caching it would silently
 * reintroduce the exact race condition that lock exists to close.
 */
@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    public CaffeineCacheManager cacheManager() {
        CaffeineCacheManager manager = new CaffeineCacheManager("societyByDomain", "societyFeatureEnabled");
        manager.setCaffeine(Caffeine.newBuilder()
                .expireAfterWrite(5, TimeUnit.MINUTES)
                .maximumSize(1000));
        return manager;
    }
}
