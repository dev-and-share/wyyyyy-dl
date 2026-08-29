package com.pewee.neteasemusic.controller;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
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

@WebMvcTest(FolderExplorerController.class)
@TestPropertySource(properties = {
    "download.path=/tmp/test_download_path",
    "host.download.path=/tmp/test_download_path"
})
@DisplayName("📁 文件夹与曲库浏览器控制器 FolderExplorerController 单元测试")
public class FolderExplorerControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private DownloadHistoryDAO downloadHistoryDAO;

    @Test
    @DisplayName("测试 /v2/folder/roots 获取根目录列表")
    public void testGetFolderRoots() throws Exception {
        List<Map<String, String>> roots = new ArrayList<>();
        Map<String, String> r = new HashMap<>();
        r.put("name", "下载目录");
        r.put("path", "/media/music");
        roots.add(r);

        Mockito.when(downloadHistoryDAO.getFolderRoots()).thenReturn(roots);

        mockMvc.perform(get("/v2/folder/roots"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("000000"))
                .andExpect(jsonPath("$.data[0].name").value("下载目录"));
    }

    @Test
    @DisplayName("测试 /v2/folder/browse 浏览目录")
    public void testBrowseFolder() throws Exception {
        List<DownloadHistoryDAO.FolderItemDTO> list = new ArrayList<>();
        DownloadHistoryDAO.FolderItemDTO item = new DownloadHistoryDAO.FolderItemDTO();
        item.setName("叶惠美");
        item.setDirectory(true);
        item.setTrackCount(11);
        list.add(item);

        Mockito.when(downloadHistoryDAO.listFolderContents(any())).thenReturn(list);

        mockMvc.perform(get("/v2/folder/browse").param("path", "/media/music/周杰伦"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("000000"))
                .andExpect(jsonPath("$.data[0].name").value("叶惠美"))
                .andExpect(jsonPath("$.data[0].directory").value(true));
    }

    @Test
    @DisplayName("测试 /v2/folder/tracks 提取文件夹全部 MP3 音轨")
    public void testGetFolderTracks() throws Exception {
        List<DownloadHistoryDAO.DownloadHistoryItem> tracks = new ArrayList<>();
        DownloadHistoryDAO.DownloadHistoryItem track = new DownloadHistoryDAO.DownloadHistoryItem();
        track.setId(1001L);
        track.setSongName("晴天");
        track.setArtist("周杰伦");
        tracks.add(track);

        Mockito.when(downloadHistoryDAO.getFolderTracks(anyString(), anyBoolean())).thenReturn(tracks);

        mockMvc.perform(get("/v2/folder/tracks")
                .param("path", "/media/music/周杰伦/叶惠美")
                .param("recursive", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("000000"))
                .andExpect(jsonPath("$.data[0].songName").value("晴天"));
    }

    @Test
    @DisplayName("测试 /v2/folder/ignore 忽略文件夹")
    public void testIgnoreFolder() throws Exception {
        Mockito.when(downloadHistoryDAO.ignoreFolder(anyString())).thenReturn(true);

        mockMvc.perform(post("/v2/folder/ignore")
                .param("path", "/media/music/Unknown Artist"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("000000"))
                .andExpect(jsonPath("$.data").value(true));
    }

    @Test
    @DisplayName("测试 /v2/folder/check 预检文件夹信息")
    public void testCheckFolder() throws Exception {
        DownloadHistoryDAO.FolderCheckDTO check = new DownloadHistoryDAO.FolderCheckDTO();
        check.setFolderName("2023.08DJ");
        check.setTotalFiles(8);
        check.setTotalDirs(1);
        check.setSampleFiles(java.util.Arrays.asList("老男孩.flac", "cover.jpg"));
        check.setHostPath("/Users/houtokki/Music/2023.08DJ");

        Mockito.when(downloadHistoryDAO.checkFolder(anyString())).thenReturn(check);

        mockMvc.perform(get("/v2/folder/check")
                .param("path", "/media/external/2023.08DJ"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("000000"))
                .andExpect(jsonPath("$.data.totalFiles").value(8))
                .andExpect(jsonPath("$.data.sampleFiles[0]").value("老男孩.flac"));
    }

    @Test
    @DisplayName("测试 /v2/folder/delete 物理删除文件夹")
    public void testDeleteFolder() throws Exception {
        Mockito.when(downloadHistoryDAO.deleteFolder(anyString())).thenReturn(true);

        mockMvc.perform(post("/v2/folder/delete")
                .param("path", "/media/music/周杰伦/临时文件夹"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("000000"))
                .andExpect(jsonPath("$.data").value(true));
    }
}
