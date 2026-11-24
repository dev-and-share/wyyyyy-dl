package com.wyy.service;

import com.wyy.dao.impl.InMemoryAiStudioRepository;
import com.wyy.models.dtos.AiProjectDTO;
import com.wyy.models.dtos.AiRenderedAssetDTO;
import com.wyy.models.dtos.AiSongAnalysisDTO;
import com.wyy.models.dtos.AiTrackPromptDTO;
import com.wyy.service.ai.AgyCliEngine;
import com.wyy.service.ai.AiEngineResponse;
import com.wyy.service.ai.AiEngineRouter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.File;
import java.io.FileWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@DisplayName("🎹 AI 创作工坊与三大模型 Prompt 矩阵闭环集成测试")
public class AiStudioIntegrationTest {

    @TempDir
    Path tempDir;

    private InMemoryAiStudioRepository repository;
    private AiSongAnalysisService songAnalysisService;
    private AiPromptMatrixService promptMatrixService;
    private AiAssetScanSyncService scanSyncService;
    private AiEngineRouter engineRouter;

    @Mock
    private NeteaseAPIService neteaseAPIService;

    @Mock
    private AgyCliEngine agyCliEngine;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        repository = new InMemoryAiStudioRepository();

        songAnalysisService = new AiSongAnalysisService();
        ReflectionTestUtils.setField(songAnalysisService, "neteaseAPIService", neteaseAPIService);

        engineRouter = new AiEngineRouter();
        ReflectionTestUtils.setField(engineRouter, "agyCliEngine", agyCliEngine);
        ReflectionTestUtils.setField(engineRouter, "defaultEngineType", "LOCAL_AGY");

        promptMatrixService = new AiPromptMatrixService();
        ReflectionTestUtils.setField(promptMatrixService, "songAnalysisService", songAnalysisService);
        ReflectionTestUtils.setField(promptMatrixService, "engineRouter", engineRouter);
        ReflectionTestUtils.setField(promptMatrixService, "aiStudioRepository", repository);
        ReflectionTestUtils.setField(promptMatrixService, "aiStorageBasePath", tempDir.toAbsolutePath().toString());

