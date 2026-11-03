package com.wyyyyydl.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;

import org.apache.http.HttpHost;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import com.wyyyyydl.dao.IConfigRepository;
import com.wyyyyydl.models.dtos.GeoProxyConfig;

class GeoProxyServiceTest {

    private GeoProxyService geoProxyService;
    private MockConfigRepository mockConfigRepo;

    static class MockConfigRepository implements IConfigRepository {
        private String value;
        @Override
        public void saveConfig(String key, String val) {
            this.value = val;
        }
        @Override
        public String getConfig(String key) {
            return this.value;
        }
    }

    @BeforeEach
    void setUp() {
        geoProxyService = new GeoProxyService();
        mockConfigRepo = new MockConfigRepository();
        ReflectionTestUtils.setField(geoProxyService, "configRepository", mockConfigRepo);
    }

    @Test
    void testDefaultDisabledAndFallback() {
        geoProxyService.init();
        assertFalse(geoProxyService.isEnabled());
        List<HttpHost> candidates = geoProxyService.getCandidateProxies();
        assertTrue(candidates.isEmpty(), "未开启时候选代理列表应为空");
    }

    @Test
    void testCustomProxyMode() {
        GeoProxyConfig config = new GeoProxyConfig();
        config.setEnabled(true);
        config.setMode("custom");
        config.setCustomProxyUrl("http://127.0.0.1:8888");
        geoProxyService.updateConfig(config);

        assertTrue(geoProxyService.isEnabled());
        List<HttpHost> candidates = geoProxyService.getCandidateProxies();
        assertEquals(1, candidates.size());
        assertEquals("127.0.0.1", candidates.get(0).getHostName());
        assertEquals(8888, candidates.get(0).getPort());
    }

    @Test
    void testTestProxyHandlesInvalidGracefully() {
        Map<String, Object> res = geoProxyService.testProxy("http://127.0.0.1:54321");
        assertNotNull(res);
        assertFalse((Boolean) res.get("success"));
        assertTrue(res.containsKey("error"));
    }

    @Test
    void testIsChinaMainlandFilter() {
        assertTrue(GeoProxyService.isChinaMainland("中国 北京 北京 移动"));
        assertTrue(GeoProxyService.isChinaMainland("中国 广东 广州 电信"));
        assertFalse(GeoProxyService.isChinaMainland("瑞典 斯德哥尔摩省 斯德哥尔摩 cogento-backbone.com"));
        assertFalse(GeoProxyService.isChinaMainland("美国 加利福尼亚 洛杉矶"));
        assertFalse(GeoProxyService.isChinaMainland("中国 香港 特别行政区"));
        assertFalse(GeoProxyService.isChinaMainland(""));
        assertFalse(GeoProxyService.isChinaMainland(null));
    }
}
