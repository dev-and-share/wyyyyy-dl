package com.wyy.models.dtos;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 💬 AI 创作对话会话与追问历史 DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiSessionHistoryDTO {
    private String id;
    private String projectId;
    private String versionLabel; // V1_FIDELITY, V2_FUSION, V3_EMOTIONAL or ALL
    private String engineType; // LOCAL_AGY, NEW_API
    private String sessionId;  // agy conversation ID or API session ID
    private String role;       // system, user, assistant
    private String content;
    private String createdAt;
}
