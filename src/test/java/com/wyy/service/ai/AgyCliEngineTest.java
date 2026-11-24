package com.wyy.service.ai;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("⚡ 本地 agy Agent 引擎单元测试")
class AgyCliEngineTest {

    @Test
    @DisplayName("测试引擎标识为 LOCAL_AGY")
    void testEngineType() {
        AgyCliEngine engine = new AgyCliEngine();
        assertEquals("LOCAL_AGY", engine.getEngineType());
    }

    @Test
    @DisplayName("测试未连通本地可执行文件与未启动网桥时的安全失败响应")
    void testExecuteFallbackWhenOffline() {
        AgyCliEngine engine = new AgyCliEngine();
        ReflectionTestUtils.setField(engine, "configuredAgyPath", "/non/existent/path/agy");
        ReflectionTestUtils.setField(engine, "configuredBridgeUrl", "http://127.0.0.1:19999"); // unreachable port

        AiEngineResponse resp = engine.execute("test prompt", null, "high");
        assertNotNull(resp);
        assertEquals("LOCAL_AGY", resp.getEngineType());
        assertFalse(resp.isSuccess());
        assertTrue(resp.getErrorMsg().contains("未连通"));
    }
}
