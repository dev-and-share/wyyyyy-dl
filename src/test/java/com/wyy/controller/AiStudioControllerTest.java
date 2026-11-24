package com.wyy.controller;

import com.wyy.dao.IAiStudioRepository;
import com.wyy.models.dtos.AiProjectDTO;
import com.wyy.models.dtos.AiRenderedAssetDTO;
import com.wyy.models.dtos.AiSongAnalysisDTO;
import com.wyy.models.dtos.AiTrackPromptDTO;
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

import java.util.Collections;
import java.util.List;

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

        Mockito.when(songAnalysisService.analyzeSong(eq("186016"), any(), any())).thenReturn(dto);

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
    @DisplayName("POST /v3/ai/generate 生成 9 首 Prompt 矩阵")
    void testGenerateMatrix() throws Exception {
        AiProjectDTO project = AiProjectDTO.builder()
                .id("aip_test_001")
                .refSongId("186016")
                .refSongTitle("晴天")
                .status("PROMPT_READY")
                .projectDir("/path/to/__AI__/projects/aip_test_001")
                .build();

        Mockito.when(promptMatrixService.createProjectAndGenerateMatrix(anyString(), any(), any(), anyString()))
                .thenReturn(project);

        String jsonBody = "{\"songId\":\"186016\",\"title\":\"晴天\",\"artist\":\"周杰伦\",\"engineType\":\"LOCAL_AGY\"}";

        mockMvc.perform(post("/v3/ai/generate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("000000"))
                .andExpect(jsonPath("$.data.id").value("aip_test_001"))
                .andExpect(jsonPath("$.data.status").value("PROMPT_READY"));
    }

    @Test
    @DisplayName("POST /v3/ai/refine 持续追问调优")
    void testRefineProject() throws Exception {
        AiProjectDTO updated = AiProjectDTO.builder()
                .id("aip_test_001")
                .status("PROMPT_READY")
                .analysisReport("更新报告")
                .build();

        Mockito.when(promptMatrixService.refineProject(eq("aip_test_001"), anyString(), any()))
                .thenReturn(updated);

        String jsonBody = "{\"projectId\":\"aip_test_001\",\"instruction\":\"节奏放慢一点\",\"engineType\":\"LOCAL_AGY\"}";

        mockMvc.perform(post("/v3/ai/refine")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("000000"))
                .andExpect(jsonPath("$.data.analysisReport").value("更新报告"));
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
}
