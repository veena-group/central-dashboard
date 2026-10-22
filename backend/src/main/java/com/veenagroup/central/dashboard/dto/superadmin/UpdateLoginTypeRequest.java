package com.veenagroup.central.dashboard.dto.superadmin;

import com.veenagroup.central.dashboard.entity.enums.LoginType;
import jakarta.validation.constraints.NotNull;

public record UpdateLoginTypeRequest(@NotNull LoginType loginType) {
}
