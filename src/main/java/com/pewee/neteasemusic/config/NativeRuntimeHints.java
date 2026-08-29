package com.pewee.neteasemusic.config;

import org.springframework.aot.hint.MemberCategory;
import org.springframework.aot.hint.RuntimeHints;
import org.springframework.aot.hint.RuntimeHintsRegistrar;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.util.ClassUtils;

/**
 * GraalVM Native Image 自动 AOT 反射与资源注册器
 * 自动扫描 models/enums 及 DAO/Utils 内部类，开发者无需手动维护清单
 */
public class NativeRuntimeHints implements RuntimeHintsRegistrar {

    @Override
    public void registerHints(RuntimeHints hints, ClassLoader classLoader) {
        if (classLoader == null) {
            classLoader = getClass().getClassLoader();
        }

        // 1. 自动全量扫描 models 与 enums 包及其所有子包下的全部实体/DTO类
        ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter((metadataReader, metadataReaderFactory) -> true);

        String[] scanPackages = {
            "com.pewee.neteasemusic.models",
            "com.pewee.neteasemusic.enums"
        };

        for (String basePackage : scanPackages) {
            for (BeanDefinition bd : scanner.findCandidateComponents(basePackage)) {
                try {
                    Class<?> clazz = ClassUtils.forName(bd.getBeanClassName(), classLoader);
                    registerClassAndInners(hints, clazz);
                } catch (Throwable ignored) {
                }
            }
        }

        // 2. 自动注册 DAO 与 Utils 下声明的所有静态内部类（如 DownloadHistoryItem, FolderCheckDTO, TagInfo 等）
        String[] helperClasses = {
            "com.pewee.neteasemusic.dao.DownloadHistoryDAO",
            "com.pewee.neteasemusic.utils.TagUtils"
        };
        for (String className : helperClasses) {
            try {
                Class<?> parent = ClassUtils.forName(className, classLoader);
                for (Class<?> inner : parent.getDeclaredClasses()) {
                    registerClassAndInners(hints, inner);
                }
            } catch (Throwable ignored) {
            }
        }

        // 3. SQLite JDBC 驱动注册
        try {
            Class<?> sqliteJdbc = ClassUtils.forName("org.sqlite.JDBC", classLoader);
            hints.reflection().registerType(sqliteJdbc, MemberCategory.values());
        } catch (Throwable ignored) {
        }

        // 4. 注册资源文件匹配模式
        hints.resources().registerPattern("templates/*");
        hints.resources().registerPattern("templates/**");
        hints.resources().registerPattern("static/*");
        hints.resources().registerPattern("static/**");
        hints.resources().registerPattern("application.properties");
        hints.resources().registerPattern("org/sqlite/*");
        hints.resources().registerPattern("org/sqlite/**");
    }

    private void registerClassAndInners(RuntimeHints hints, Class<?> clazz) {
        if (clazz == null) return;
        hints.reflection().registerType(clazz, MemberCategory.values());
        for (Class<?> inner : clazz.getDeclaredClasses()) {
            hints.reflection().registerType(inner, MemberCategory.values());
        }
    }
}
