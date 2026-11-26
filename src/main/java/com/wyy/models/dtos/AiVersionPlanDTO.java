package com.wyy.models.dtos;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 🎼 独立歌词与编曲方案实体 DTO (一等公民，与渲染模型解耦，持久化落盘 DB)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiVersionPlanDTO {
    private String id;
    private String projectId;
    private String versionLabel;      // V1_FIDELITY, V2_FUSION, V3_EMOTIONAL
    private String planTitle;         // 编曲企划标题
    private String genre;             // 风格流派
    private Integer bpm;              // 速度
    private String musicalKey;        // 调性
    private String arrangementNotes;  // 编曲乐理与配器说明
    private String lyricsText;        // 本版本统一主歌词 (所有渲染模型共享)
    private String sessionId;         // 专属独立 agy Session ID
    private List<String> appliedModels; // 当前应用到的模型列表 (如 YuE2-3B, MiniMax-Music3, ACE-Step-1.5)
    private String updatedAt;
}
