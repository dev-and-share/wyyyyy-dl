package com.wyy.dao.impl;

import com.wyy.dao.IAiStudioRepository;
import com.wyy.models.dtos.AiProjectDTO;
import com.wyy.models.dtos.AiRenderedAssetDTO;
import com.wyy.models.dtos.AiSessionHistoryDTO;
import com.wyy.models.dtos.AiSongAnalysisDTO;
import com.wyy.models.dtos.AiTrackPromptDTO;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * ☁️ 无外部 SQL 数据库时的内存容灾实现
 */
@Repository("inMemoryAiStudioRepository")
@ConditionalOnProperty(name = "storage.type", havingValue = "dynamodb")
public class InMemoryAiStudioRepository implements IAiStudioRepository {

    private final Map<String, AiProjectDTO> projects = new ConcurrentHashMap<>();
    private final Map<String, List<AiSessionHistoryDTO>> sessions = new ConcurrentHashMap<>();
    private final Map<String, List<AiTrackPromptDTO>> prompts = new ConcurrentHashMap<>();
    private final Map<String, List<AiRenderedAssetDTO>> assets = new ConcurrentHashMap<>();
    private final Map<String, AiSongAnalysisDTO> analyses = new ConcurrentHashMap<>();

    @Override
    public void saveSongAnalysis(AiSongAnalysisDTO analysis) {
        if (analysis != null && analysis.getRefSongId() != null) {
            analyses.put(analysis.getRefSongId(), analysis);
        }
    }

    @Override
    public AiSongAnalysisDTO getSongAnalysisBySongId(String refSongId) {
        return refSongId != null ? analyses.get(refSongId) : null;
    }

    @Override
    public AiProjectDTO getLatestProjectBySongId(String refSongId) {
        if (refSongId == null) return null;
        return projects.values().stream()
                .filter(p -> refSongId.equals(p.getRefSongId()))
                .findFirst()
                .map(p -> getProjectById(p.getId()))
                .orElse(null);
    }

    @Override
    public void saveProject(AiProjectDTO project) {
        if (project != null && project.getId() != null) {
            projects.put(project.getId(), project);
        }
    }

    @Override
    public AiProjectDTO getProjectById(String id) {
        AiProjectDTO p = projects.get(id);
        if (p != null) {
            p.setTrackPrompts(getTrackPromptsByProjectId(id));
            p.setRenderedAssets(getRenderedAssetsByProjectId(id));
        }
        return p;
    }

    @Override
    public List<AiProjectDTO> listProjects(int limit) {
        return projects.values().stream()
                .limit(limit > 0 ? limit : 50)
                .collect(Collectors.toList());
    }

    @Override
    public void updateProjectStatus(String id, String status) {
        AiProjectDTO p = projects.get(id);
        if (p != null) {
            p.setStatus(status);
        }
    }

    @Override
    public void saveSessionHistory(AiSessionHistoryDTO s) {
        if (s != null && s.getProjectId() != null) {
            sessions.computeIfAbsent(s.getProjectId(), k -> new ArrayList<>()).add(s);
        }
    }

    @Override
    public List<AiSessionHistoryDTO> getSessionHistories(String projectId) {
        return sessions.getOrDefault(projectId, new ArrayList<>());
    }

    @Override
    public void saveTrackPrompts(List<AiTrackPromptDTO> list) {
        if (list == null || list.isEmpty()) return;
        String projId = list.get(0).getProjectId();
        prompts.put(projId, new ArrayList<>(list));
    }

    @Override
    public List<AiTrackPromptDTO> getTrackPromptsByProjectId(String projectId) {
        return prompts.getOrDefault(projectId, new ArrayList<>());
    }

    @Override
    public void saveRenderedAsset(AiRenderedAssetDTO asset) {
        if (asset != null && asset.getProjectId() != null) {
            assets.computeIfAbsent(asset.getProjectId(), k -> new ArrayList<>()).add(asset);
        }
    }

    @Override
    public List<AiRenderedAssetDTO> getRenderedAssetsByProjectId(String projectId) {
        return assets.getOrDefault(projectId, new ArrayList<>());
    }

    @Override
    public boolean deleteProject(String id) {
        sessions.remove(id);
        prompts.remove(id);
        assets.remove(id);
        return projects.remove(id) != null;
    }
}
