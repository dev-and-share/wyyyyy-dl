package com.wyy.controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.wyy.dao.DownloadHistoryDAO;
import com.wyy.service.NeteaseAPIService;

import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(LocalPlaylistController.class)
@DisplayName("📁 本地隔离歌单控制器 LocalPlaylistController 单元测试")
public class LocalPlaylistControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private DownloadHistoryDAO downloadHistoryDAO;

    @MockBean
    private NeteaseAPIService neteaseAPIService;

    @MockBean
    private com.wyy.service.AuthContextService authContextService;

    @org.junit.jupiter.api.BeforeEach
    void setUp() {
        Mockito.when(authContextService.isAuthEnabled()).thenReturn(false);
        Mockito.when(authContextService.isAdmin()).thenReturn(true);
        Mockito.when(authContextService.getCurrentUserEmail()).thenReturn("test@gmail.com");
        Mockito.when(downloadHistoryDAO.isPlaylistOwnerOrAdmin(any(), any(), anyBoolean(), anyBoolean())).thenReturn(true);
    }

    @Test
    @DisplayName("测试 /v3/local-playlist/list: 获取本地歌单列表")
    public void testListPlaylists() throws Exception {
        Map<String, Object> pl = new HashMap<>();
        pl.put("id", "local_123");
        pl.put("name", "摇滚精选");
        pl.put("trackCount", 5);
        pl.put("isLocal", true);

        Mockito.when(downloadHistoryDAO.listLocalPlaylists(any(), anyBoolean(), anyBoolean())).thenReturn(List.of(pl));

        mockMvc.perform(get("/v3/local-playlist/list"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("000000"))
                .andExpect(jsonPath("$.data[0].id").value("local_123"))
                .andExpect(jsonPath("$.data[0].name").value("摇滚精选"));
    }

    @Test
    @DisplayName("测试 /v3/local-playlist/create: 创建新本地歌单")
    public void testCreatePlaylist() throws Exception {
        Mockito.when(downloadHistoryDAO.createLocalPlaylist(anyString(), eq("车载高品质"), Mockito.any(), any()))
                .thenReturn(true);

        mockMvc.perform(post("/v3/local-playlist/create")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"车载高品质\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("000000"))
                .andExpect(jsonPath("$.data.name").value("车载高品质"))
                .andExpect(jsonPath("$.data.isLocal").value(true));
    }

    @Test
    @DisplayName("测试 /v3/local-playlist/tracks/add: 向本地歌单添加歌曲")
    public void testAddTrackToPlaylist() throws Exception {
        Mockito.when(downloadHistoryDAO.addTrackToLocalPlaylist(
                eq("local_123"), Mockito.any(), eq("富士山下"), eq("陈奕迅"), Mockito.any(), Mockito.any()
        )).thenReturn(true);

        mockMvc.perform(post("/v3/local-playlist/tracks/add")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"playlistId\":\"local_123\",\"name\":\"富士山下\",\"artist\":\"陈奕迅\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("000000"));
    }

    @Test
    @DisplayName("测试 /v3/local-playlist/detail: 获取本地歌单详情与曲目")
    public void testGetPlaylistDetail() throws Exception {
        Map<String, Object> pl = new HashMap<>();
        pl.put("id", "local_123");
        pl.put("name", "摇滚精选");

        Map<String, Object> track = new HashMap<>();
        track.put("id", 1L);
        track.put("name", "富士山下");
        track.put("artist", "陈奕迅");
        track.put("isLocal", true);

        Mockito.when(downloadHistoryDAO.listLocalPlaylists(any(), anyBoolean(), anyBoolean())).thenReturn(List.of(pl));
        Mockito.when(downloadHistoryDAO.getLocalPlaylistTracks("local_123")).thenReturn(List.of(track));

        mockMvc.perform(get("/v3/local-playlist/detail").param("id", "local_123"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("000000"))
                .andExpect(jsonPath("$.data.id").value("local_123"))
                .andExpect(jsonPath("$.data.tracks[0].name").value("富士山下"));
    }

    @Test
    @DisplayName("测试 /v3/local-playlist/delete: 删除本地歌单")
    public void testDeletePlaylist() throws Exception {
        Mockito.when(downloadHistoryDAO.deleteLocalPlaylist(eq("local_123"), any(), anyBoolean(), anyBoolean())).thenReturn(true);

        mockMvc.perform(post("/v3/local-playlist/delete").param("id", "local_123"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("000000"));
    }
}
