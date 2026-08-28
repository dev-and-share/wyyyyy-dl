package com.pewee.neteasemusic.service;

import java.util.Collections;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;

import com.pewee.neteasemusic.models.dtos.PlaylistAnalysisRespDTO;
import com.pewee.neteasemusic.models.dtos.SingleMusicAnalysisRespDTO;

import static org.mockito.ArgumentMatchers.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("⚡ AnalysisService 并发异步编排单元测试")
public class AnalysisServiceTest {

    @Mock
    private NeteaseAPIService neteaseAPIService;

    @InjectMocks
    private AnalysisService analysisService;

    @Test
    @DisplayName("测试 analyzeSingleSong: 3 路并行拉取聚合正确性")
    public void testAnalyzeSingleSongParallel() throws Exception {
        Mockito.when(neteaseAPIService.checkReady()).thenReturn(true);
        Mockito.when(neteaseAPIService.urlV1(eq(12345L), eq("lossless")))
                .thenReturn("{\"data\":[{\"url\":\"http://music.163.com/song.flac\",\"size\":31457280,\"code\":200}]}");
        Mockito.when(neteaseAPIService.songDetail(eq(Collections.singletonList(12345L))))
                .thenReturn("{\"songs\":[{\"id\":12345,\"name\":\"晴天\",\"al\":{\"id\":100,\"name\":\"叶惠美\",\"picUrl\":\"http://cover.jpg\"},\"ar\":[{\"id\":1,\"name\":\"周杰伦\"}]}]}");
        Mockito.when(neteaseAPIService.getLyric(eq(12345L)))
                .thenReturn("{\"lrc\":{\"lyric\":\"[00:00.00] 故事的小黄花\"}}");

        SingleMusicAnalysisRespDTO dto = analysisService.analyzeSingleSong(12345L, "lossless");

        Assertions.assertNotNull(dto);
        Assertions.assertEquals(12345L, dto.getId());
        Assertions.assertEquals("晴天", dto.getName());
        Assertions.assertEquals("周杰伦", dto.getAr_name());
        Assertions.assertEquals("叶惠美", dto.getAl_name());
        Assertions.assertEquals("https://music.163.com/song.flac", dto.getUrl());
        Assertions.assertTrue(dto.getLyric().contains("故事的小黄花"));
    }

    @Test
    @DisplayName("测试 analyzePlaylist: 超大歌单多分片 CompletableFuture 并发聚合")
    public void testAnalyzePlaylistParallelBatch() throws Exception {
        Mockito.when(neteaseAPIService.checkReady()).thenReturn(true);

        // 构造一个有 1002 首 trackIds 的歌单 (前 2 首在 tracks 中，后 1000 首歌触发 2 个 500 分片并发)
        StringBuilder trackIdsJson = new StringBuilder("[{\"id\":1},{\"id\":2}");
        for (int i = 3; i <= 1002; i++) {
            trackIdsJson.append(",{\"id\":").append(i).append("}");
        }
        trackIdsJson.append("]");

        String playlistJson = "{\"playlist\":{" +
                "\"id\":999,\"name\":\"超大歌单\",\"coverImgUrl\":\"http://img.jpg\",\"description\":\"desc\"," +
                "\"creator\":{\"nickname\":\"DJ\"},\"trackCount\":1002," +
                "\"tracks\":[" +
                "{\"id\":1,\"name\":\"Song 1\",\"al\":{\"name\":\"Alb 1\"},\"ar\":[{\"name\":\"Art 1\"}]}," +
                "{\"id\":2,\"name\":\"Song 2\",\"al\":{\"name\":\"Alb 2\"},\"ar\":[{\"name\":\"Art 2\"}]}" +
                "]," +
                "\"trackIds\":" + trackIdsJson.toString() +
                "}}";

        Mockito.when(neteaseAPIService.getPlaylistDetail(eq(999L))).thenReturn(playlistJson);

        // Mock 针对 chunk 的返回
        Mockito.when(neteaseAPIService.songDetail(anyList())).thenAnswer(invocation -> {
            java.util.List<Long> ids = invocation.getArgument(0);
            StringBuilder songsJson = new StringBuilder("{\"songs\":[");
            for (int i = 0; i < ids.size(); i++) {
                if (i > 0) songsJson.append(",");
                songsJson.append("{\"id\":").append(ids.get(i))
                        .append(",\"name\":\"Song ").append(ids.get(i))
                        .append("\",\"al\":{\"name\":\"Alb\"},\"ar\":[{\"name\":\"Art\"}]}");
            }
            songsJson.append("]}");
            return songsJson.toString();
        });

        PlaylistAnalysisRespDTO result = analysisService.analyzePlaylist(999L);

        Assertions.assertNotNull(result);
        Assertions.assertEquals(200, result.getStatus());
        Assertions.assertEquals(1002, result.getPlaylist().getTracks().size());
        Assertions.assertEquals("Song 1", result.getPlaylist().getTracks().get(0).getName());
        Assertions.assertEquals("Song 1002", result.getPlaylist().getTracks().get(1001).getName());
    }
}
