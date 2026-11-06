package com.wyyyyydl.service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.apache.commons.lang3.StringUtils;
import org.apache.http.HttpHost;
import org.apache.http.client.config.RequestConfig;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.util.EntityUtils;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wyyyyydl.dao.IConfigRepository;
import com.wyyyyydl.models.dtos.GeoProxyConfig;
import com.wyyyyydl.utils.HttpClientUtil;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;

/**
 * 🇨🇳 国内跨区解析代理核心服务 (解锁海外版权限制)
 *
 * 核心机制:
 * 1. 严格中国大陆归属地过滤: 自动剔除瑞典/欧美等境外非大陆节点，杜绝版权锁区
 * 2. 智能竞速测速优选: 并发测试候选节点，优先选用响应速度最快 (延迟最低) 的优质节点
 * 3. 固定使用当前活跃优选 IP: 测试成功或优选出的节点作为当前活动 IP 固定使用，状态透明可查
 * 4. 失败隔离与全量兜底: 若候选代理均连接失败，自动无缝降级为直连，绝不卡死用户
 */
@Slf4j
@Service
public class GeoProxyService {

    public static final String CONFIG_KEY = "GEO_PROXY_CONFIG";
    public static final String DEFAULT_SUB_URL = "https://api.proxyscrape.com/v4/free-proxy-list/get?request=display_proxies&proxy_format=protocolipport&format=text&country=cn";

    @Resource
    private IConfigRepository configRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ExecutorService asyncExecutor = Executors.newFixedThreadPool(4);

    private volatile GeoProxyConfig currentConfig = new GeoProxyConfig();

    /** 🟢 当前实际生效并固定使用的代理地址 (如 36.213.79.159:1081) */
    private volatile String currentActiveProxy = "";
    private volatile String currentActiveLocation = "";
    private volatile Long currentActiveLatency = null;
    private volatile boolean isFallbackDirect = false;

    /** 内存动态代理池 */
    private final CopyOnWriteArrayList<String> proxyPool = new CopyOnWriteArrayList<>();
    /** 失败节点冷却缓存: proxyString -> 冷却到期时间戳 (ms) */
    private final ConcurrentHashMap<String, Long> cooldownMap = new ConcurrentHashMap<>();
    /** 是否正在刷新中 */
    private final AtomicBoolean isRefreshing = new AtomicBoolean(false);

    private static final Pattern PROXY_LINE_PATTERN = Pattern.compile("^(?:([a-zA-Z0-9]+)://)?([a-zA-Z0-9.-]+):(\\d+)");

    @PostConstruct
    public void init() {
        try {
            String savedJson = configRepository.getConfig(CONFIG_KEY);
            if (StringUtils.isNotBlank(savedJson)) {
                GeoProxyConfig saved = objectMapper.readValue(savedJson, GeoProxyConfig.class);
                if (saved != null) {
                    this.currentConfig = saved;
                    log.info("🇨🇳 [GeoProxy] 载入持久化配置: enabled={}, mode={}, scope={}",
                            saved.isEnabled(), saved.getMode(), saved.getScope());
                }
            }
        } catch (Exception e) {
            log.warn("🇨🇳 [GeoProxy] 载入配置异常，使用默认设置: {}", e.getMessage());
        }

        if (this.currentConfig.isEnabled() && "pool".equalsIgnoreCase(this.currentConfig.getMode())) {
            asyncRefreshPool();
        }
    }

    public synchronized GeoProxyConfig getConfig() {
        GeoProxyConfig copy = new GeoProxyConfig();
        copy.setEnabled(currentConfig.isEnabled());
        copy.setMode(currentConfig.getMode());
        copy.setCustomProxyUrl(currentConfig.getCustomProxyUrl());
        copy.setSubscriptionUrl(StringUtils.defaultIfBlank(currentConfig.getSubscriptionUrl(), DEFAULT_SUB_URL));
        copy.setScope(StringUtils.defaultIfBlank(currentConfig.getScope(), "resolve_only"));
        copy.setPoolSize(proxyPool.size());
        copy.setLastRefreshedAt(currentConfig.getLastRefreshedAt());

        copy.setActiveProxy(this.currentActiveProxy);
        copy.setActiveLocation(this.currentActiveLocation);
        copy.setActiveLatencyMs(this.currentActiveLatency);
        copy.setFallbackDirect(this.isFallbackDirect);
        return copy;
    }

