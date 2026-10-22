package com.veenagroup.central.dashboard.security;

import com.veenagroup.central.dashboard.entity.Society;
import com.veenagroup.central.dashboard.entity.Users;
import com.veenagroup.central.dashboard.entity.enums.LoginType;
import com.veenagroup.central.dashboard.entity.enums.Role;
import com.veenagroup.central.dashboard.repository.SocietyRepository;
import com.veenagroup.central.dashboard.repository.UsersRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LoginIdentityServiceTest {

    @Mock
    private UsersRepository usersRepository;
    @Mock
    private SocietyRepository societyRepository;

    private LoginIdentityService service;

    private Society emailSociety;
    private Society mobileSociety;

    @BeforeEach
    void setUp() {
        service = new LoginIdentityService(usersRepository, societyRepository);
        emailSociety = Society.builder().id(1L).name("E").domain("e.test").loginType(LoginType.EMAIL).build();
        mobileSociety = Society.builder().id(2L).name("M").domain("m.test").loginType(LoginType.MOBILE).build();
    }

    private Users user(long id, Society society, String email, String phone) {
        return Users.builder().id(id).society(society).name("U" + id).email(email).phone(phone)
                .role(society == null ? Role.SUPER_ADMIN : Role.MEMBER).passwordHash("x").build();
    }

    @Test
    void emailLoginWorksInEmailSociety() {
        when(usersRepository.findByEmail("a@e.test")).thenReturn(Optional.of(user(10, emailSociety, "a@e.test", null)));
        assertEquals(Optional.of(10L), service.resolveUserId(" a@e.test ", emailSociety));
    }

    @Test
    void mobileLoginIsRejectedInEmailSociety() {
        when(usersRepository.findAllBySocietyIdAndPhone(1L, "9876543210"))
                .thenReturn(List.of(user(10, emailSociety, "a@e.test", "9876543210")));
        assertTrue(service.resolveUserId("9876543210", emailSociety).isEmpty());
    }

    @Test
    void mobileLoginWorksInMobileSocietyAndIgnoresSpaces() {
        when(usersRepository.findAllBySocietyIdAndPhone(2L, "9876543210"))
                .thenReturn(List.of(user(20, mobileSociety, null, "9876543210")));
        assertEquals(Optional.of(20L), service.resolveUserId("98765 43210", mobileSociety));
    }

    @Test
    void emailLoginIsRejectedForMemberOfMobileSociety() {
        when(usersRepository.findByEmail("b@m.test")).thenReturn(Optional.of(user(20, mobileSociety, "b@m.test", "9876543210")));
        assertTrue(service.resolveUserId("b@m.test", mobileSociety).isEmpty());
    }

    @Test
    void superAdminCanAlwaysUseEmail() {
        when(usersRepository.findByEmail("root@x.test")).thenReturn(Optional.of(user(1, null, "root@x.test", null)));
        assertEquals(Optional.of(1L), service.resolveUserId("root@x.test", null));
        assertEquals(Optional.of(1L), service.resolveUserId("root@x.test", mobileSociety));
    }

    @Test
    void ambiguousMobileIsRefused() {
        when(usersRepository.findAllBySocietyIdAndPhone(2L, "9876543210"))
                .thenReturn(List.of(user(20, mobileSociety, null, "9876543210"), user(21, mobileSociety, null, "9876543210")));
        assertTrue(service.resolveUserId("9876543210", mobileSociety).isEmpty());
    }

    @Test
    void blankIdentifierFindsNothing() {
        assertTrue(service.resolveUserId("  ", mobileSociety).isEmpty());
        assertTrue(service.resolveUserId(null, null).isEmpty());
    }
}
