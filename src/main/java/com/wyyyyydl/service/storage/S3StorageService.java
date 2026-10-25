package com.wyyyyydl.service.storage;

import com.wyyyyydl.service.storage.IStorageService;
import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;

/**
 * 云原生 AWS S3 对象存储与 CloudFront CDN 加速服务实现
 */
@Service("s3StorageService")
@ConditionalOnExpression("T(org.apache.commons.lang3.StringUtils).isNotBlank('${aws.s3.bucket:${S3_BUCKET_NAME:}}')")
@Slf4j
public class S3StorageService implements IStorageService {

    @Value("${aws.s3.bucket:${S3_BUCKET_NAME:}}")
    private String bucketName;

    @Value("${aws.cloudfront.domain:${CLOUDFRONT_DOMAIN:}}")
    private String cloudFrontDomain;

    @Value("${aws.region:${AWS_REGION:us-east-1}}")
    private String awsRegion;

    private S3Client s3Client;
    private boolean s3Enabled = false;

    @PostConstruct
    public void init() {
        if (StringUtils.isNotBlank(bucketName)) {
            try {
                this.s3Client = S3Client.builder()
                        .region(Region.of(awsRegion))
                        .build();
                this.s3Enabled = true;
                log.info("☁️ [AWS S3] 云存储模式已启用! S3 Bucket: {}, CloudFront: {}, Region: {}",
                        bucketName, cloudFrontDomain, awsRegion);
            } catch (Exception e) {
                log.warn("⚠️ [AWS S3] 初始化 S3 客户端失败，将回退至本地存储模式: {}", e.getMessage());
                this.s3Enabled = false;
            }
        } else {
            log.info("📦 [Storage] 未配置 S3 Bucket，当前运行于本地单机文件存储模式。");
        }
    }

    @Override
    public boolean isCloudStorage() {
        return s3Enabled;
    }

    @Override
    public String uploadFile(String key, File file, String contentType) {
        if (!s3Enabled || file == null || !file.exists()) {
            return null;
        }
        String cleanKey = sanitizeKey(key);
        try {
            PutObjectRequest request = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(cleanKey)
                    .contentType(resolveContentType(cleanKey, contentType))
                    .build();

            s3Client.putObject(request, RequestBody.fromFile(file));
            log.info("☁️ [AWS S3] 成功上传音频至 S3: s3://{}/{}", bucketName, cleanKey);
            return cleanKey;
        } catch (Exception e) {
            log.error("❌ [AWS S3] 上传文件失败, key={}", cleanKey, e);
            throw new RuntimeException("Upload to S3 failed: " + e.getMessage(), e);
        }
    }

    @Override
    public String uploadStream(String key, InputStream is, long length, String contentType) {
        if (!s3Enabled || is == null) {
            return null;
        }
        String cleanKey = sanitizeKey(key);
        try {
            PutObjectRequest request = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(cleanKey)
                    .contentType(resolveContentType(cleanKey, contentType))
                    .build();

            s3Client.putObject(request, RequestBody.fromInputStream(is, length));
            log.info("☁️ [AWS S3] 成功上传流至 S3: s3://{}/{}", bucketName, cleanKey);
            return cleanKey;
        } catch (Exception e) {
            log.error("❌ [AWS S3] 上传流到 S3 失败, key={}", cleanKey, e);
            throw new RuntimeException("Upload stream to S3 failed: " + e.getMessage(), e);
        }
    }

