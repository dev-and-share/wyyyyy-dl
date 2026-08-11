package com.pewee.neteasemusic.dao;

import java.io.File;
import java.io.FileWriter;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("📥 下载历史记录与智能文件匹配 DAO 单元测试")
public class DownloadHistoryDAOTest {

    private DownloadHistoryDAO dao;
    private Path tempDir;

    @BeforeEach
    public void setUp() throws Exception {
        tempDir = Files.createTempDirectory("netease_test_download_dir");
        dao = new DownloadHistoryDAO();
        ReflectionTestUtils.setField(dao, "downloadPath", tempDir.toAbsolutePath().toString());
        ReflectionTestUtils.setField(dao, "hostDownloadPath", tempDir.toAbsolutePath().toString());
        dao.init();
    }

    @AfterEach
    public void tearDown() throws Exception {
        if (tempDir != null && Files.exists(tempDir)) {
            File[] files = tempDir.toFile().listFiles();
            if (files != null) {
                for (File f : files) f.delete();
            }
            Files.deleteIfExists(tempDir);
        }
    }

    @Test
    @DisplayName("测试保存记录与基础查询")
    public void testAddAndGetRecord() throws Exception {
        File mockMusic = new File(tempDir.toFile(), "张宇 - 用心良苦.mp3");
        try (FileWriter writer = new FileWriter(mockMusic)) {
            writer.write("dummy audio content");
        }

        long id = dao.addRecord(326696L, "用心良苦", "张宇", "男人的好", mockMusic.getAbsolutePath(), mockMusic.length(), "lossless", "SUCCESS");
        assertTrue(id > 0, "插入记录返回的数据库 ID 应大于 0");

        DownloadHistoryDAO.DownloadHistoryItem item = dao.getRecordById(id);
        assertNotNull(item, "查询出的历史记录不应为 null");
        assertEquals("用心良苦", item.getSongName());
        assertEquals("张宇", item.getArtist());
        assertTrue(item.getFileExists(), "物理文件应当存在");
    }

    @Test
    @DisplayName("测试智能跨专辑比对逻辑 (以《用心良苦》为例)")
    public void testSmartMatchBySongNameAndArtist() throws Exception {
        File mockMusic = new File(tempDir.toFile(), "用心良苦.mp3");
        try (FileWriter writer = new FileWriter(mockMusic)) {
            writer.write("audio data payload");
        }
        dao.addRecord(326696L, "用心良苦", "张宇", "男人的好", mockMusic.getAbsolutePath(), mockMusic.length(), "lossless", "SUCCESS");

        DownloadHistoryDAO.DownloadHistoryItem matched = dao.findLocalFileBySongOrName(1975924437L, "用心良苦", "张宇");
        
        assertNotNull(matched, "即使 songId 不同，智能比对也应成功查找到本地文件");
        assertEquals("用心良苦", matched.getSongName());
        assertTrue(matched.getFileExists(), "命中文件物理上应当存在");
    }

    @Test
    @DisplayName("测试 Raw JSON 扩展存储与获取")
    public void testRawJsonStorage() {
        long id = dao.addRecord(1001L, "测试歌曲", "测试歌手", "测试专辑", "test.mp3", 1024L, "standard", "SUCCESS");
        String jsonPayload = "{\"songId\":1001, \"bitrate\":320000}";

        dao.saveRawJson(id, jsonPayload);
        String fetchedJson = dao.getRawJson(id);

        assertEquals(jsonPayload, fetchedJson, "读取到的 Raw JSON 应与保存一致");
    }

    @Test
    @DisplayName("测试缺少物理文件时的过滤器比对")
    public void testMissingFileFilter() {
        dao.addRecord(9999L, "不存在的歌", "匿名", "未知", "/invalid/path/non_exist.mp3", 0L, "standard", "SUCCESS");

        DownloadHistoryDAO.DownloadHistoryItem matched = dao.findLocalFileBySongOrName(9999L, "不存在的歌", "匿名");
        assertNull(matched, "当物理文件不存在时，不应命中为本地可播放路径");
    }
}
