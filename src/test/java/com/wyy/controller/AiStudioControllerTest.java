package com.wyy.controller;

import com.wyy.dao.IAiStudioRepository;
import com.wyy.models.dtos.AiProjectDTO;
import com.wyy.models.dtos.AiRenderedAssetDTO;
import com.wyy.models.dtos.AiSongAnalysisDTO;
import com.wyy.service.AiAssetScanSyncService;
import com.wyy.service.AiPromptMatrixService;
import com.wyy.service.AiSongAnalysisService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AiStudioController.class)
@DisplayName("🎨 AI 创作工坊控制器 AiStudioController 单元测试")
public class AiStudioControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AiSongAnalysisService songAnalysisService;

    @MockBean
    private AiPromptMatrixService promptMatrixService;

    @MockBean
    private AiAssetScanSyncService scanSyncService;

    @MockBean
    private IAiStudioRepository aiStudioRepository;

    @Test
    @DisplayName("GET /v3/ai/analyze 成功逆向解构原曲")
    void testAnalyzeSong() throws Exception {
        AiSongAnalysisDTO dto = AiSongAnalysisDTO.builder()
                .refSongId("186016")
                .title("晴天")
                .artist("周杰伦")
                .genre("03_mandopop_emotional_ballad")
                .estimatedBpm(72)
                .build();

        Mockito.when(songAnalysisService.analyzeSong(eq("186016"), any(), any(), any(), eq(false))).thenReturn(dto);

        mockMvc.perform(get("/v3/ai/analyze")
                        .param("songId", "186016")
                        .param("title", "晴天")
                        .param("artist", "周杰伦"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("000000"))
                .andExpect(jsonPath("$.data.title").value("晴天"))
                .andExpect(jsonPath("$.data.genre").value("03_mandopop_emotional_ballad"));
    }

    @Test
    @DisplayName("GET /v3/ai/analyze?forceRefresh=true 强制重新提取 (Retry)")
    void testAnalyzeSongForceRefresh() throws Exception {
        AiSongAnalysisDTO dto = AiSongAnalysisDTO.builder()
                .refSongId("186016")
                .title("晴天")
                .estimatedBpm(104)
                .build();

        Mockito.when(songAnalysisService.analyzeSong(eq("186016"), any(), any(), any(), eq(true))).thenReturn(dto);

        mockMvc.perform(get("/v3/ai/analyze")
                        .param("songId", "186016")
                        .param("title", "晴天")
                        .param("forceRefresh", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("000000"))
                .andExpect(jsonPath("$.data.estimatedBpm").value(104));
    }

    @Test
    @DisplayName("GET /v3/ai/project/by-song/{songId} 按原曲 ID 恢复最新历史工程")
    void testGetLatestProjectBySong() throws Exception {
        AiProjectDTO p = AiProjectDTO.builder()
                .id("aip_restored_001")
                .refSongId("186016")
                .refSongTitle("晴天")
                .build();
        Mockito.when(aiStudioRepository.getLatestProjectBySongId("186016")).thenReturn(p);

        mockMvc.perform(get("/v3/ai/project/by-song/186016"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("000000"))
                .andExpect(jsonPath("$.data.id").value("aip_restored_001"));
    }

    @Test
    @DisplayName("POST /v3/ai/generate 生成动态 Prompt 矩阵 (多选模型与版本)")
    void testGenerateMatrix() throws Exception {
        AiProjectDTO project = AiProjectDTO.builder()
                .id("aip_test_001")
                .refSongId("186016")
                .refSongTitle("晴天")
                .status("PROMPT_READY")
                .selectedModels(Arrays.asList("YuE2-3B", "ACE-Step-1.5"))
                .selectedVersions(Arrays.asList("V1_FIDELITY", "V2_FUSION"))
                .projectDir("/path/to/__AI__/projects/aip_test_001")
                .build();

        Mockito.when(promptMatrixService.createProjectAndGenerateMatrix(
                eq("186016"), eq("晴天"), eq("周杰伦"), eq("LOCAL_AGY"),
                eq(Arrays.asList("YuE2-3B", "ACE-Step-1.5")),
                eq(Arrays.asList("V1_FIDELITY", "V2_FUSION"))
        )).thenReturn(project);

        String jsonBody = "{\"songId\":\"186016\",\"title\":\"晴天\",\"artist\":\"周杰伦\",\"engineType\":\"LOCAL_AGY\"," +
                "\"selectedModels\":[\"YuE2-3B\",\"ACE-Step-1.5\"],\"selectedVersions\":[\"V1_FIDELITY\",\"V2_FUSION\"]}";

        mockMvc.perform(post("/v3/ai/generate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("000000"))
                .andExpect(jsonPath("$.data.id").value("aip_test_001"))
                .andExpect(jsonPath("$.data.selectedModels[0]").value("YuE2-3B"))
                .andExpect(jsonPath("$.data.status").value("PROMPT_READY"));
    }

    @Test
    @DisplayName("POST /v3/ai/refine 持续追问调优 (带独立版本会话 versionLabel)")
    void testRefineProject() throws Exception {
        AiProjectDTO updated = AiProjectDTO.builder()
                .id("aip_test_001")
                .status("PROMPT_READY")
                .analysisReport("更新报告")
                .lastAssistantMessage("已为您在版本1中延长歌词。")
                .build();

        Mockito.when(promptMatrixService.refineProject(eq("aip_test_001"), eq("V1_FIDELITY"), eq("延长歌词"), eq("LOCAL_AGY")))
                .thenReturn(updated);

        String jsonBody = "{\"projectId\":\"aip_test_001\",\"versionLabel\":\"V1_FIDELITY\",\"instruction\":\"延长歌词\",\"engineType\":\"LOCAL_AGY\"}";

        mockMvc.perform(post("/v3/ai/refine")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("000000"))
                .andExpect(jsonPath("$.data.analysisReport").value("更新报告"))
                .andExpect(jsonPath("$.data.lastAssistantMessage").value("已为您在版本1中延长歌词。"));
    }

    @Test
    @DisplayName("POST /v3/ai/project/{id}/sync 触发扫描同步已渲染音频")
    void testSyncAssets() throws Exception {
        AiRenderedAssetDTO asset = AiRenderedAssetDTO.builder()
                .id("asset_1")
                .projectId("aip_test_001")
                .spectralEntropy(6.9)
                .rmsStd(0.08)
                .qaPassed(1)
                .build();

        Mockito.when(scanSyncService.scanAndSyncProject(eq("aip_test_001")))
                .thenReturn(Collections.singletonList(asset));

        mockMvc.perform(post("/v3/ai/project/aip_test_001/sync"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("000000"))
                .andExpect(jsonPath("$.data[0].qaPassed").value(1));
    }

    @Test
    @DisplayName("POST /v3/ai/sync-all 全量扫描同步所有工程的 AI 渲染资产")
    void testSyncAllProjects() throws Exception {
        Map<String, Object> summary = new HashMap<>();
        summary.put("totalProjects", 2);
        summary.put("totalSynced", 6);

        Mockito.when(scanSyncService.scanAndSyncAllProjects()).thenReturn(summary);

        mockMvc.perform(post("/v3/ai/sync-all"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("000000"))
                .andExpect(jsonPath("$.data.totalProjects").value(2))
                .andExpect(jsonPath("$.data.totalSynced").value(6));
    }

    @Test
    @DisplayName("GET /v3/ai/projects 查询工程列表")
    void testListProjects() throws Exception {
        AiProjectDTO p = AiProjectDTO.builder()
                .id("aip_001")
                .refSongTitle("晴天")
                .build();
        Mockito.when(aiStudioRepository.listProjects(anyInt())).thenReturn(Collections.singletonList(p));

        mockMvc.perform(get("/v3/ai/projects"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("000000"))
                .andExpect(jsonPath("$.data[0].id").value("aip_001"));
    }

    @Test
    @DisplayName("POST /v3/ai/project/{id}/version/{version}/models 动态切换本方案应用模型")
    void testUpdateVersionModels() throws Exception {
        AiProjectDTO updated = AiProjectDTO.builder()
                .id("aip_001")
                .status("PROMPT_READY")
                .build();
        Mockito.when(promptMatrixService.updateVersionModels(eq("aip_001"), eq("V1_FIDELITY"), eq(Arrays.asList("YuE2-3B", "MiniMax-Music3"))))
                .thenReturn(updated);

        mockMvc.perform(post("/v3/ai/project/aip_001/version/V1_FIDELITY/models")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"models\":[\"YuE2-3B\",\"MiniMax-Music3\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("000000"))
                .andExpect(jsonPath("$.data.id").value("aip_001"));
    }

    @Test
    @DisplayName("POST /v3/ai/refine-model 单模型专属 Prompt 微调")
    void testRefineModelPrompt() throws Exception {
        AiProjectDTO updated = AiProjectDTO.builder()
                .id("aip_001")
                .lastAssistantMessage("已针对模型完成微调")
                .build();
        Mockito.when(promptMatrixService.refineModelPrompt(eq("aip_001"), eq("trk_1"), eq("加强吉他"), eq("LOCAL_AGY")))
                .thenReturn(updated);

        mockMvc.perform(post("/v3/ai/refine-model")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"projectId\":\"aip_001\",\"trackPromptId\":\"trk_1\",\"instruction\":\"加强吉他\",\"engineType\":\"LOCAL_AGY\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("000000"))
                .andExpect(jsonPath("$.data.lastAssistantMessage").value("已针对模型完成微调"));
    }

    @Test
    @DisplayName("POST /v3/ai/project/{id}/queue-gpu 加入 GPU 批量生产等待队列")
    void testQueueForGpu() throws Exception {
        AiProjectDTO queued = AiProjectDTO.builder()
                .id("aip_001")
                .status("QUEUED_FOR_GPU")
                .build();
        Mockito.when(aiStudioRepository.getProjectById("aip_001")).thenReturn(queued);

        mockMvc.perform(post("/v3/ai/project/aip_001/queue-gpu"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("000000"))
                .andExpect(jsonPath("$.data.status").value("QUEUED_FOR_GPU"));
    }

    @Test
    @DisplayName("DELETE /v3/ai/project/{id} 删除工程")
    void testDeleteProject() throws Exception {
        Mockito.when(aiStudioRepository.deleteProject("aip_001")).thenReturn(true);

        mockMvc.perform(delete("/v3/ai/project/aip_001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("000000"))
                .andExpect(jsonPath("$.data").value(true));
    }
}
