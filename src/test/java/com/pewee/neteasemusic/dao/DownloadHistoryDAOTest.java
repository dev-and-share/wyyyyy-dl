package com.pewee.neteasemusic.dao;

import java.io.File;
import java.io.FileWriter;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

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
            org.springframework.util.FileSystemUtils.deleteRecursively(tempDir);
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

    @Test
    @DisplayName("测试 .env 多路径外部曲库递归扫描与索引录入")
    public void testScanExternalLibraries() throws Exception {
        File subDir = new File(tempDir.toFile(), "官方曲库");
        subDir.mkdirs();
        File externalAudio = new File(subDir, "张学友 - 吻别.mp3");
        try (FileWriter writer = new FileWriter(externalAudio)) {
            writer.write("dummy audio stream");
        }

        ReflectionTestUtils.setField(dao, "externalLibraryPaths", tempDir.toAbsolutePath().toString());

        Map<String, Object> result = dao.scanExternalLibraries();
        assertNotNull(result);
        assertTrue((int) result.get("scannedFiles") >= 1, "扫描到的文件数应当大于等于 1");
        assertTrue((int) result.get("addedCount") >= 1, "成功录入数据库的新索引数应当大于等于 1");

        DownloadHistoryDAO.DownloadHistoryItem item = dao.findLocalFileBySongOrName(null, "吻别", "张学友");
        assertNotNull(item, "智能比对应当成功命中扫描录入的《吻别》");
        assertEquals("吻别", item.getSongName());
    }

    @Test
    @DisplayName("测试旧版宿主机外部曲库路径可映射到容器挂载路径")
    public void testResolveLegacyExternalLibraryPath() throws Exception {
        File containerRoot = new File(tempDir.toFile(), "external");
        File albumDir = new File(containerRoot, "网易云音乐");
        albumDir.mkdirs();
        File externalAudio = new File(albumDir, "张学友 - 吻别.mp3");
        try (FileWriter writer = new FileWriter(externalAudio)) {
            writer.write("dummy audio stream");
        }

        ReflectionTestUtils.setField(dao, "externalLibraryHostPath", "/mock/user/Music");
        ReflectionTestUtils.setField(dao, "externalLibraryContainerPath", containerRoot.getAbsolutePath());

        File resolved = dao.resolveFile("/mock/user/Music/网易云音乐/张学友 - 吻别.mp3");
        assertEquals(externalAudio.getCanonicalPath(), resolved.getCanonicalPath());
        assertTrue(resolved.exists(), "旧版宿主机绝对路径应能访问到容器挂载的音频文件");
    }

    @Test
    @DisplayName("测试批量查询记录 getRecordsByIds 与 getRecordsBySongIds")
    public void testBatchQueryRecords() throws Exception {
        File mockMusic1 = new File(tempDir.toFile(), "song1.mp3");
        File mockMusic2 = new File(tempDir.toFile(), "song2.mp3");
        try (FileWriter w = new FileWriter(mockMusic1)) { w.write("1"); }
        try (FileWriter w = new FileWriter(mockMusic2)) { w.write("2"); }

        long id1 = dao.addRecord(101L, "歌曲1", "歌手1", "专辑1", mockMusic1.getAbsolutePath(), mockMusic1.length(), "lossless", "SUCCESS");
        long id2 = dao.addRecord(102L, "歌曲2", "歌手2", "专辑2", mockMusic2.getAbsolutePath(), mockMusic2.length(), "lossless", "SUCCESS");

        java.util.List<DownloadHistoryDAO.DownloadHistoryItem> byIds = dao.getRecordsByIds(java.util.Arrays.asList(id1, id2));
        assertEquals(2, byIds.size());

        java.util.List<DownloadHistoryDAO.DownloadHistoryItem> bySongIds = dao.getRecordsBySongIds(java.util.Arrays.asList(101L, 102L));
        assertEquals(2, bySongIds.size());
    }

    @Test
    @DisplayName("测试 toHostPath 对外部曲库与主下载路径的精准映射与隔离")
    public void testToHostPathExternalVsDownload() throws Exception {
        File containerExtRoot = new File(tempDir.toFile(), "external_container");
        File musicExtDir = new File(containerExtRoot, "网易云音乐");
        musicExtDir.mkdirs();
        File extAudio = new File(musicExtDir, "RobTop - MenuLoop.mp3");
        try (FileWriter w = new FileWriter(extAudio)) { w.write("external audio"); }

        ReflectionTestUtils.setField(dao, "externalLibraryHostPath", "/Users/houtokki/Music");
        ReflectionTestUtils.setField(dao, "externalLibraryContainerPath", containerExtRoot.getAbsolutePath());
        ReflectionTestUtils.setField(dao, "hostDownloadPath", "/Users/houtokki/Downloads/fast_sr");

        // 1. 外部曲库文件应准确映射至宿主机 Music 目录，绝对不能拼接 Downloads/fast_sr
        String hostExtPath = dao.toHostPath(extAudio);
        assertEquals(new File("/Users/houtokki/Music/网易云音乐/RobTop - MenuLoop.mp3").getPath(), hostExtPath);
        assertFalse(hostExtPath.contains("Downloads/fast_sr"), "外部曲库宿主机路径绝不能包含 hostDownloadPath");

        // 2. 主下载目录文件应映射至 hostDownloadPath
        File localAudio = new File(tempDir.toFile(), "周杰伦 - 晴天.flac");
        try (FileWriter w = new FileWriter(localAudio)) { w.write("local audio"); }
        String hostLocalPath = dao.toHostPath(localAudio);
        assertEquals(new File("/Users/houtokki/Downloads/fast_sr/周杰伦 - 晴天.flac").getPath(), hostLocalPath);
    }

    @Test
    @DisplayName("测试 resolveFile 容错解析错误嵌套的外部路径")
    public void testResolveCorruptedNestedPath() throws Exception {
        File containerExtRoot = new File(tempDir.toFile(), "external");
        File albumDir = new File(containerExtRoot, "网易云");
        albumDir.mkdirs();
        File audio = new File(albumDir, "test.mp3");
        try (FileWriter w = new FileWriter(audio)) { w.write("test"); }

        ReflectionTestUtils.setField(dao, "externalLibraryHostPath", "/Users/houtokki/Music");
        ReflectionTestUtils.setField(dao, "externalLibraryContainerPath", containerExtRoot.getAbsolutePath());
        ReflectionTestUtils.setField(dao, "hostDownloadPath", "/Users/houtokki/Downloads/fast_sr");

        // 模拟错误嵌套路径: /Users/houtokki/Downloads/fast_sr + containerExtRoot + /网易云/test.mp3
        String corruptedPath = "/Users/houtokki/Downloads/fast_sr" + containerExtRoot.getAbsolutePath() + "/网易云/test.mp3";
        File resolved = dao.resolveFile(corruptedPath);
        assertEquals(audio.getCanonicalPath(), resolved.getCanonicalPath());
        assertTrue(resolved.exists(), "容错机制应当成功定位到底层真实物理文件");
    }
}
