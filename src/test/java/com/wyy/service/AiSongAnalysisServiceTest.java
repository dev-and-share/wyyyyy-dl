package com.wyy.service;

import com.wyy.models.dtos.AiSongAnalysisDTO;
import com.wyy.service.ai.AiEngineResponse;
import com.wyy.service.ai.AiEngineRouter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

@DisplayName("🔬 AI 歌曲解构与逆向分析服务单元测试")
public class AiSongAnalysisServiceTest {

    @InjectMocks
    private AiSongAnalysisService analysisService;

    @Mock
    private NeteaseAPIService neteaseAPIService;

    @Mock
    private AiEngineRouter engineRouter;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
    }

    @Test
    @DisplayName("测试真实 AI 引擎返回 JSON 格式乐理推理结果成功解析")
    void testGenuineAiAnalysisSuccess() {
        String mockAiMarkdown = "```json\n" +
                "{\n" +
                "  \"genre\": \"校园怀旧流行民谣\",\n" +
                "  \"genreKey\": \"03_campus_nostalgia_ballad\",\n" +
                "  \"estimatedKey\": \"G Major\",\n" +
                "  \"estimatedBpm\": 104,\n" +
                "  \"mood\": \"青涩初恋、明媚微风中的感伤与回忆\",\n" +
                "  \"instrumentation\": \"原声木吉他击勾弦、十六分音符扫弦、大提琴复调\",\n" +
                "  \"lyricStructure\": \"[Intro -> Verse -> Chorus -> Outro]\",\n" +
                "  \"summary\": \"殿堂级乐理解析报告\"\n" +
                "}\n" +
                "```";

        when(engineRouter.execute(anyString(), any(), anyString(), anyString())).thenReturn(
                AiEngineResponse.builder()
                        .engineType("LOCAL_AGY")
                        .success(true)
                        .responseText(mockAiMarkdown)
                        .build()
        );

        AiSongAnalysisDTO result = analysisService.analyzeSong("186016", "晴天", "周杰伦", "LOCAL_AGY");
        assertNotNull(result);
        assertEquals("03_campus_nostalgia_ballad", result.getGenre());
        assertEquals("G Major", result.getEstimatedKey());
        assertEquals(104, result.getEstimatedBpm());
        assertTrue(result.getInstrumentation().contains("木吉他"));
        assertTrue(result.getMood().contains("青涩初恋"));
    }

    @Test
    @DisplayName("测试晴天精准特征兜底逻辑 (必须为 G Major, 104 BPM, 绝非 72 BPM 苦情歌)")
    void testQingtianAccurateFallback() {
        when(engineRouter.execute(anyString(), any(), anyString(), anyString())).thenReturn(
                AiEngineResponse.builder().success(false).errorMsg("engine offline").build()
        );

        AiSongAnalysisDTO result = analysisService.analyzeSong("186016", "晴天", "周杰伦");
        assertNotNull(result);
        assertEquals("03_campus_nostalgia_ballad", result.getGenre());
        assertEquals("G Major", result.getEstimatedKey());
        assertEquals(104, result.getEstimatedBpm());
        assertTrue(result.getMood().contains("青涩懵懂"));
    }

    @Test
    @DisplayName("测试曲风赛道推导: 史诗电影交响")
    void testDeduceGenreCinematic() {
        AiSongAnalysisDTO result = analysisService.analyzeSong("0", "星际穿越 Interstellar 原声交响", "Hans Zimmer");
        assertNotNull(result);
        assertEquals("01_cinematic_epic_orchestra", result.getGenre());
        assertEquals("D minor", result.getEstimatedKey());
        assertTrue(result.getEstimatedBpm() > 0);
        assertTrue(result.getAnalysisSummary().contains("史诗电影交响"));
    }

    @Test
    @DisplayName("测试曲风赛道推导: 新海诚治愈钢琴")
    void testDeduceGenreShinkaiPiano() {
        AiSongAnalysisDTO result = analysisService.analyzeSong("0", "微光之约 新海诚风纯爱钢琴", "天门");
        assertNotNull(result);
        assertEquals("02_shinkai_sentimental_piano", result.getGenre());
        assertTrue(result.getInstrumentation().contains("弱音立式钢琴"));
    }

    @Test
    @DisplayName("测试曲风赛道推导: 极速二次元 Eurobeat")
    void testDeduceGenreEurobeat() {
        AiSongAnalysisDTO result = analysisService.analyzeSong("0", "头文字D 极速燃曲 Eurobeat", "m.o.v.e");
        assertNotNull(result);
        assertEquals("04_high_energy_jpop_eurobeat", result.getGenre());
        assertTrue(result.getEstimatedBpm() >= 135);
    }

    @Test
    @DisplayName("测试曲风赛道推导: 新国风戏腔 Trap")
    void testDeduceGenreGuofengTrap() {
        AiSongAnalysisDTO result = analysisService.analyzeSong("0", "断桥青衣 戏腔 古筝 Trap", "李玉刚");
        assertNotNull(result);
        assertEquals("05_guofeng_opera_trap", result.getGenre());
        assertTrue(result.getInstrumentation().contains("808"));
    }

    @Test
    @DisplayName("测试曲风赛道推导: 温暖慵懒 Lo-fi")
    void testDeduceGenreCozyLofi() {
        AiSongAnalysisDTO result = analysisService.analyzeSong("0", "雨声 咖啡厅 慵懒自习室 lofi", "ChilledCow");
        assertNotNull(result);
        assertEquals("06_cozy_lofi_rainy_day", result.getGenre());
        assertTrue(result.getInstrumentation().contains("Rhodes"));
    }

    @Test
    @DisplayName("测试歌词清洗与时间标签剔除")
    void testLyricCleaning() throws Exception {
        String mockLrcJson = "{\"lrc\":{\"lyric\":\"[00:01.00]作词: 方文山\\n[00:03.50]作曲: 周杰伦\\n[00:10.20]故事的小黄花\\n[00:15.30]从出生那年就飘着\\n[00:20.40]童年的荡秋千\"}}";
        when(neteaseAPIService.getLyric(anyLong())).thenReturn(mockLrcJson);

        AiSongAnalysisDTO result = analysisService.analyzeSong("186016", "晴天", "周杰伦");
        assertNotNull(result);
        assertFalse(result.getLyric().contains("[00:10.20]"));
        assertFalse(result.getLyric().contains("作词"));
        assertTrue(result.getLyric().contains("故事的小黄花"));
        assertTrue(result.getLyric().contains("童年的荡秋千"));
    }
}
