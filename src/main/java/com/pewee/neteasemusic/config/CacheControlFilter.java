package com.pewee.neteasemusic.config;

import java.io.IOException;

import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * 静态资源防缓存过滤器：
 * 针对 sw.js、manifest.json、index.html 及主路由，强制注入 no-cache / no-store / must-revalidate，
 * 防止 Cloudflare CDN 及移动端 Safari 缓存旧版本 Service Worker 或入口 HTML。
 */
@Component
public class CacheControlFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String uri = request.getRequestURI();
        if (uri.endsWith("/sw.js") || uri.endsWith("/manifest.json") || uri.endsWith(".html") || "/".equals(uri)) {
            response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
            response.setHeader("Pragma", "no-cache");
            response.setDateHeader("Expires", 0);
        }
        filterChain.doFilter(request, response);
    }
}
