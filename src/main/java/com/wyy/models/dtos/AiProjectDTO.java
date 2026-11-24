package com.wyy.models.dtos;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 🎨 AI 创作工坊工程实体 DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiProjectDTO {
    private String id;
    private String refSongId;
    private String refSongTitle;
    private String refArtist;
    private String genreCategory;
    private String projectDir;
    private String status; // CREATED, PROMPT_READY, OFFLINE_RENDERING, COMPLETED
    private String createdAt;
    private String updatedAt;

    private List<AiTrackPromptDTO> trackPrompts;
    private List<AiRenderedAssetDTO> renderedAssets;
    private String analysisReport;
}
