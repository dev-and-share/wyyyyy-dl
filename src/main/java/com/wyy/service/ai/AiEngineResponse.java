package com.wyy.service.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 🤖 AI 引擎统一响应模型
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiEngineResponse {
    private String responseText;
    private String conversationId;
    private String engineType; // LOCAL_AGY, NEW_API
    private boolean success;
    private String errorMsg;
    private Long durationMs;
}
