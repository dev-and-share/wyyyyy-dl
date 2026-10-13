package com.wyyyyydl.service.storage;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * 统一对象/文件存储抽象服务契约 (IoC 存储中立层)
 * 封装本地物理磁盘与云端对象存储 (AWS S3) 的一切介质差异，上层业务层零 if/else 适配。
 */
public interface IStorageService {

    /**
     * 是否为云原生存储模式 (如 AWS S3)
     */
    boolean isCloudStorage();

    /**
     * 上传/归档本地文件到存储介质
     * @param key 存储对象键/相对路径
     * @param file 本地物理文件
     * @param contentType MIME 类型
     * @return 存储后的物理路径或云端 Key
     */
    String uploadFile(String key, File file, String contentType);

    /**
     * 上传数据流到存储介质
     */
    String uploadStream(String key, InputStream is, long length, String contentType);

    /**
     * 获取文件访问/播放地址 (本地相对流地址或 CloudFront CDN 直链)
     */
    String getAccessUrl(String key);

    /**
     * 解析未下载的在线试听/播放地址
     * 本地单机模式下返回带 Range 分片支持的代理流地址，云原生模式下直接返回原音源直链 (跳过 Lambda 网关)
     */
    String resolveOnlineStreamUrl(Long songId, String rawUrl, String playlistName, String albumName, String songName, Boolean isTrial);

    default String resolveOnlineStreamUrl(Long songId, String rawUrl, String playlistName) {
        return resolveOnlineStreamUrl(songId, rawUrl, playlistName, null, null, false);
    }

    /**
     * 提供已下载/已归档媒体文件的流传输或重定向播放
     */
    void serveMedia(String path, HttpServletRequest request, HttpServletResponse response) throws IOException;

    /**
     * 提供在线流媒体传输或重定向播放
     */
    void serveOnlineStream(Long songId, String rawUrl, HttpServletRequest request, HttpServletResponse response) throws IOException;

    /**
     * 校验文件是否存在 (支持本地物理存在与云端 SUCCESS 状态多态判断)
     */
    boolean checkFileExists(File localFile, String status);

    /**
     * 删除文件
     */
    boolean deleteFile(String key);

    /**
     * 向后兼容历史调用的别名方法
     */
    default boolean isS3Enabled() {
        return isCloudStorage();
    }
}
