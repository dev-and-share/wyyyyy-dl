package com.wyy.service.ai;

import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 🔀 AI 推理双引擎动态路由器
 */
@Component
@Slf4j
public class AiEngineRouter {

    @Autowired
    private AgyCliEngine agyCliEngine;

    @Autowired
    private NewApiEngine newApiEngine;

    @Value("${ai.engine.default:${AI_DEFAULT_ENGINE:LOCAL_AGY}}")
    private String defaultEngineType;

    public IAiEngine resolveEngine(String engineType) {
        if ("NEW_API".equalsIgnoreCase(engineType)) {
            return newApiEngine;
        }
        if ("LOCAL_AGY".equalsIgnoreCase(engineType)) {
            return agyCliEngine;
        }
        return "NEW_API".equalsIgnoreCase(defaultEngineType) ? newApiEngine : agyCliEngine;
    }

    public AiEngineResponse execute(String prompt, String conversationId, String effort, String engineType) {
        IAiEngine engine = resolveEngine(engineType);
        log.info("🎯 [AiEngineRouter] 路由至引擎: {}", engine.getEngineType());
        return engine.execute(prompt, conversationId, effort);
    }
}
