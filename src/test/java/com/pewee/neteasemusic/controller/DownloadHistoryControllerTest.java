package com.pewee.neteasemusic.controller;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import com.pewee.neteasemusic.dao.DownloadHistoryDAO;

import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(DownloadHistoryController.class)
@TestPropertySource(properties = {
    "download.path=/tmp/test_download_path",
    "host.download.path=/tmp/test_download_path"
})
@DisplayName("📥 下载历史记录控制器 DownloadHistoryController 单元测试")
public class DownloadHistoryControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private DownloadHistoryDAO downloadHistoryDAO;

    @MockBean
    private com.pewee.neteasemusic.service.MusicDownloadService downloadService;

    @MockBean
    private com.pewee.neteasemusic.service.NeteaseAPIService neteaseAPIService;

    @Test
    @DisplayName("测试 /v2/history/list: 分页查询与列表数据包装")
    public void testGetHistoryList() throws Exception {
        Map<String, Object> mockResp = new HashMap<>();
        mockResp.put("list", new ArrayList<>());
        mockResp.put("total", 0);
        mockResp.put("page", 1);
        mockResp.put("pageSize", 10);

        Mockito.when(downloadHistoryDAO.getRecords(any(), anyInt(), anyInt())).thenReturn(new ArrayList<>());
        Mockito.when(downloadHistoryDAO.countRecords(any())).thenReturn(0);

        mockMvc.perform(get("/v2/history/list")
                .param("page", "1")
                .param("pageSize", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("000000"))
                .andExpect(jsonPath("$.data.page").value(1));
    }

    @Test
    @DisplayName("测试 /v2/history/stats: 统计数据获取")
    public void testGetHistoryStats() throws Exception {
        Map<String, Object> mockStats = new HashMap<>();
        mockStats.put("totalCount", 5);
        mockStats.put("totalSize", 10485760L);
        mockStats.put("missingCount", 0);

        Mockito.when(downloadHistoryDAO.getStats()).thenReturn(mockStats);

        mockMvc.perform(get("/v2/history/stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("000000"))
                .andExpect(jsonPath("$.data.totalCount").value(5));
    }

    @Test
    @DisplayName("测试 /v2/history/detail: 单条详情获取")
    public void testGetHistoryDetail() throws Exception {
        DownloadHistoryDAO.DownloadHistoryItem item = new DownloadHistoryDAO.DownloadHistoryItem();
        item.setId(10L);
        item.setSongName("用心良苦");
        item.setArtist("张宇");

        Mockito.when(downloadHistoryDAO.getRecordById(10L)).thenReturn(item);

        mockMvc.perform(get("/v2/history/detail").param("historyId", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("000000"))
                .andExpect(jsonPath("$.data.songName").value("用心良苦"));
    }

    @Test
    @DisplayName("测试 /v2/history/batch_detail: 批量详情获取")
    public void testGetBatchHistoryDetail() throws Exception {
        Mockito.when(downloadHistoryDAO.getRecordsByIds(any())).thenReturn(new ArrayList<>());
        Mockito.when(downloadHistoryDAO.getRecordsBySongIds(any())).thenReturn(new ArrayList<>());

        mockMvc.perform(post("/v2/history/batch_detail")
                .contentType("application/json")
                .content("{\"historyIds\":[1,2], \"songIds\":[100,200]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("000000"));
    }
}