        scanSyncService = new AiAssetScanSyncService();
        ReflectionTestUtils.setField(scanSyncService, "aiStudioRepository", repository);
    }

    @Test
    @DisplayName("测试三大模型最高峰战力 Prompt 矩阵生成与本地落盘")
    void testPromptMatrixGenerationAndDiskPersistence() {
        when(agyCliEngine.getEngineType()).thenReturn("LOCAL_AGY");
        when(agyCliEngine.execute(anyString(), any(), anyString())).thenReturn(
                AiEngineResponse.builder()
                        .engineType("LOCAL_AGY")
                        .conversationId("conv_test_123")
                        .responseText("乐理分析：已完成 3 创意版本构建，压榨三大模型最高峰战力。")
                        .success(true)
                        .durationMs(250L)
                        .build()
        );

        AiProjectDTO project = promptMatrixService.createProjectAndGenerateMatrix(
                "1001", "夜曲 · 经典", "周杰伦", "LOCAL_AGY"
        );

        assertNotNull(project);
        assertEquals("PROMPT_READY", project.getStatus());
        assertNotNull(project.getProjectDir());

        // 验证 9 首曲目规划矩阵 (3 创意版本 x 3 大模型)
        List<AiTrackPromptDTO> prompts = repository.getTrackPromptsByProjectId(project.getId());
        assertEquals(9, prompts.size(), "必须生成完整的 3 版本 x 3 模型 = 9 首曲目规划");

        long yue2Count = prompts.stream().filter(p -> p.getModelName().equals("YuE2-3B")).count();
        long minimaxCount = prompts.stream().filter(p -> p.getModelName().equals("MiniMax-Music3")).count();
        long acestepCount = prompts.stream().filter(p -> p.getModelName().equals("ACE-Step-1.5")).count();

        assertEquals(3, yue2Count, "YuE2-3B 应有 3 个定制版本");
        assertEquals(3, minimaxCount, "MiniMax-Music3 应有 3 个定制版本");
        assertEquals(3, acestepCount, "ACE-Step-1.5 应有 3 个定制版本");

        // 验证专属战力提示词规范
        AiTrackPromptDTO yuePrompt = prompts.stream().filter(p -> p.getModelName().equals("YuE2-3B")).findFirst().orElseThrow();
        assertTrue(yuePrompt.getPromptContent().contains("COT:"), "YuE2 必须显式压榨分乐章思维链 COT");
        assertTrue(yuePrompt.getLyricsPlan().toLowerCase().contains("[intro"), "YuE2 必须规划段落乐章标签");

        AiTrackPromptDTO minimaxPrompt = prompts.stream().filter(p -> p.getModelName().equals("MiniMax-Music3")).findFirst().orElseThrow();
        assertTrue(minimaxPrompt.getPromptContent().contains("Prompt:"), "MiniMax 必须遵循官方生产级 Prompt 规范");
        assertTrue(minimaxPrompt.getLyricsPlan().toLowerCase().contains("[intro]") || minimaxPrompt.getLyricsPlan().toLowerCase().contains("[intro"),
                "MiniMax 必须具有标准声学段落标记");

        AiTrackPromptDTO acePrompt = prompts.stream().filter(p -> p.getModelName().equals("ACE-Step-1.5")).findFirst().orElseThrow();
        assertTrue(acePrompt.getPromptContent().contains("[Global Metadata]"), "ACE-Step 必须包含 Global Metadata");
        assertTrue(acePrompt.getPromptContent().contains("BPM:"), "ACE-Step 必须包含 BPM 明确控制");

        // 验证物理文件落盘规范
        File pDir = new File(project.getProjectDir());
        assertTrue(pDir.exists() && pDir.isDirectory());
        assertTrue(new File(pDir, "reference_song_info.json").exists(), "必须存在原曲解构 JSON");
        assertTrue(new File(pDir, "analysis_report.md").exists(), "必须存在分析报告 MD");
        assertTrue(new File(pDir, "task_manifest.json").exists(), "必须存在供 Colab 消费的 task_manifest.json");
        assertTrue(new File(pDir, "colab_batch_runner.py").exists(), "必须生成 Colab A100 一键批处理执行脚本");
        assertTrue(new File(pDir, "renders").exists(), "必须创建 renders 离线渲染输出目录");

        File promptsDir = new File(pDir, "prompts");
        assertTrue(promptsDir.exists());
        File[] promptFiles = promptsDir.listFiles((dir, name) -> name.endsWith(".md"));
        assertNotNull(promptFiles);
        assertEquals(9, promptFiles.length, "prompts 目录下必须存在 9 份独立的母盘技术规范 MD");
    }

    @Test
    @DisplayName("测试离线渲染音频回扫 (Scan & Sync) 与生物质检合规认证")
    void testScanAndSyncRenderedAssets() throws Exception {
        // 先构建工程
        when(agyCliEngine.getEngineType()).thenReturn("LOCAL_AGY");
        when(agyCliEngine.execute(anyString(), any(), anyString())).thenReturn(
                AiEngineResponse.builder().engineType("LOCAL_AGY").success(true).responseText("ok").build()
        );

        AiProjectDTO project = promptMatrixService.createProjectAndGenerateMatrix(
                "2002", "晴天", "周杰伦", "LOCAL_AGY"
        );

        File rendersDir = new File(project.getProjectDir(), "renders");
        // 模拟 Colab 渲染产出 9 首音频与质检报告
        String qaJson = "[\n" +
                "  {\"file\": \"track_v1_fidelity_yue2.mp3\", \"spectral_entropy\": 6.88, \"rms_std\": 0.082, \"qa_passed\": true},\n" +
                "  {\"file\": \"track_v1_fidelity_minimax.mp3\", \"spectral_entropy\": 7.45, \"rms_std\": 0.091, \"qa_passed\": true},\n" +
                "  {\"file\": \"track_v1_fidelity_acestep.mp3\", \"spectral_entropy\": 7.02, \"rms_std\": 0.086, \"qa_passed\": true}\n" +
                "]";

        File qaFile = new File(rendersDir, "audio_authenticity_report.json");
        try (FileWriter fw = new FileWriter(qaFile, StandardCharsets.UTF_8)) {
            fw.write(qaJson);
        }

        // 模拟生成 3 个 mp3 占位文件
        new File(rendersDir, "track_v1_fidelity_yue2.mp3").createNewFile();
        new File(rendersDir, "track_v1_fidelity_minimax.mp3").createNewFile();
        new File(rendersDir, "track_v1_fidelity_acestep.mp3").createNewFile();

        // 执行扫描同步
        List<AiRenderedAssetDTO> assets = scanSyncService.scanAndSyncProject(project.getId());
        assertEquals(3, assets.size(), "应成功扫描出 3 首新音频资产");

        AiRenderedAssetDTO yueAsset = assets.stream().filter(a -> a.getAudioPath().contains("yue2")).findFirst().orElseThrow();
        assertEquals(1, yueAsset.getQaPassed(), "生物特征质检应判定为合格 (PASS)");
        assertEquals(6.88, yueAsset.getSpectralEntropy(), 0.01);
        assertEquals(0.082, yueAsset.getRmsStd(), 0.001);
    }
}
