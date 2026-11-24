package com.wyy.dao;

import com.wyy.models.dtos.AiProjectDTO;
import com.wyy.models.dtos.AiRenderedAssetDTO;
import com.wyy.models.dtos.AiSessionHistoryDTO;
import com.wyy.models.dtos.AiTrackPromptDTO;

import java.util.List;

/**
 * 🎨 AI 创作工坊与资产持久化仓储接口
 */
public interface IAiStudioRepository {

    void saveProject(AiProjectDTO project);

    AiProjectDTO getProjectById(String id);

    List<AiProjectDTO> listProjects(int limit);

    void updateProjectStatus(String id, String status);

    void saveSessionHistory(AiSessionHistoryDTO sessionHistory);

    List<AiSessionHistoryDTO> getSessionHistories(String projectId);

    void saveTrackPrompts(List<AiTrackPromptDTO> prompts);

    List<AiTrackPromptDTO> getTrackPromptsByProjectId(String projectId);

    void saveRenderedAsset(AiRenderedAssetDTO asset);

    List<AiRenderedAssetDTO> getRenderedAssetsByProjectId(String projectId);

    boolean deleteProject(String id);
}
