package com.wyyyyydl.controller;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.wyyyyydl.enums.CommonRespInfo;
import com.wyyyyydl.models.common.RespEntity;
import com.wyyyyydl.models.dtos.GeoProxyConfig;
import com.wyyyyydl.service.GeoProxyService;

import jakarta.annotation.Resource;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;

/**
 * 🇨🇳 国内跨区解析代理控制器 (解锁海外版权限制)
 */
@Slf4j
@RestController
@RequestMapping("/v3/geo-proxy")
public class GeoProxyController {

    @Resource
    private GeoProxyService geoProxyService;

    @Data
    public static class TestProxyReq {
        private String proxyUrl;
    }

    /**
     * 获取当前代理配置与池状态
     */
    @GetMapping("/config")
    public RespEntity<GeoProxyConfig> getConfig() {
        return RespEntity.apply(CommonRespInfo.SUCCESS, geoProxyService.getConfig());
    }

    /**
     * 保存并应用代理配置
     */
    @PostMapping("/config")
    public RespEntity<GeoProxyConfig> updateConfig(@RequestBody GeoProxyConfig config) {
        geoProxyService.updateConfig(config);
        return RespEntity.apply(CommonRespInfo.SUCCESS, geoProxyService.getConfig());
    }

    /**
     * 测试代理连通性 (若未传参则测试当前首选节点)
     */
    @PostMapping("/test")
    public RespEntity<Map<String, Object>> testProxy(@RequestBody(required = false) TestProxyReq req) {
        String url = req != null ? req.getProxyUrl() : null;
        Map<String, Object> result = geoProxyService.testProxy(url);
        return RespEntity.apply(CommonRespInfo.SUCCESS, result);
    }

    /**
     * 立即触发从代理一览源异步刷新
     */
    @PostMapping("/refresh")
    public RespEntity<String> refreshPool() {
        geoProxyService.asyncRefreshPool();
        return RespEntity.apply(CommonRespInfo.SUCCESS, "已触发代理池刷新任务");
    }
}
