package com.wyy.service;

import com.wyy.dao.IAiStudioRepository;
import com.wyy.dao.impl.InMemoryAiStudioRepository;
import com.wyy.models.dtos.AiProjectDTO;
import com.wyy.models.dtos.AiSongAnalysisDTO;
import com.wyy.models.dtos.AiTrackPromptDTO;
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
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

@DisplayName("🎹 AI 创作工坊定制 Prompt 矩阵与独立会话单元测试")
class AiPromptMatrixServiceTest {

    @InjectMocks
    private AiPromptMatrixService promptMatrixService;

    @Mock
    private AiSongAnalysisService songAnalysisService;

    @Mock
    private AiEngineRouter engineRouter;

    private IAiStudioRepository aiStudioRepository;

    @TempDir
    File tempFolder;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        aiStudioRepository = new InMemoryAiStudioRepository();
        ReflectionTestUtils.setField(promptMatrixService, "aiStudioRepository", aiStudioRepository);
        ReflectionTestUtils.setField(promptMatrixService, "aiStorageBasePath", tempFolder.getAbsolutePath());

        AiSongAnalysisDTO mockAnalysis = AiSongAnalysisDTO.builder()
                .refSongId("186016")
                .title("晴天")
                .artist("周杰伦")
                .genre("03_campus_nostalgia_ballad")
                .estimatedKey("G Major")
                .estimatedBpm(104)
                .mood("青涩初恋、遗憾回忆")
                .instrumentation("木吉他分解和弦、大提琴独奏")
                .analysisSummary("晴天分析总结")
                .build();

        when(songAnalysisService.analyzeSong(anyString(), any(), any(), anyString()))
                .thenReturn(mockAnalysis);

