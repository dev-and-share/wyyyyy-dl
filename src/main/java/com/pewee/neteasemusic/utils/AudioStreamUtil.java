package com.pewee.neteasemusic.utils;

import java.io.File;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.RandomAccessFile;

import org.apache.commons.lang3.StringUtils;
import org.apache.http.Header;
import org.apache.http.HttpEntity;
import org.apache.http.client.config.RequestConfig;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpGet;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import lombok.extern.slf4j.Slf4j;

/**
 * 统一音频流输出工具类（DRY）。
 *
 * 三处流接口共用同一套 Range 分片 / CORS / Content-Type / 代理透传逻辑：
 * <ul>
 *   <li>{@code /v2/stream}          —— 本地文件按 songId/historyId 播放</li>
 *   <li>{@code /v2/history/stream}  —— 本地文件按 path 播放</li>
 *   <li>{@code /v2/online/stream}   —— 在线歌曲 CORS 代理</li>
 * </ul>
 * 修改 Range 处理只需改这里，避免"改一处漏一处"。
 */
@Slf4j
public final class AudioStreamUtil {

    private AudioStreamUtil() {}

    /**
     * 注入统一的 CORS 响应头，保证 Web Audio / 跨域请求不被浏览器沙箱静音拦截。
     */
    public static void applyCorsHeaders(HttpServletResponse response) {
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
        response.setHeader("Access-Control-Allow-Headers", "Range, Accept, Origin, Content-Type");
        response.setHeader("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges");
        response.setHeader("Accept-Ranges", "bytes");
    }

    /**
     * 是否为 OPTIONS 预检请求。
     */
    public static boolean isPreflight(HttpServletRequest request) {
        return "OPTIONS".equalsIgnoreCase(request.getMethod());
    }

    /**
     * 按文件名推断音频 MIME 类型。
     */
    public static String detectContentType(String fileName) {
        String lower = fileName == null ? "" : fileName.toLowerCase();
        if (lower.endsWith(".flac")) return "audio/flac";
        if (lower.endsWith(".wav")) return "audio/wav";
        if (lower.endsWith(".m4a") || lower.endsWith(".aac") || lower.endsWith(".mp4")) return "audio/mp4";
        if (lower.endsWith(".ogg") || lower.endsWith(".opus")) return "audio/ogg";
        return "audio/mpeg";
    }

