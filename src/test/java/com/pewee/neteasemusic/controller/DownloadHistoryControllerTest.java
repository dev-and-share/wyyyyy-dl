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
}
