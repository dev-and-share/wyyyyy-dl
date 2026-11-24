package com.wyy.models.dtos;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 🎵 AI 生成曲目规划与模型专用 Prompt DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiTrackPromptDTO {
    private String id;
    private String projectId;
    private String versionLabel; // V1_FIDELITY, V2_FUSION, V3_EMOTIONAL
    private String modelName;    // YuE2-3B, MiniMax-Music3, ACE-Step-1.5
    private String trackTitle;
    private String promptContent;
    private String lyricsPlan;
    private String modelParamsJson;
    private String createdAt;
}
