package com.wyy.service;

import java.util.Arrays;
import java.util.Collections;
import java.util.Set;
import java.util.stream.Collectors;

import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;

/**
 * 🔐 基于外部身份网关 (Cloudflare Access 等) 的轻量用户上下文与权限服务
 * 
 * 核心设计：
 * 1. 零数据库用户表负担，一切由 ADMIN_EMAILS 配置决定。
 * 2. 渐进式启动：若未配置 ADMIN_EMAILS，authEnabled=false，系统全量开放，所有人均为管理员。
 * 3. 若配置了 ADMIN_EMAILS，自动激活访客隔离模式：识别 Cf-Access-Authenticated-User-Email 头。
 */
@Slf4j
@Service
public class AuthContextService {

    public static final String CF_AUTH_EMAIL_HEADER = "Cf-Access-Authenticated-User-Email";

    private final Set<String> adminEmails;
    private final boolean authEnabled;
    private final String mockEmail;
    private final String fallbackAdminEmail;

    public AuthContextService(
            @Value("${app.security.admin-emails:${CF_ADMIN_EMAILS:${ADMIN_EMAILS:}}}") String adminEmailsConfig,
            @Value("${app.security.mock-email:${CF_MOCK_USER_EMAIL:${MOCK_USER_EMAIL:}}}") String mockEmailConfig) {
        if (StringUtils.isNotBlank(adminEmailsConfig)) {
            this.adminEmails = Arrays.stream(adminEmailsConfig.split("[,;]"))
                    .map(String::trim)
                    .filter(StringUtils::isNotBlank)
                    .map(String::toLowerCase)
                    .collect(Collectors.toSet());
            this.authEnabled = !this.adminEmails.isEmpty();
            this.fallbackAdminEmail = this.adminEmails.isEmpty() ? null : this.adminEmails.iterator().next();
        } else {
            this.adminEmails = Collections.emptySet();
            this.authEnabled = false;
            this.fallbackAdminEmail = null;
        }
        this.mockEmail = StringUtils.isNotBlank(mockEmailConfig) ? mockEmailConfig.trim().toLowerCase() : null;
        log.info("🔐 [AuthContextService] 多租户权限系统启动完成 -> authEnabled={}, adminCount={}, mockEmail={}, fallbackAdminEmail={}",
                this.authEnabled, this.adminEmails.size(), this.mockEmail, this.fallbackAdminEmail);
    }

    public boolean isAuthEnabled() {
        return authEnabled;
    }

    public String getCurrentUserEmail() {
        if (!authEnabled) {
            return StringUtils.isNotBlank(mockEmail) ? mockEmail : "default_admin";
        }
        try {
            ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attrs != null) {
                HttpServletRequest request = attrs.getRequest();
                String cfEmail = request.getHeader(CF_AUTH_EMAIL_HEADER);
                if (StringUtils.isNotBlank(cfEmail)) {
                    return cfEmail.trim().toLowerCase();
                }
            }
        } catch (Exception ignored) {
        }
        // 本地或直连请求无 CF 请求头时：优先使用 mockEmail，其次回退到第一个管理员邮箱（便于本地调试）
        return StringUtils.isNotBlank(mockEmail) ? mockEmail : fallbackAdminEmail;
    }

    public boolean isAdmin() {
        if (!authEnabled) {
            return true; // 未配置 ADMIN_EMAILS 时，全员为管理员
        }
        String email = getCurrentUserEmail();
        if (StringUtils.isBlank(email)) {
            return false;
        }
        return adminEmails.contains(email.toLowerCase());
    }

    public String getCurrentRole() {
        return isAdmin() ? "admin" : "user";
    }
}
