package com.wyy.models.dtos;

import lombok.Data;

/**
 * 🇨🇳 国内跨区解析代理配置 (解锁海外版权限制)
 */
@Data
public class GeoProxyConfig {
    /** 是否开启海外版权跨区代理 (默认不勾选 false) */
    private boolean enabled = false;

    /** 代理模式: "pool" (聚合代理一览源) 或 "custom" (自定义单一代理) */
    private String mode = "pool";

    /** 自定义单一代理地址, 支持 http:// 或 socks5://, 如 http://1.2.3.4:8080 */
    private String customProxyUrl = "";

    /** 聚合代理一览源 URL (以 .txt 结尾或 API 订阅源) */
    private String subscriptionUrl = "https://api.proxyscrape.com/v4/free-proxy-list/get?request=display_proxies&proxy_format=protocolipport&format=text&country=cn";

    /** 作用范围: "resolve_only" (仅解析API走代理, 音频直连 - 推荐) 或 "all" (全量代理) */
    private String scope = "resolve_only";

    /** 内存中当前可用代理数量 (只读状态) */
    private int poolSize = 0;

    /** 上次刷新时间戳 (只读状态) */
    private long lastRefreshedAt = 0L;

    /** 🟢 当前实际生效并固定使用的代理地址 (如 36.213.79.159:1081) */
    private String activeProxy = "";

    /** 🟢 当前生效代理的归属地 (如 中国 北京 移动) */
    private String activeLocation = "";

    /** 🟢 当前生效代理的往返延迟 (ms) */
    private Long activeLatencyMs = null;

    /** 🟡 当前是否因节点失效暂时处于直连兜底状态 */
    private boolean fallbackDirect = false;
}
