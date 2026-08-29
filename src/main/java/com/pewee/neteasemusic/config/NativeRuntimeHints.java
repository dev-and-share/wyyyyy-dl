package com.pewee.neteasemusic.config;

import java.util.Arrays;
import java.util.List;

import org.springframework.aot.hint.MemberCategory;
import org.springframework.aot.hint.RuntimeHints;
import org.springframework.aot.hint.RuntimeHintsRegistrar;

public class NativeRuntimeHints implements RuntimeHintsRegistrar {

    @Override
    public void registerHints(RuntimeHints hints, ClassLoader classLoader) {
        // 注册所有 DTO、模型类与 FastJSON / Jackson 序列化反射支持
        List<Class<?>> reflectionClasses = Arrays.asList(
            com.pewee.neteasemusic.models.common.RespEntity.class,
            com.pewee.neteasemusic.models.common.AttachmentInfo.class,
            com.pewee.neteasemusic.models.common.DownloadTaskStatus.class,
            com.pewee.neteasemusic.models.dtos.AlbumAnalysisRespDTO.class,
            com.pewee.neteasemusic.models.dtos.AlbumDTO.class,
            com.pewee.neteasemusic.models.dtos.AlbumInfoDTO.class,
            com.pewee.neteasemusic.models.dtos.ArtistDTO.class,
            com.pewee.neteasemusic.models.dtos.PlaylistAnalysisRespDTO.class,
            com.pewee.neteasemusic.models.dtos.PlaylistDTO.class,
            com.pewee.neteasemusic.models.dtos.PlaylistInfoDTO.class,
            com.pewee.neteasemusic.models.dtos.SingleMusicAnalysisRespDTO.class,
            com.pewee.neteasemusic.models.dtos.TrackDTO.class,
            com.pewee.neteasemusic.models.dtos.UserPlaylistListRespDTO.class,
            com.pewee.neteasemusic.models.dtos.UserPlaylistSummaryDTO.class,
            com.pewee.neteasemusic.dao.DownloadHistoryDAO.DownloadHistoryItem.class,
            com.pewee.neteasemusic.dao.DownloadHistoryDAO.FolderCheckDTO.class,
            com.pewee.neteasemusic.utils.TagUtils.TagInfo.class
        );

        for (Class<?> clazz : reflectionClasses) {
            hints.reflection().registerType(clazz, MemberCategory.values());
        }

        // SQLite JDBC 驱动注册
        try {
            Class<?> sqliteJdbc = Class.forName("org.sqlite.JDBC");
            hints.reflection().registerType(sqliteJdbc, MemberCategory.values());
        } catch (ClassNotFoundException ignored) {
        }

        // 注册资源文件匹配模式
        hints.resources().registerPattern("templates/*");
        hints.resources().registerPattern("templates/**");
        hints.resources().registerPattern("static/*");
        hints.resources().registerPattern("static/**");
        hints.resources().registerPattern("application.properties");
        hints.resources().registerPattern("org/sqlite/*");
        hints.resources().registerPattern("org/sqlite/**");
    }
}