    /**
     * 本地文件流输出（支持 Range / 206 分片），iOS 熄屏后靠 Range 续传恢复播放。
     */
    public static void streamLocalFile(File file, HttpServletRequest request, HttpServletResponse response) {
        applyCorsHeaders(response);
        try {
            response.setContentType(detectContentType(file.getName()));

            long fileLength = file.length();
            String rangeHeader = request.getHeader("Range");

            long start = 0;
            long end = fileLength - 1;

            if (StringUtils.isNotBlank(rangeHeader) && rangeHeader.startsWith("bytes=")) {
                String rangeValue = rangeHeader.substring(6).trim();
                // 当前流实现只输出一个连续区间；多段 Range 需要 multipart/byteranges，明确拒绝。
                if (rangeValue.contains(",")) {
                    response.setStatus(HttpServletResponse.SC_REQUESTED_RANGE_NOT_SATISFIABLE);
                    response.setHeader("Content-Range", "bytes */" + fileLength);
                    return;
                }

                String[] parts = rangeValue.split("-", -1);
                try {
                    if (parts.length != 2 || (parts[0].isEmpty() && parts[1].isEmpty())) {
                        throw new NumberFormatException("Invalid Range");
                    }
                    if (parts[0].isEmpty()) {
                        long suffixLength = Long.parseLong(parts[1]);
                        if (suffixLength <= 0) throw new NumberFormatException("Invalid suffix Range");
                        start = Math.max(fileLength - suffixLength, 0);
                        end = fileLength - 1;
                    } else {
                        start = Long.parseLong(parts[0]);
                        if (parts[1].isEmpty()) {
                            end = fileLength - 1;
                        } else {
                            end = Long.parseLong(parts[1]);
                        }
                    }
                } catch (NumberFormatException ignored) {
                    response.setStatus(HttpServletResponse.SC_REQUESTED_RANGE_NOT_SATISFIABLE);
                    response.setHeader("Content-Range", "bytes */" + fileLength);
                    return;
                }

                if (start > end || start >= fileLength) {
                    response.setStatus(HttpServletResponse.SC_REQUESTED_RANGE_NOT_SATISFIABLE);
                    response.setHeader("Content-Range", "bytes */" + fileLength);
                    return;
                }
                if (end >= fileLength) end = fileLength - 1;

                long contentLength = end - start + 1;
                response.setStatus(HttpServletResponse.SC_PARTIAL_CONTENT);
                response.setHeader("Content-Range", "bytes " + start + "-" + end + "/" + fileLength);
                response.setContentLengthLong(contentLength);
            } else {
                response.setStatus(HttpServletResponse.SC_OK);
                response.setContentLengthLong(fileLength);
            }

            if ("HEAD".equalsIgnoreCase(request.getMethod())) return;

            try (RandomAccessFile raf = new RandomAccessFile(file, "r");
                 OutputStream out = response.getOutputStream()) {
                raf.seek(start);
                byte[] buffer = new byte[16384];
                long bytesToRead = end - start + 1;
                while (bytesToRead > 0) {
                    int len = (int) Math.min(buffer.length, bytesToRead);
                    int read = raf.read(buffer, 0, len);
                    if (read == -1) break;
                    out.write(buffer, 0, read);
                    bytesToRead -= read;
                }
                out.flush();
            }
        } catch (Exception e) {
            log.warn("本地音频流输出异常或客户端中断: path={}, msg={}", file.getAbsolutePath(), e.getMessage());
        }
    }

    /**
     * 在线音频代理流（透传 Range 分片拖拽）。边播边存等业务逻辑由调用方在进入本方法前处理。
     */
    public static void streamOnlineUrl(String url, HttpServletRequest request, HttpServletResponse response) {
        applyCorsHeaders(response);

        if (isPreflight(request)) {
            response.setStatus(HttpServletResponse.SC_OK);
            return;
        }

        HttpGet httpGet = new HttpGet(url);
        String rangeHeader = request.getHeader("Range");
        if (StringUtils.isNotBlank(rangeHeader)) {
            httpGet.setHeader("Range", rangeHeader);
        }
        httpGet.setHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36");
        httpGet.setHeader("Referer", "https://music.163.com/");

        RequestConfig requestConfig = RequestConfig.custom()
                .setConnectTimeout(15000)
                .setSocketTimeout(30000)
                .build();
        httpGet.setConfig(requestConfig);

        try (CloseableHttpResponse clientResp = HttpClientUtil.getInstance().execute(httpGet)) {
            int statusCode = clientResp.getStatusLine().getStatusCode();
            response.setStatus(statusCode);

            HttpEntity entity = clientResp.getEntity();
            if (entity != null) {
                if (entity.getContentType() != null) {
                    response.setContentType(entity.getContentType().getValue());
                } else {
                    response.setContentType("audio/mpeg");
                }
                if (entity.getContentLength() >= 0) {
                    response.setContentLengthLong(entity.getContentLength());
                }
                Header contentRange = clientResp.getFirstHeader("Content-Range");
                if (contentRange != null) {
                    response.setHeader("Content-Range", contentRange.getValue());
                }

                if (!"HEAD".equalsIgnoreCase(request.getMethod())) {
                    try (InputStream in = entity.getContent();
                         OutputStream out = response.getOutputStream()) {
                        byte[] buffer = new byte[16384];
                        int bytesRead;
                        while ((bytesRead = in.read(buffer)) != -1) {
                            out.write(buffer, 0, bytesRead);
                        }
                        out.flush();
                    }
                }
            }
        } catch (Exception e) {
            log.warn("透传在线音频流异常: url={}, error={}", url, e.getMessage());
        }
    }
}
