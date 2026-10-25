package com.wyyyyydl.config;

import org.springframework.beans.BeansException;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.FrameworkServlet;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Web MVC 配置：
 * 1. 注册 Svelte 前端静态资源映射
 * 2. 规避 aws-serverless-java-container 在 FrameworkServlet.publishRequestHandledEvent 时的 NPE 问题
 */
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/svelte/**")
                .addResourceLocations("classpath:/static/svelte/");
        registry.addResourceHandler("/**")
                .addResourceLocations("classpath:/static/");
    }

    /**
     * 禁用 FrameworkServlet 每次请求结束后的事件发布。
     * 在 AWS Serverless 环境下，调用 request.getUserPrincipal() 会触发
     * ApiGatewayRequestIdentity 的空指针异常，关闭此事件可完全消除该问题且提升性能。
     */
    @Bean
    public BeanPostProcessor disableFrameworkServletEvents() {
        return new BeanPostProcessor() {
            @Override
            public Object postProcessAfterInitialization(Object bean, String beanName) throws BeansException {
                if (bean instanceof FrameworkServlet) {
                    ((FrameworkServlet) bean).setPublishEvents(false);
                }
                return bean;
            }
        };
    }
}
