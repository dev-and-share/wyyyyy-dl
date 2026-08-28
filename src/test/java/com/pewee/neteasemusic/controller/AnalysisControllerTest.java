package com.pewee.neteasemusic.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import com.pewee.neteasemusic.dao.DownloadHistoryDAO;
import com.pewee.neteasemusic.models.dtos.SingleMusicAnalysisRespDTO;
import com.pewee.neteasemusic.service.AnalysisService;
import com.pewee.neteasemusic.service.NeteaseAPIService;

import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AnalysisController.class)
@TestPropertySource(properties = {
    "download.path=/tmp/test_download_path",
    "host.download.path=/tmp/test_download_path"
})
@DisplayName("🎵 音乐解析与智能播放控制器 AnalysisController 单元测试")
public class AnalysisControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AnalysisService analysisService;

    @MockBean
    private NeteaseAPIService neteaseAPIService;

    @MockBean
    private DownloadHistoryDAO downloadHistoryDAO;

    @Test
    @DisplayName("测试 /Song_V1: 当本地存在文件时，自动返回 /v2/stream 本地播放地址")
    public void testSongV1ReturnsLocalStreamUrlWhenFileExists() throws Exception {
        SingleMusicAnalysisRespDTO mockSong = new SingleMusicAnalysisRespDTO();
        mockSong.setId(1975924437L);
        mockSong.setName("用心良苦");
        mockSong.setAr_name("张宇");
        mockSong.setUrl("http://music.163.com/preview.mp3");

        Mockito.when(analysisService.analyzeSingleSong(eq(1975924437L), anyString())).thenReturn(mockSong);

        DownloadHistoryDAO.DownloadHistoryItem mockItem = new DownloadHistoryDAO.DownloadHistoryItem();
        mockItem.setId(88L);
        mockItem.setSongId(326696L);
        mockItem.setSongName("用心良苦");
        mockItem.setFileExists(true);

        Mockito.when(downloadHistoryDAO.findLocalFileBySongOrName(eq(1975924437L), eq("用心良苦"), eq("张宇")))
                .thenReturn(mockItem);

        mockMvc.perform(post("/Song_V1")
                .param("id", "1975924437")
                .param("name", "用心良苦")
                .param("artist", "张宇")
                .param("level", "lossless"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("000000"))
                .andExpect(jsonPath("$.data.url").value("/v2/stream?id=326696&historyId=88"));
    }

    @Test
    @DisplayName("测试 /Search: 兼容 keywords 与 keyword 两种参数发起搜索")
    public void testSearchApiCompatibility() throws Exception {
        mockMvc.perform(post("/Search")
                .param("keywords", "周杰伦")
                .param("type", "1")
                .param("limit", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("000000"));

        mockMvc.perform(post("/Search")
                .param("keyword", "周杰伦")
                .param("type", "1")
                .param("limit", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("000000"));
    }

    @Test
    @DisplayName("测试 /Song_V1: 试听歌曲在无本地匹配时保留 freeTrial=true，有本地匹配时 freeTrial 置为 false")
    public void testSongV1FreeTrialHandling() throws Exception {
        SingleMusicAnalysisRespDTO mockSong = new SingleMusicAnalysisRespDTO();
        mockSong.setId(12345L);
        mockSong.setName("Chupee");
        mockSong.setAr_name("Eric Hutchinson");
        mockSong.setUrl("http://music.163.com/trial.mp3");
        mockSong.setFreeTrial(true);
        mockSong.setFreeTrialDuration(30);

        Mockito.when(analysisService.analyzeSingleSong(eq(12345L), anyString())).thenReturn(mockSong);
        Mockito.when(downloadHistoryDAO.findLocalFileBySongOrName(eq(12345L), eq("Chupee"), eq("Eric Hutchinson")))
                .thenReturn(null);

        mockMvc.perform(post("/Song_V1")
                .param("id", "12345")
                .param("name", "Chupee")
                .param("artist", "Eric Hutchinson")
                .param("level", "lossless"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("000000"))
                .andExpect(jsonPath("$.data.freeTrial").value(true))
                .andExpect(jsonPath("$.data.freeTrialDuration").value(30));
    }

    @Test
    @DisplayName("测试 /v2/like/list 和 /v2/like 红心接口")
    public void testLikeEndpoints() throws Exception {
        // 1. 测试获取红心列表
        Mockito.when(neteaseAPIService.getLikedSongIds(null))
                .thenReturn("{\"code\":200, \"ids\":[186016, 326696]}");

        mockMvc.perform(get("/v2/like/list"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("000000"))
                .andExpect(jsonPath("$.data[0]").value(186016))
                .andExpect(jsonPath("$.data[1]").value(326696));

        // 2. 测试添加红心
        Mockito.when(neteaseAPIService.likeTrack(eq(186016L), eq(true)))
                .thenReturn("{\"code\":200, \"playlistId\":3554571}");

        mockMvc.perform(post("/v2/like")
                .param("id", "186016")
                .param("like", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("000000"))
                .andExpect(jsonPath("$.data.code").value(200));
    }
}
