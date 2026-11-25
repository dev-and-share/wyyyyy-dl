package com.wyy.controller;

import com.wyy.dao.IAiStudioRepository;
import com.wyy.enums.CommonRespInfo;
import com.wyy.models.common.RespEntity;
import com.wyy.models.dtos.AiProjectDTO;
import com.wyy.models.dtos.AiRenderedAssetDTO;
import com.wyy.models.dtos.AiSongAnalysisDTO;
import com.wyy.service.AiAssetScanSyncService;
import com.wyy.service.AiPromptMatrixService;
import com.wyy.service.AiSongAnalysisService;
import com.wyy.utils.AudioStreamUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.util.List;
import java.util.Map;

/**
 * 🎨 AI 音乐创作工坊与资产管理控制器 (/v3/ai/* 规范)
 */
@RestController
@Slf4j
@RequestMapping("/v3/ai")
public class AiStudioController {

    @Autowired
    private AiSongAnalysisService songAnalysisService;

    @Autowired
    private AiPromptMatrixService promptMatrixService;

    @Autowired
    private AiAssetScanSyncService scanSyncService;

    @Autowired
    private IAiStudioRepository aiStudioRepository;

    @Data
    public static class GenerateRequest {
        private String songId;
        private String title;
        private String artist;
        private String engineType; // LOCAL_AGY, NEW_API
        private List<String> selectedModels;
        private List<String> selectedVersions;
    }

    @Data
    public static class RefineRequest {
        private String projectId;
        private String versionLabel; // V1_FIDELITY, V2_FUSION, V3_EMOTIONAL
        private String instruction;
        private String engineType;
    }

