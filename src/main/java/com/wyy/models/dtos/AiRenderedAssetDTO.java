package com.wyy.models.dtos;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 💿 AI 离线渲染音频资产与生物质检信息 DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiRenderedAssetDTO {
    private String id;
    private String projectId;
    private String trackPromptId;
    private String audioPath;
    private Double audioDurationSeconds;
    private Integer sampleRate;
    private Integer bitrate;
    private Double spectralEntropy;
    private Double rmsStd;
    private Integer qaPassed; // 1: pass, 0: fail
    private String syncedAt;
}
