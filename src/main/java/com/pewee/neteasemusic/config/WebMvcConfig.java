package com.pewee.neteasemusic.config;

import java.util.concurrent.TimeUnit;

import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * 静态资源缓存控制策略配置：
 * 1. sw.js, manifest.json 与 index.html 强制 no-store/no-cache，严防 Cloudflare CDN 与手机 Safari 缓存旧版本；
 * 2. 带 content hash 的静态资源 (/svelte/assets/**) 开启 1 年公共强缓存。
 */
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/sw.js", "/manifest.json", "/svelte/manifest.json")
                .addResourceLocations("classpath:/static/")
                .setCacheControl(CacheControl.noCache().noStore().mustRevalidate());

        registry.addResourceHandler("/svelte/assets/**")
                .addResourceLocations("classpath:/static/svelte/assets/")
                .setCacheControl(CacheControl.maxAge(365, TimeUnit.DAYS).cachePublic().immutable());

        registry.addResourceHandler("/svelte/index.html")
                .addResourceLocations("classpath:/static/svelte/")
                .setCacheControl(CacheControl.noCache().noStore().mustRevalidate());
    }
}