    @Override
    public String getAccessUrl(String key) {
        if (StringUtils.isBlank(key)) {
            return null;
        }
        String cleanKey = sanitizeKey(key);

        // 如果配置了 CloudFront 域名，优先返回 CDN 加速地址
        if (StringUtils.isNotBlank(cloudFrontDomain)) {
            String domain = cloudFrontDomain.trim();
            if (!domain.startsWith("http://") && !domain.startsWith("https://")) {
                domain = "https://" + domain;
            }
            if (domain.endsWith("/")) {
                domain = domain.substring(0, domain.length() - 1);
            }
            // cleanKey 已含 media/ 前缀，对各段路径进行 URL 编码保证中文与特殊符号安全
            return domain + "/" + encodeUriPath(cleanKey);
        }

        // 若无 CloudFront 域名且开启了 S3，则返回直连 S3 HTTPS 链接
        if (s3Enabled) {
            return String.format("https://%s.s3.%s.amazonaws.com/%s", bucketName, awsRegion, encodeUriPath(cleanKey));
        }

        return null;
    }

    @Override
    public String resolveOnlineStreamUrl(Long songId, String rawUrl, String playlistName, String albumName, String songName, Boolean isTrial) {
        // 云原生架构：直连网易云原生 CDN 直链播放 (自带 CORS 与 Range，避免 Lambda 6MB payload 限制)
        return rawUrl;
    }

    @Override
    public void serveMedia(String path, HttpServletRequest request, HttpServletResponse response) throws IOException {
        String accessUrl = getAccessUrl(path);
        if (StringUtils.isNotBlank(accessUrl)) {
            response.sendRedirect(accessUrl);
        } else {
            response.setStatus(HttpServletResponse.SC_NOT_FOUND);
        }
    }

    @Override
    public void serveOnlineStream(Long songId, String rawUrl, HttpServletRequest request, HttpServletResponse response) throws IOException {
        if (StringUtils.isNotBlank(rawUrl)) {
            response.sendRedirect(rawUrl);
        } else {
            response.setStatus(HttpServletResponse.SC_NOT_FOUND);
        }
    }

    @Override
    public boolean checkFileExists(File localFile, String status) {
        return "SUCCESS".equalsIgnoreCase(status);
    }

    @Override
    public boolean deleteFile(String key) {
        if (!s3Enabled || StringUtils.isBlank(key)) {
            return false;
        }
        String cleanKey = sanitizeKey(key);
        try {
            DeleteObjectRequest request = DeleteObjectRequest.builder()
                    .bucket(bucketName)
                    .key(cleanKey)
                    .build();
            s3Client.deleteObject(request);
            log.info("☁️ [AWS S3] 已从 S3 删除对象: s3://{}/{}", bucketName, cleanKey);
            return true;
        } catch (Exception e) {
            log.error("❌ [AWS S3] 删除 S3 对象失败, key={}", cleanKey, e);
            return false;
        }
    }

    private String sanitizeKey(String key) {
        String k = key.trim();
        while (k.startsWith("/")) {
            k = k.substring(1);
        }
        // 统一媒体文件归集到 media/ 目录下，精准对齐 CloudFront /media/* 路由规则
        if (!k.startsWith("media/") && !k.startsWith("deployments/") && !k.startsWith("svelte/")) {
            k = "media/" + k;
        }
        return k;
    }

    private String encodeUriPath(String path) {
        if (StringUtils.isBlank(path)) return "";
        String[] segments = path.split("/");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < segments.length; i++) {
            if (i > 0) sb.append("/");
            try {
                sb.append(java.net.URLEncoder.encode(segments[i], "UTF-8").replace("+", "%20"));
            } catch (Exception e) {
                sb.append(segments[i]);
            }
        }
        return sb.toString();
    }

    private String resolveContentType(String key, String fallback) {
        if (StringUtils.isNotBlank(fallback)) {
            return fallback;
        }
        String lower = key.toLowerCase();
        if (lower.endsWith(".mp3")) return "audio/mpeg";
        if (lower.endsWith(".flac")) return "audio/flac";
        if (lower.endsWith(".m4a")) return "audio/mp4";
        if (lower.endsWith(".wav")) return "audio/wav";
        if (lower.endsWith(".lrc") || lower.endsWith(".txt")) return "text/plain; charset=UTF-8";
        return "application/octet-stream";
    }
}
