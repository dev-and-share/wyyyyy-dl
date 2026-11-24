package com.wyy.service.ai;

/**
 * 🤖 统一 AI 推理引擎契约接口
 */
public interface IAiEngine {

    String getEngineType();

    AiEngineResponse execute(String prompt, String conversationId, String effort);
}
