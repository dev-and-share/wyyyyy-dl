package com.wyyyyydl.controller;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import org.apache.commons.lang3.StringUtils;
import org.apache.http.Header;
import org.apache.http.HttpEntity;
import org.apache.http.HttpHost;
import org.apache.http.client.config.RequestConfig;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpEntityEnclosingRequestBase;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.client.methods.HttpRequestBase;
import org.apache.http.client.utils.URIBuilder;
import org.apache.http.entity.ContentType;
import org.apache.http.entity.StringEntity;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wyyyyydl.service.GeoProxyService;
import com.wyyyyydl.utils.AudioStreamUtil;
import com.wyyyyydl.utils.HttpClientUtil;

import jakarta.annotation.Resource;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;

/**
 * 🧩 通用第三方音源插件网络代理中继控制器 (MusicFree & Universal Plugin Proxy)
 *
 * 核心目的：
 * 1. 彻底解决 Web 浏览器沙箱中的同源策略 (CORS) 限制
 * 2. 避免为每个第三方平台手写后端代码，提供 100% 平台中立的 HTTP 盲代理
 * 3. 支持透传 Referer、Cookie、User-Agent 等防盗链关键标头
 */
@Slf4j
@RestController
@RequestMapping("/v3/plugin")
public class PluginProxyController {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Resource
    private GeoProxyService geoProxyService;

    @Data
    public static class ProxyRequestPayload {
        private String url;
        private String method = "GET";
        private Map<String, String> headers;
        private Map<String, Object> params;
        private Object data;
    }

    /**
     * 快捷拉取插件订阅源 JSON 或单脚本 JS 内容 (GET 方式)
     */
    @GetMapping(value = "/fetch")
    public void fetchDirect(@RequestParam("url") String targetUrl,
                            HttpServletRequest request,
                            HttpServletResponse response) {
        AudioStreamUtil.applyCorsHeaders(response);
        if (AudioStreamUtil.isPreflight(request)) {
            response.setStatus(HttpServletResponse.SC_OK);
            return;
        }

        if (StringUtils.isBlank(targetUrl)) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            return;
        }

        HttpGet httpGet = new HttpGet(targetUrl);
        httpGet.setHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36");
        httpGet.setHeader("Accept", "*/*");

        RequestConfig requestConfig = RequestConfig.custom()
                .setConnectTimeout(15000)
                .setSocketTimeout(30000)
                .build();
        httpGet.setConfig(requestConfig);

