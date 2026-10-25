package com.wyyyyydl.service.storage.impl;

import com.wyyyyydl.service.storage.IStorageService;
import com.wyyyyydl.utils.AudioStreamUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/**
 * 本地物理磁盘存储服务实现 (单机 Docker / 经典部署环境)
 */
@Service("localStorageService")
@ConditionalOnExpression("T(org.apache.commons.lang3.StringUtils).isBlank('${aws.s3.bucket:${S3_BUCKET_NAME:}}')")
@Slf4j
public class LocalStorageService implements IStorageService {

    @Value("${download.path:/media/music/}")
    private String downloadPath;

    @Override
    public boolean isCloudStorage() {
        return false;
    }

    @Override
    public String uploadFile(String key, File file, String contentType) {
        if (file == null || !file.exists()) {
            return null;
        }
        return file.getAbsolutePath();
    }

    @Override
    public String uploadStream(String key, InputStream is, long length, String contentType) {
        return key;
    }

    @Override
    public String getAccessUrl(String key) {
        if (StringUtils.isBlank(key)) return null;
        try {
            return "/v3/history/stream?path=" + URLEncoder.encode(key, StandardCharsets.UTF_8.name());
        } catch (Exception e) {
            return "/v3/history/stream?path=" + key;
        }
    }

    @Override
    public String resolveOnlineStreamUrl(Long songId, String rawUrl, String playlistName, String albumName, String songName, Boolean isTrial) {
        if (StringUtils.isBlank(rawUrl)) return null;
        StringBuilder sb = new StringBuilder("/v3/stream/online?id=").append(songId != null ? songId : 0);
        try {
            sb.append("&url=").append(URLEncoder.encode(rawUrl, StandardCharsets.UTF_8.name()));
        } catch (Exception e) {
            sb.append("&url=").append(rawUrl);
        }
        if (StringUtils.isNotBlank(playlistName)) {
            try {
                sb.append("&playlistName=").append(URLEncoder.encode(playlistName, StandardCharsets.UTF_8.name()));
            } catch (Exception ignored) {}
        }
        if (StringUtils.isNotBlank(albumName)) {
            try {
                sb.append("&albumName=").append(URLEncoder.encode(albumName, StandardCharsets.UTF_8.name()));
            } catch (Exception ignored) {}
        }
        if (StringUtils.isNotBlank(songName)) {
            try {
                sb.append("&name=").append(URLEncoder.encode(songName, StandardCharsets.UTF_8.name()));
            } catch (Exception ignored) {}
        }
        if (Boolean.TRUE.equals(isTrial)) {
            sb.append("&freeTrial=true");
        }
        return sb.toString();
    }

    @Override
    public void serveMedia(String path, HttpServletRequest request, HttpServletResponse response) throws IOException {
        if (StringUtils.isBlank(path)) {
            response.setStatus(HttpServletResponse.SC_NOT_FOUND);
            return;
        }
        File file = resolveLocalFile(path);
        if (!file.exists() || !file.isFile()) {
            response.setStatus(HttpServletResponse.SC_NOT_FOUND);
            return;
        }
        AudioStreamUtil.streamLocalFile(file, request, response);
    }

    @Override
    public void serveOnlineStream(Long songId, String rawUrl, HttpServletRequest request, HttpServletResponse response) throws IOException {
        AudioStreamUtil.streamOnlineUrl(rawUrl, request, response);
    }

    @Override
    public boolean checkFileExists(File localFile, String status) {
        return localFile != null && localFile.exists() && localFile.isFile() && localFile.length() > 0;
    }

    @Override
    public boolean deleteFile(String key) {
        if (StringUtils.isBlank(key)) return false;
        File file = resolveLocalFile(key);
        if (file.exists() && file.isFile()) {
            return file.delete();
        }
        return false;
    }

    private File resolveLocalFile(String path) {
        File file = new File(path);
        if (file.isAbsolute()) {
            return file;
        }
        return new File(downloadPath, path);
    }
}