    /**
     * 1. 逆向分析原曲特征
     */
    @GetMapping("/analyze")
    public RespEntity<AiSongAnalysisDTO> analyzeSong(
            @RequestParam("songId") String songId,
            @RequestParam(value = "title", required = false) String title,
            @RequestParam(value = "artist", required = false) String artist,
            @RequestParam(value = "engineType", required = false) String engineType,
            @RequestParam(value = "forceRefresh", defaultValue = "false") boolean forceRefresh) {
        try {
            AiSongAnalysisDTO dto = songAnalysisService.analyzeSong(songId, title, artist, engineType, forceRefresh);
            return RespEntity.apply(CommonRespInfo.SUCCESS.getCode(), "分析完成", dto);
        } catch (Exception e) {
            log.error("❌ 原曲逆向解构失败: songId={}", songId, e);
            return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR.getCode(), "分析失败: " + e.getMessage(), null);
        }
    }

    /**
     * 2. 创建工程并生成定制 Prompt 矩阵 (支持模型与版本自由组合)
     */
    @PostMapping("/generate")
    public RespEntity<AiProjectDTO> generateMatrix(@RequestBody GenerateRequest req) {
        if (req == null || StringUtils.isBlank(req.getSongId())) {
            return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR.getCode(), "缺少必须参数 songId", null);
        }
        try {
            AiProjectDTO project = promptMatrixService.createProjectAndGenerateMatrix(
                    req.getSongId(), req.getTitle(), req.getArtist(), req.getEngineType(),
                    req.getSelectedModels(), req.getSelectedVersions());
            return RespEntity.apply(CommonRespInfo.SUCCESS.getCode(), "生成曲目规划矩阵成功", project);
        } catch (Exception e) {
            log.error("❌ 生成 Prompt 矩阵失败", e);
            return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR.getCode(), "生成失败: " + e.getMessage(), null);
        }
    }

    /**
     * 3. 多轮对话追问调优 (支持按版本独立 Session 追问)
     */
    @PostMapping("/refine")
    public RespEntity<AiProjectDTO> refineProject(@RequestBody RefineRequest req) {
        if (req == null || StringUtils.isBlank(req.getProjectId()) || StringUtils.isBlank(req.getInstruction())) {
            return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR.getCode(), "缺少 projectId 或 instruction", null);
        }
        try {
            AiProjectDTO updated = promptMatrixService.refineProject(
                    req.getProjectId(), req.getVersionLabel(), req.getInstruction(), req.getEngineType());
            return RespEntity.apply(CommonRespInfo.SUCCESS.getCode(), "调优完成", updated);
        } catch (Exception e) {
            log.error("❌ 调优工程失败: projectId={}, version={}", req.getProjectId(), req.getVersionLabel(), e);
            return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR.getCode(), "调优失败: " + e.getMessage(), null);
        }
    }

    /**
     * 4. 获取工程列表
     */
    @GetMapping("/projects")
    public RespEntity<List<AiProjectDTO>> listProjects(@RequestParam(value = "limit", defaultValue = "50") int limit) {
        try {
            List<AiProjectDTO> list = aiStudioRepository.listProjects(limit);
            return RespEntity.apply(CommonRespInfo.SUCCESS.getCode(), "查询成功", list);
        } catch (Exception e) {
            log.error("❌ 查询工程列表失败", e);
            return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR.getCode(), "查询失败: " + e.getMessage(), null);
        }
    }

    /**
     * 5. 获取工程详情
     */
    @GetMapping("/project/{id}")
    public RespEntity<AiProjectDTO> getProject(@PathVariable("id") String id) {
        try {
            AiProjectDTO p = aiStudioRepository.getProjectById(id);
            if (p == null) {
                return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR.getCode(), "未找到工程", null);
            }
            return RespEntity.apply(CommonRespInfo.SUCCESS.getCode(), "查询成功", p);
        } catch (Exception e) {
            log.error("❌ 查询工程详情失败: id={}", id, e);
            return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR.getCode(), "查询失败: " + e.getMessage(), null);
        }
    }

    /**
     * 5.1 按原曲 ID 获取最近一次保存的工程 (用于再次打开工作台自动恢复)
     */
    @GetMapping("/project/by-song/{songId}")
    public RespEntity<AiProjectDTO> getLatestProjectBySong(@PathVariable("songId") String songId) {
        try {
            AiProjectDTO p = aiStudioRepository.getLatestProjectBySongId(songId);
            return RespEntity.apply(CommonRespInfo.SUCCESS.getCode(), p != null ? "查询成功" : "暂无历史工程", p);
        } catch (Exception e) {
            log.error("❌ 按曲目查询历史工程失败: songId={}", songId, e);
            return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR.getCode(), "查询失败: " + e.getMessage(), null);
        }
    }

    /**
     * 6. 扫描并同步渲染音频资产
     */
    @PostMapping("/project/{id}/sync")
    public RespEntity<List<AiRenderedAssetDTO>> syncAssets(@PathVariable("id") String id) {
        try {
            List<AiRenderedAssetDTO> assets = scanSyncService.scanAndSyncProject(id);
            return RespEntity.apply(CommonRespInfo.SUCCESS.getCode(), "扫描同步完成", assets);
        } catch (Exception e) {
            log.error("❌ 扫描同步失败: id={}", id, e);
            return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR.getCode(), "扫描失败: " + e.getMessage(), null);
        }
    }

    /**
     * 6.1 全量扫描所有工程的 AI 渲染资产
     */
    @PostMapping("/sync-all")
    public RespEntity<Map<String, Object>> syncAllProjects() {
        try {
            Map<String, Object> result = scanSyncService.scanAndSyncAllProjects();
            return RespEntity.apply(CommonRespInfo.SUCCESS.getCode(), "全量扫描同步完成", result);
        } catch (Exception e) {
            log.error("❌ 全量扫描同步失败", e);
            return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR.getCode(), "全量扫描失败: " + e.getMessage(), null);
        }
    }

    /**
     * 7. 删除工程
     */
    @DeleteMapping("/project/{id}")
    public RespEntity<Boolean> deleteProject(@PathVariable("id") String id) {
        try {
            boolean ok = aiStudioRepository.deleteProject(id);
            return RespEntity.apply(CommonRespInfo.SUCCESS.getCode(), "删除成功", ok);
        } catch (Exception e) {
            log.error("❌ 删除工程失败: id={}", id, e);
            return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR.getCode(), "删除失败: " + e.getMessage(), null);
        }
    }

    /**
     * 8. 流式播放 AI 生成的渲染母盘音频
     */
    @GetMapping("/audio/{assetId}")
    public void streamRenderedAudio(
            @PathVariable("assetId") String assetId,
            HttpServletRequest request,
            HttpServletResponse response) {
        AudioStreamUtil.applyCorsHeaders(response);
        if (AudioStreamUtil.isPreflight(request)) {
            response.setStatus(HttpServletResponse.SC_NO_CONTENT);
            return;
        }

        try {
            // assetId 命名格式: asset_{projectId}_{cleanName}
            // 遍历查找该 asset
            List<AiProjectDTO> projects = aiStudioRepository.listProjects(100);
            File audioFile = null;
            for (AiProjectDTO p : projects) {
                List<AiRenderedAssetDTO> assets = aiStudioRepository.getRenderedAssetsByProjectId(p.getId());
                for (AiRenderedAssetDTO a : assets) {
                    if (assetId.equals(a.getId()) && StringUtils.isNotBlank(a.getAudioPath())) {
                        File f = new File(a.getAudioPath());
                        if (f.exists() && f.isFile()) {
                            audioFile = f;
                            break;
                        }
                    }
                }
                if (audioFile != null) break;
            }

            if (audioFile == null || !audioFile.exists()) {
                response.sendError(HttpServletResponse.SC_NOT_FOUND, "AI 音频文件不存在");
                return;
            }

            AudioStreamUtil.streamLocalFile(audioFile, request, response);
        } catch (Exception e) {
            log.error("❌ 流式传输 AI 音频异常: assetId={}", assetId, e);
            try {
                response.sendError(HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "传输失败");
            } catch (Exception ignored) {
            }
        }
    }
}