        try (CloseableHttpResponse clientResp = executeWithRedirects(httpGet, 5)) {
            response.setStatus(clientResp.getStatusLine().getStatusCode());
            HttpEntity entity = clientResp.getEntity();
            if (entity != null) {
                if (entity.getContentType() != null) {
                    response.setContentType(entity.getContentType().getValue());
                } else {
                    response.setContentType("text/plain;charset=UTF-8");
                }
                try (InputStream in = entity.getContent(); OutputStream out = response.getOutputStream()) {
                    byte[] buf = new byte[8192];
                    int len;
                    while ((len = in.read(buf)) != -1) {
                        out.write(buf, 0, len);
                    }
                    out.flush();
                }
            }
        } catch (Exception e) {
            log.warn("插件资源拉取异常: url={}, msg={}", targetUrl, e.getMessage());
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * 通用 HTTP 盲代理中继 (POST 方式)
     * 支持 GET / POST / PUT 等任意方法，支持自定义 headers / query params / body 数据
     */
    @RequestMapping(value = "/proxy", method = {RequestMethod.POST, RequestMethod.OPTIONS})
    public void proxyRequest(@RequestBody(required = false) ProxyRequestPayload payload,
                             HttpServletRequest request,
                             HttpServletResponse response) {
        AudioStreamUtil.applyCorsHeaders(response);
        if (AudioStreamUtil.isPreflight(request)) {
            response.setStatus(HttpServletResponse.SC_OK);
            return;
        }

        if (payload == null || StringUtils.isBlank(payload.getUrl())) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            return;
        }

        try {
            String rawUrl = payload.getUrl().trim();
            if (rawUrl.startsWith("/")) {
                log.warn("🌐 [PluginProxy] 拒绝相对 URL 代理请求: {}", rawUrl);
                response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                return;
            }

            // 1. 构建目标 URI (包含 query params)
            URIBuilder uriBuilder = new URIBuilder(rawUrl);
            if (payload.getParams() != null && !payload.getParams().isEmpty()) {
                for (Map.Entry<String, Object> entry : payload.getParams().entrySet()) {
                    if (entry.getValue() != null) {
                        uriBuilder.setParameter(entry.getKey(), String.valueOf(entry.getValue()));
                    }
                }
            }
            URI targetUri = uriBuilder.build();

            // 2. 构建 HttpRequestBase 实例
            String method = StringUtils.defaultIfBlank(payload.getMethod(), "GET").toUpperCase();
            HttpRequestBase httpRequest;

            if ("POST".equals(method)) {
                HttpPost post = new HttpPost(targetUri);
                attachRequestBody(post, payload);
                httpRequest = post;
            } else if ("PUT".equals(method)) {
                HttpEntityEnclosingRequestBase put = new HttpEntityEnclosingRequestBase() {
                    @Override
                    public String getMethod() {
                        return "PUT";
                    }
                };
                put.setURI(targetUri);
                attachRequestBody(put, payload);
                httpRequest = put;
            } else {
                httpRequest = new HttpGet(targetUri);
            }

            // 3. 填充 Headers (过滤掉 host, content-length, accept-encoding，防止远端返回压缩乱码)
            boolean hasUa = false;
            if (payload.getHeaders() != null) {
                for (Map.Entry<String, String> entry : payload.getHeaders().entrySet()) {
                    String key = entry.getKey();
                    if ("host".equalsIgnoreCase(key) || "content-length".equalsIgnoreCase(key) || "accept-encoding".equalsIgnoreCase(key)) {
                        continue;
                    }
                    if ("user-agent".equalsIgnoreCase(key)) {
                        hasUa = true;
                    }
                    httpRequest.setHeader(key, entry.getValue());
                }
            }
            if (!hasUa) {
                httpRequest.setHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36");
            }

            RequestConfig requestConfig = RequestConfig.custom()
                    .setConnectTimeout(15000)
                    .setSocketTimeout(30000)
                    .build();
            httpRequest.setConfig(requestConfig);

            log.info("🌐 [PluginProxy] >>> {} {}", method, targetUri);

            // 4. 执行请求并原样透传给前端 (自动挂载国内跨区解析代理，支持故障切换与直连兜底)
            try (CloseableHttpResponse clientResp = executeWithProxyFallback(httpRequest, 5)) {
                int status = clientResp.getStatusLine().getStatusCode();
                response.setStatus(status);

                if (status >= 400) {
                    log.warn("🌐 [PluginProxy] ⚠️ 远端目标返回状态码 {}: url={}", status, targetUri);
                } else {
                    log.info("🌐 [PluginProxy] <<< {} status={}", targetUri, status);
                }

                HttpEntity entity = clientResp.getEntity();
                if (entity != null) {
                    if (entity.getContentType() != null) {
                        response.setContentType(entity.getContentType().getValue());
                    } else {
                        response.setContentType("application/json;charset=UTF-8");
                    }
                    try (InputStream in = entity.getContent(); OutputStream out = response.getOutputStream()) {
                        byte[] buf = new byte[8192];
                        int len;
                        while ((len = in.read(buf)) != -1) {
                            out.write(buf, 0, len);
                        }
                        out.flush();
                    }
                }
            }
        } catch (Exception e) {
            log.warn("通用插件代理转发异常: url={}, msg={}", payload.getUrl(), e.getMessage());
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        }
    }

