package com.wyy.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import com.wyy.service.AuthContextService;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AuthController.class)
@DisplayName("🔐 用户身份控制器 AuthController 单元测试")
public class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AuthContextService authContextService;

    @Test
    @DisplayName("测试 /v3/user/profile: 当未开启鉴权时所有人均为管理员")
    public void testAuthStatusDisabled() throws Exception {
        Mockito.when(authContextService.isAuthEnabled()).thenReturn(false);
        Mockito.when(authContextService.getCurrentUserEmail()).thenReturn("default_admin");
        Mockito.when(authContextService.getCurrentRole()).thenReturn("admin");
        Mockito.when(authContextService.isAdmin()).thenReturn(true);

        mockMvc.perform(get("/v3/user/profile"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("000000"))
                .andExpect(jsonPath("$.data.authEnabled").value(false))
                .andExpect(jsonPath("$.data.isAdmin").value(true))
                .andExpect(jsonPath("$.data.role").value("admin"));
    }

    @Test
    @DisplayName("测试 /v3/user/profile: 开启鉴权且为普通访客")
    public void testAuthStatusGuest() throws Exception {
        Mockito.when(authContextService.isAuthEnabled()).thenReturn(true);
        Mockito.when(authContextService.getCurrentUserEmail()).thenReturn("fxapache@gmail.com");
        Mockito.when(authContextService.getCurrentRole()).thenReturn("user");
        Mockito.when(authContextService.isAdmin()).thenReturn(false);

        mockMvc.perform(get("/v3/user/profile"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("000000"))
                .andExpect(jsonPath("$.data.authEnabled").value(true))
                .andExpect(jsonPath("$.data.isAdmin").value(false))
                .andExpect(jsonPath("$.data.email").value("fxapache@gmail.com"))
                .andExpect(jsonPath("$.data.role").value("user"));
    }
}