    public synchronized void updateConfig(GeoProxyConfig newConfig) {
        if (newConfig == null) return;
        boolean wasEnabled = this.currentConfig.isEnabled();
        String oldSubUrl = this.currentConfig.getSubscriptionUrl();
        String oldMode = this.currentConfig.getMode();

        this.currentConfig.setEnabled(newConfig.isEnabled());
        this.currentConfig.setMode(StringUtils.defaultIfBlank(newConfig.getMode(), "pool"));
        this.currentConfig.setCustomProxyUrl(newConfig.getCustomProxyUrl() != null ? newConfig.getCustomProxyUrl().trim() : "");
        this.currentConfig.setSubscriptionUrl(StringUtils.defaultIfBlank(newConfig.getSubscriptionUrl(), DEFAULT_SUB_URL).trim());
        this.currentConfig.setScope(StringUtils.defaultIfBlank(newConfig.getScope(), "resolve_only"));

        if (!this.currentConfig.isEnabled()) {
            this.currentActiveProxy = "";
            this.currentActiveLocation = "";
            this.currentActiveLatency = null;
            this.isFallbackDirect = false;
        } else if ("custom".equalsIgnoreCase(this.currentConfig.getMode())) {
            this.currentActiveProxy = this.currentConfig.getCustomProxyUrl();
            this.currentActiveLocation = "自建专属代理";
        }

        try {
            String json = objectMapper.writeValueAsString(this.currentConfig);
            configRepository.saveConfig(CONFIG_KEY, json);
            log.info("🇨🇳 [GeoProxy] 配置已持久化至 SQLite: enabled={}, mode={}", this.currentConfig.isEnabled(), this.currentConfig.getMode());
        } catch (Exception e) {
            log.error("🇨🇳 [GeoProxy] 保存配置异常", e);
        }

        if (this.currentConfig.isEnabled() && "pool".equalsIgnoreCase(this.currentConfig.getMode())) {
            if (!wasEnabled || !oldMode.equalsIgnoreCase(this.currentConfig.getMode()) || !this.currentConfig.getSubscriptionUrl().equals(oldSubUrl) || proxyPool.isEmpty()) {
                asyncRefreshPool();
            }
        }
    }

    public boolean isEnabled() {
        return currentConfig.isEnabled();
    }

    /**
     * 获取用于当前请求的候选代理列表 (固定优先使用当前已验证活跃代理)
     */
    public List<HttpHost> getCandidateProxies() {
        if (!currentConfig.isEnabled()) {
            return Collections.emptyList();
        }

        // 1. 自定义单一代理模式
        if ("custom".equalsIgnoreCase(currentConfig.getMode())) {
            HttpHost host = parseHttpHost(currentConfig.getCustomProxyUrl());
            return host != null ? Collections.singletonList(host) : Collections.emptyList();
        }

        long now = System.currentTimeMillis();
        cooldownMap.entrySet().removeIf(entry -> entry.getValue() < now);

        // 若当前有已验证活跃代理且未失效，100% 优先固定使用！
        if (StringUtils.isNotBlank(this.currentActiveProxy)) {
            Long cooldownUntil = cooldownMap.get(this.currentActiveProxy);
            if (cooldownUntil == null || cooldownUntil <= now) {
                HttpHost activeHost = parseHttpHost(this.currentActiveProxy);
                if (activeHost != null) {
                    List<HttpHost> list = new ArrayList<>();
                    list.add(activeHost);
                    // 候补 1 个候选节点供失败切换
                    for (String pStr : proxyPool) {
                        if (!pStr.equals(this.currentActiveProxy) && !cooldownMap.containsKey(pStr)) {
                            HttpHost backup = parseHttpHost(pStr);
                            if (backup != null) {
                                list.add(backup);
                                break;
                            }
                        }
                    }
                    return list;
                }
            }
        }

        if (proxyPool.isEmpty() && now - currentConfig.getLastRefreshedAt() > 300_000L) {
            asyncRefreshPool();
        }

        if (proxyPool.isEmpty()) {
            this.isFallbackDirect = true;
            return Collections.emptyList();
        }

        List<HttpHost> candidates = new ArrayList<>();
        for (String proxyStr : proxyPool) {
            Long cooldownUntil = cooldownMap.get(proxyStr);
            if (cooldownUntil != null && cooldownUntil > now) continue;
            HttpHost host = parseHttpHost(proxyStr);
            if (host != null) {
                candidates.add(host);
                if (candidates.size() >= 2) break;
            }
        }

        return candidates;
    }

