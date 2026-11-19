package com.wyy.controller;

import com.wyy.dao.IPlaybackDebugRepository;
import com.wyy.models.dtos.PlaybackDebugReport;
import com.wyy.service.AuthContextService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(PlaybackDebugController.class)
@DisplayName("🩺 播放器诊断控制器 PlaybackDebugController 单元测试")
public class PlaybackDebugControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private IPlaybackDebugRepository repository;

    @MockBean
    private AuthContextService authContextService;

    @Test
    @DisplayName("POST /v3/debug/playback 保存诊断上报")
    public void testSubmitReport() throws Exception {
        PlaybackDebugReport saved = new PlaybackDebugReport();
        saved.setId(42L);
        saved.setTriggerType("watchdog_timeout");
        saved.setSessionId("sess-xyz");
        Mockito.when(repository.saveReport(any(PlaybackDebugReport.class))).thenReturn(saved);

        mockMvc.perform(post("/v3/debug/playback")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"triggerType\":\"watchdog_timeout\",\"sessionId\":\"sess-xyz\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("000000"))
                .andExpect(jsonPath("$.data.id").value(42))
                .andExpect(jsonPath("$.data.triggerType").value("watchdog_timeout"));
    }

    @Test
    @DisplayName("POST /v3/debug/playback 空包体返回参数错误")
    public void testSubmitEmptyReport() throws Exception {
        mockMvc.perform(post("/v3/debug/playback")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("-100002"));
    }

    @Test
    @DisplayName("GET 与 DELETE /v3/debug/playback 在开放/管理员模式下正常工作")
    public void testListAndClearReports() throws Exception {
        Mockito.when(authContextService.isAuthEnabled()).thenReturn(false);
        PlaybackDebugReport item = new PlaybackDebugReport();
        item.setId(1L);
        item.setTriggerType("manual");
        Mockito.when(repository.listRecentReports(anyInt())).thenReturn(List.of(item));
        Mockito.when(repository.countReports()).thenReturn(1);
        Mockito.when(repository.deleteAllReports()).thenReturn(1);

        mockMvc.perform(get("/v3/debug/playback").param("limit", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("000000"))
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.items[0].triggerType").value("manual"));

        mockMvc.perform(delete("/v3/debug/playback"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("000000"))
                .andExpect(jsonPath("$.data.deleted").value(1));
    }

    @Test
    @DisplayName("开启权限校验时非管理员禁止读取和清空服务端诊断报告")
    public void testNonAdminBlockedOnListAndDelete() throws Exception {
        Mockito.when(authContextService.isAuthEnabled()).thenReturn(true);
        Mockito.when(authContextService.isAdmin()).thenReturn(false);

        mockMvc.perform(get("/v3/debug/playback"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("-100022"));

        mockMvc.perform(delete("/v3/debug/playback"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("-100022"));
    }
}