    private void attachRequestBody(HttpEntityEnclosingRequestBase request, ProxyRequestPayload payload) {
        if (payload.getData() == null) return;
        try {
            if (payload.getData() instanceof String str) {
                request.setEntity(new StringEntity(str, StandardCharsets.UTF_8));
            } else {
                String json = objectMapper.writeValueAsString(payload.getData());
                request.setEntity(new StringEntity(json, ContentType.APPLICATION_JSON));
            }
        } catch (Exception e) {
            log.warn("序列化插件请求体失败: {}", e.getMessage());
        }
    }

    /**
     * 执行 HTTP 请求，优先挂载国内解析代理；若代理全部失败则自动直连兜底
     */
    private CloseableHttpResponse executeWithProxyFallback(HttpRequestBase request, int maxRedirects) throws Exception {
        if (!geoProxyService.isEnabled()) {
            return executeWithRedirects(request, null, maxRedirects);
        }

        List<HttpHost> candidates = geoProxyService.getCandidateProxies();
        if (candidates.isEmpty()) {
            log.info("🇨🇳 [GeoProxy] 暂无可用国内代理，直接以直连方式兜底请求: {}", request.getURI());
            return executeWithRedirects(request, null, maxRedirects);
        }

        for (HttpHost proxy : candidates) {
            try {
                log.info("🇨🇳 [GeoProxy] 正在通过国内代理尝试解析: proxy={}, url={}", proxy.toHostString(), request.getURI());
                CloseableHttpResponse resp = executeWithRedirects(request, proxy, maxRedirects);
                int code = resp.getStatusLine().getStatusCode();
                if (code >= 200 && code < 400) {
                    return resp;
                }
                log.warn("🇨🇳 [GeoProxy] 代理节点返回非正常状态码 {}: proxy={}, url={}", code, proxy.toHostString(), request.getURI());
                resp.close();
                geoProxyService.reportProxyFailure(proxy);
            } catch (Exception e) {
                log.warn("🇨🇳 [GeoProxy] 代理节点解析异常: proxy={}, error={}", proxy.toHostString(), e.getMessage());
                geoProxyService.reportProxyFailure(proxy);
            }
        }

        // 🌟 当所有代理都失败时，自动直连兜底 (Fallback to direct connection)
        log.warn("🇨🇳 [GeoProxy] ⚠️ 候选代理均失败，自动降级为直连兜底: url={}", request.getURI());
        return executeWithRedirects(request, null, maxRedirects);
    }

    /**
     * 自动处理 301/302/303/307/308 HTTP 重定向 (向后兼容无代理调用)
     */
    private CloseableHttpResponse executeWithRedirects(HttpRequestBase request, int maxRedirects) throws Exception {
        return executeWithRedirects(request, null, maxRedirects);
    }

    /**
     * 自动处理 301/302/303/307/308 HTTP 重定向 (支持代理)
     */
    private CloseableHttpResponse executeWithRedirects(HttpRequestBase request, HttpHost proxy, int maxRedirects) throws Exception {
        RequestConfig.Builder rcb = RequestConfig.custom()
                .setConnectTimeout(proxy != null ? 6000 : 15000)
                .setSocketTimeout(proxy != null ? 10000 : 30000);
        if (proxy != null) {
            rcb.setProxy(proxy);
        }
        request.setConfig(rcb.build());

        URI currentUri = request.getURI();
        for (int i = 0; i < maxRedirects; i++) {
            request.setURI(currentUri);
            CloseableHttpResponse resp = HttpClientUtil.getInstance().execute(request);
            int code = resp.getStatusLine().getStatusCode();
            if (code == 301 || code == 302 || code == 303 || code == 307 || code == 308) {
                Header loc = resp.getFirstHeader("Location");
                if (loc != null && StringUtils.isNotBlank(loc.getValue())) {
                    String redirectUrl = loc.getValue();
                    URI nextUri = currentUri.resolve(redirectUrl);
                    resp.close();
                    currentUri = nextUri;
                    continue;
                }
            }
            return resp;
        }
        return HttpClientUtil.getInstance().execute(request);
    }
}
