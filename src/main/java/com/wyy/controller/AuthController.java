package com.wyy.controller;

import java.util.HashMap;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.wyy.enums.CommonRespInfo;
import com.wyy.models.common.RespEntity;
import com.wyy.service.AuthContextService;

import jakarta.annotation.Resource;

/**
 * 🔐 用户身份与权限状态控制器 (基于 Cloudflare Access 邮箱)
 */
@RestController
@RequestMapping("/v3/user")
public class AuthController {

    @Resource
    private AuthContextService authContextService;

    @GetMapping({"/profile", "/auth-status"})
    public RespEntity<Map<String, Object>> getUserProfile() {
        Map<String, Object> data = new HashMap<>();
        data.put("authEnabled", authContextService.isAuthEnabled());
        data.put("email", authContextService.getCurrentUserEmail());
        data.put("role", authContextService.getCurrentRole());
        data.put("isAdmin", authContextService.isAdmin());
        return RespEntity.apply(CommonRespInfo.SUCCESS, data);
    }
}