    /**
     * 标记某个代理连接或握手失败 (并自动故障切换活跃代理)
     */
    public void reportProxyFailure(HttpHost host) {
        if (host == null) return;
        String key = host.toHostString();
        cooldownMap.put(key, System.currentTimeMillis() + 180_000L);
        log.warn("🇨🇳 [GeoProxy] 代理节点故障或超时，已暂时隔离 3 分钟: {}", key);

        // 若挂掉的是当前活动代理，自动清理并触发优选切换
        if (key.equalsIgnoreCase(this.currentActiveProxy)) {
            log.warn("🇨🇳 [GeoProxy] ⚠️ 当前生效代理 {} 已失效，触发自动故障转移...", key);
            this.currentActiveProxy = "";
            this.currentActiveLocation = "";
            this.currentActiveLatency = null;
            // 异步自动竞速探测寻找替补新 IP
            asyncExecutor.submit(() -> testProxy(""));
        }
    }

    public void asyncRefreshPool() {
        if (!isRefreshing.compareAndSet(false, true)) {
            return;
        }
        asyncExecutor.submit(() -> {
            try {
                String subUrl = currentConfig.getSubscriptionUrl();
                if (StringUtils.isBlank(subUrl)) {
                    subUrl = DEFAULT_SUB_URL;
                }
                log.info("🇨🇳 [GeoProxy] 正在从代理一览源拉取国内高匿节点: {}", subUrl);
                HttpGet get = new HttpGet(subUrl);
                RequestConfig rc = RequestConfig.custom()
                        .setConnectTimeout(8000)
                        .setSocketTimeout(12000)
                        .build();
                get.setConfig(rc);
                get.setHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) wyyyyy-dl-geo-agent");

                try (CloseableHttpResponse resp = HttpClientUtil.getInstance().execute(get)) {
                    int code = resp.getStatusLine().getStatusCode();
                    if (code >= 200 && code < 300 && resp.getEntity() != null) {
                        List<String> list = new ArrayList<>();
                        try (BufferedReader reader = new BufferedReader(new InputStreamReader(resp.getEntity().getContent(), StandardCharsets.UTF_8))) {
                            String line;
                            while ((line = reader.readLine()) != null) {
                                line = line.trim();
                                if (line.isEmpty() || line.startsWith("#")) continue;
                                Matcher m = PROXY_LINE_PATTERN.matcher(line);
                                if (m.find()) {
                                    String host = m.group(2);
                                    String port = m.group(3);
                                    list.add(host + ":" + port);
                                }
                            }
                        }
                        if (!list.isEmpty()) {
                            proxyPool.clear();
                            proxyPool.addAll(list);
                            currentConfig.setLastRefreshedAt(System.currentTimeMillis());
                            log.info("🇨🇳 [GeoProxy] 🎉 成功刷新代理池，装载节点数: {}", list.size());
                            // 刷新后自动跑一次测试，锁定一个可用国内 IP
                            if (StringUtils.isBlank(this.currentActiveProxy)) {
                                testProxy("");
                            }
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("🇨🇳 [GeoProxy] 拉取代理源网络异常: {}", e.getMessage());
            } finally {
                isRefreshing.set(false);
            }
        });
    }

    /**
     * 测试代理连通性并【固定选中最快的中国大陆节点作为生效 IP】
     */
    public Map<String, Object> testProxy(String targetProxyUrl) {
        // 1. 若用户指定了自定义单一代理，直接测试该代理
        if (StringUtils.isNotBlank(targetProxyUrl)) {
            HttpHost host = parseHttpHost(targetProxyUrl.trim());
            Map<String, Object> r = testSingleHost(host, false);
            if (Boolean.TRUE.equals(r.get("success"))) {
                this.currentActiveProxy = host.toHostString();
                this.currentActiveLocation = (String) r.get("location");
                this.currentActiveLatency = (Long) r.get("latencyMs");
                this.isFallbackDirect = false;
            }
            return r;
        }

        // 2. 聚合代理池模式：并发测速竞选最快中国大陆节点
        if (proxyPool.isEmpty()) {
            Map<String, Object> fail = new HashMap<>();
            fail.put("success", false);
            fail.put("error", "当前内存代理池为空，请先点击「刷新代理池」或检查订阅源");
            this.isFallbackDirect = true;
            return fail;
        }

        List<String> snapshot = new ArrayList<>(proxyPool);
        int sampleSize = Math.min(snapshot.size(), 8);
        List<CompletableFuture<Map<String, Object>>> futures = new ArrayList<>();

        for (int i = 0; i < sampleSize; i++) {
            String pStr = snapshot.get(i);
            HttpHost h = parseHttpHost(pStr);
            if (h != null) {
                futures.add(CompletableFuture.supplyAsync(() -> testSingleHost(h, true), asyncExecutor));
            }
        }

        List<Map<String, Object>> successResults = new ArrayList<>();
        for (CompletableFuture<Map<String, Object>> f : futures) {
            try {
                Map<String, Object> r = f.get(4500, TimeUnit.MILLISECONDS);
                if (Boolean.TRUE.equals(r.get("success"))) {
                    successResults.add(r);
                }
            } catch (Exception ignored) {}
        }

        if (successResults.isEmpty()) {
            Map<String, Object> fail = new HashMap<>();
            fail.put("success", false);
            fail.put("error", "所测代理节点连接超时或无中国大陆有效响应，系统将在请求时自动直连兜底");
            this.isFallbackDirect = true;
            return fail;
        }

        // 按延迟 (latencyMs) 升序排序，挑选出【速度最快、延时最低】的国内节点
        successResults.sort(Comparator.comparingLong(a -> (Long) a.getOrDefault("latencyMs", 99999L)));
        Map<String, Object> winner = successResults.get(0);
        String fastestProxy = (String) winner.get("proxy");

        // 🌟 核心：将此测试成功的优质国内节点确立为【当前固定正在使用的代理 IP】
        this.currentActiveProxy = fastestProxy;
        this.currentActiveLocation = (String) winner.get("location");
        this.currentActiveLatency = (Long) winner.get("latencyMs");
        this.isFallbackDirect = false;

        log.info("🇨🇳 [GeoProxy] 🎯 已固定当前正在生效的代理 IP: {} ({} ms, {})",
                fastestProxy, this.currentActiveLatency, this.currentActiveLocation);

        winner.put("isFastestWinner", true);
        winner.put("testedCount", sampleSize);
        return winner;
    }

    private Map<String, Object> testSingleHost(HttpHost host, boolean requireChinaMainland) {
        Map<String, Object> result = new HashMap<>();
        if (host == null) {
            result.put("success", false);
            result.put("error", "无效的代理地址");
            return result;
        }

        long start = System.currentTimeMillis();
        RequestConfig requestConfig = RequestConfig.custom()
                .setProxy(host)
                .setConnectTimeout(3500)
                .setSocketTimeout(4000)
                .build();

        HttpGet httpGet = new HttpGet("http://myip.ipip.net");
        httpGet.setConfig(requestConfig);
        httpGet.setHeader("User-Agent", "curl/8.7.1");

        try (CloseableHttpClient testClient = HttpClients.custom().build();
             CloseableHttpResponse resp = testClient.execute(httpGet)) {
            long latency = System.currentTimeMillis() - start;
            int code = resp.getStatusLine().getStatusCode();
            if (code == 200 && resp.getEntity() != null) {
                String text = EntityUtils.toString(resp.getEntity(), StandardCharsets.UTF_8).trim();
                String ip = host.getHostName();
                String location = "未知归属地";

                if (text.contains("当前 IP：")) {
                    String clean = text.replace("当前 IP：", "");
                    String[] parts = clean.split("来自于：", 2);
                    ip = parts[0].trim();
                    if (parts.length > 1) {
                        location = parts[1].trim();
                    }
                }

                // 🛡️ 严格过滤非中国大陆节点 (彻底剔除瑞典、欧美等境外 IP)
                if (requireChinaMainland && !isChinaMainland(location)) {
                    reportProxyFailure(host);
                    proxyPool.remove(host.toHostString());
                    result.put("success", false);
                    result.put("error", "已过滤境外非大陆节点 (" + location + ")");
                    return result;
                }

                result.put("success", true);
                result.put("latencyMs", latency);
                result.put("proxy", host.toHostString());
                result.put("ip", ip);
                result.put("location", location);
                return result;
            } else {
                reportProxyFailure(host);
                result.put("success", false);
                result.put("error", "状态码异常: " + code);
                return result;
            }
        } catch (Exception e) {
            reportProxyFailure(host);
            result.put("success", false);
            result.put("error", "连接超时: " + e.getMessage());
            result.put("proxy", host.toHostString());
            return result;
        }
    }

    public static boolean isChinaMainland(String location) {
        if (StringUtils.isBlank(location)) return false;
        if (!location.contains("中国")) return false;
        return !location.contains("香港") && !location.contains("台湾") && !location.contains("澳门");
    }

    private HttpHost parseHttpHost(String raw) {
        if (StringUtils.isBlank(raw)) return null;
        try {
            String clean = raw.trim();
            if (!clean.contains("://")) {
                clean = "http://" + clean;
            }
            URI uri = URI.create(clean);
            String host = uri.getHost();
            int port = uri.getPort() != -1 ? uri.getPort() : 80;
            return new HttpHost(host, port, uri.getScheme() != null ? uri.getScheme().toLowerCase() : "http");
        } catch (Exception e) {
            return null;
        }
    }
}