        when(engineRouter.execute(anyString(), any(), anyString(), anyString())).thenReturn(
                AiEngineResponse.builder()
                        .engineType("LOCAL_AGY")
                        .conversationId("conv_session_test")
                        .responseText("已成功规划版本专属乐理与长篇歌词")
                        .success(true)
                        .durationMs(300L)
                        .build()
        );
    }

    @Test
    @DisplayName("测试自由组合参数：选 2 模型 × 2 版本 = 精确产出 4 首音轨")
    void testCreateProjectDynamicCombination_2x2() {
        List<String> models = List.of("YuE2-3B", "ACE-Step-1.5");
        List<String> versions = List.of("V1_FIDELITY", "V2_FUSION");

        AiProjectDTO project = promptMatrixService.createProjectAndGenerateMatrix(
                "186016", "晴天", "周杰伦", "LOCAL_AGY", models, versions
        );

        assertNotNull(project);
        List<AiTrackPromptDTO> prompts = aiStudioRepository.getTrackPromptsByProjectId(project.getId());
        assertEquals(4, prompts.size(), "2 模型 × 2 版本必须精确生成 4 首曲目规划");

        long yueCount = prompts.stream().filter(p -> p.getModelName().equals("YuE2-3B")).count();
        long aceCount = prompts.stream().filter(p -> p.getModelName().equals("ACE-Step-1.5")).count();
        long v1Count = prompts.stream().filter(p -> p.getVersionLabel().equals("V1_FIDELITY")).count();
        long v2Count = prompts.stream().filter(p -> p.getVersionLabel().equals("V2_FUSION")).count();

        assertEquals(2, yueCount);
        assertEquals(2, aceCount);
        assertEquals(2, v1Count);
        assertEquals(2, v2Count);
    }

    @Test
    @DisplayName("测试三大创意版本拥有 3 套截然不同的独立长篇歌词")
    void testDistinctLyricsAcrossThreeVersions() {
        AiProjectDTO project = promptMatrixService.createProjectAndGenerateMatrix(
                "186016", "晴天", "周杰伦", "LOCAL_AGY"
        );

        List<AiTrackPromptDTO> prompts = aiStudioRepository.getTrackPromptsByProjectId(project.getId());
        assertEquals(9, prompts.size());

        AiTrackPromptDTO v1Track = prompts.stream().filter(p -> p.getVersionLabel().equals("V1_FIDELITY")).findFirst().orElseThrow();
        AiTrackPromptDTO v2Track = prompts.stream().filter(p -> p.getVersionLabel().equals("V2_FUSION")).findFirst().orElseThrow();
        AiTrackPromptDTO v3Track = prompts.stream().filter(p -> p.getVersionLabel().equals("V3_EMOTIONAL")).findFirst().orElseThrow();

        // 验证三套长歌词内容完全不同且非空
        assertNotEquals(v1Track.getLyricsPlan(), v2Track.getLyricsPlan(), "版本1与版本2歌词必须完全独立");
        assertNotEquals(v2Track.getLyricsPlan(), v3Track.getLyricsPlan(), "版本2与版本3歌词必须完全独立");
        assertNotEquals(v1Track.getLyricsPlan(), v3Track.getLyricsPlan(), "版本1与版本3歌词必须完全独立");

        // 验证各自的题材意象
        assertTrue(v1Track.getLyricsPlan().contains("香樟") || v1Track.getLyricsPlan().contains("操场"), "V1 包含青春怀旧意象");
        assertTrue(v2Track.getLyricsPlan().contains("赛博") || v2Track.getLyricsPlan().contains("代码"), "V2 包含赛博跨界意象");
        assertTrue(v3Track.getLyricsPlan().contains("独白") || v3Track.getLyricsPlan().contains("叹息"), "V3 包含微表情独白意象");
    }

    @Test
    @DisplayName("测试追问【延长歌词】指令真实扩展歌词并更新音轨与会话历史")
    void testRefineProject_ExtendsLyrics() {
        AiProjectDTO project = promptMatrixService.createProjectAndGenerateMatrix(
                "186016", "晴天", "周杰伦", "LOCAL_AGY"
        );

        when(engineRouter.execute(anyString(), any(), anyString(), anyString())).thenReturn(
                AiEngineResponse.builder()
                        .engineType("LOCAL_AGY")
                        .conversationId("conv_refined_session")
                        .responseText("乐理总监已为您在 Verse 2 加入周式切分说唱并扩充了长篇乐章")
                        .success(true)
                        .durationMs(400L)
                        .build()
        );

        AiProjectDTO refined = promptMatrixService.refineProject(
                project.getId(), "V1_FIDELITY", "延长歌词并增加切分段落", "LOCAL_AGY"
        );

        assertNotNull(refined);
        assertEquals("乐理总监已为您在 Verse 2 加入周式切分说唱并扩充了长篇乐章", refined.getLastAssistantMessage());

        List<AiTrackPromptDTO> updatedPrompts = aiStudioRepository.getTrackPromptsByProjectId(project.getId());
        AiTrackPromptDTO refinedV1 = updatedPrompts.stream().filter(p -> p.getVersionLabel().equals("V1_FIDELITY")).findFirst().orElseThrow();
        assertTrue(refinedV1.getLyricsPlan().contains("[Refined Verse - 追问深化段落]"), "歌词计划必须真实追加深化乐章");
        assertTrue(refinedV1.getPromptContent().contains("Refined Instruction"), "Prompt 必须追加制作人追问指令");
    }

    @Test
    @DisplayName("测试追问时引擎失败时必须抛出异常而不是假成功")
    void testRefineProject_FailureThrowsException() {
        AiProjectDTO project = promptMatrixService.createProjectAndGenerateMatrix(
                "186016", "晴天", "周杰伦", "LOCAL_AGY"
        );

        when(engineRouter.execute(anyString(), any(), anyString(), anyString())).thenReturn(
                AiEngineResponse.builder()
                        .engineType("LOCAL_AGY")
                        .success(false)
                        .errorMsg("agy 执行超时")
                        .build()
        );

        RuntimeException ex = assertThrows(RuntimeException.class, () ->
                promptMatrixService.refineProject(project.getId(), "V1_FIDELITY", "调优指令", "LOCAL_AGY")
        );
        assertTrue(ex.getMessage().contains("AI 追问调度失败"));
    }
}
