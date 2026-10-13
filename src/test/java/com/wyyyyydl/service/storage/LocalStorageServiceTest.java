package com.wyyyyydl.service.storage;

import com.wyyyyydl.service.storage.impl.LocalStorageService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.File;
import java.io.IOException;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

public class LocalStorageServiceTest {

    @Test
    @DisplayName("测试 LocalStorageService: 基础属性与 URL 解析")
    public void testBasicPropertiesAndUrlResolution(@TempDir Path tempDir) {
        LocalStorageService service = new LocalStorageService();
        ReflectionTestUtils.setField(service, "downloadPath", tempDir.toString());

        assertFalse(service.isCloudStorage());
        assertFalse(service.isS3Enabled());

        // 测试获取相对流访问路径
        String accessUrl = service.getAccessUrl("Jay/晴天.mp3");
        assertNotNull(accessUrl);
        assertTrue(accessUrl.startsWith("/v3/history/stream?path="));

        // 测试在线代理流 URL 构造
        String onlineUrl = service.resolveOnlineStreamUrl(18915L, "http://m801.music.126.net/test.mp3", "我的歌单", "叶惠美", "晴天", false);
        assertNotNull(onlineUrl);
        assertTrue(onlineUrl.contains("/v3/stream/online?id=18915"));
        assertTrue(onlineUrl.contains("playlistName="));
        assertTrue(onlineUrl.contains("name="));
        assertFalse(onlineUrl.contains("freeTrial=true"));

        // 测试试听标记附加
        String trialUrl = service.resolveOnlineStreamUrl(18915L, "http://m801.music.126.net/test.mp3", null, null, null, true);
        assertTrue(trialUrl.contains("freeTrial=true"));
    }

    @Test
    @DisplayName("测试 LocalStorageService: 本地文件上传与存在性检查")
    public void testFileOperations(@TempDir Path tempDir) throws IOException {
        LocalStorageService service = new LocalStorageService();
        ReflectionTestUtils.setField(service, "downloadPath", tempDir.toString());

        File testFile = tempDir.resolve("test_track.mp3").toFile();
        assertTrue(testFile.createNewFile());

        // 写入测试数据
        java.nio.file.Files.write(testFile.toPath(), "test audio bytes".getBytes());

        // 本地模式 uploadFile 返回文件自身的绝对路径
        String uploadedPath = service.uploadFile("test_track.mp3", testFile, "audio/mpeg");
        assertEquals(testFile.getAbsolutePath(), uploadedPath);

        // 检查文件存在性
        assertTrue(service.checkFileExists(testFile, "SUCCESS"));
        assertFalse(service.checkFileExists(null, "SUCCESS"));

        File nonExistent = tempDir.resolve("not_found.mp3").toFile();
        assertFalse(service.checkFileExists(nonExistent, "SUCCESS"));

        // 测试删除文件
        assertTrue(service.deleteFile(testFile.getAbsolutePath()));
        assertFalse(testFile.exists());
    }

    @Test
    @DisplayName("测试 LocalStorageService: 流媒体文件不存在时返回 404")
    public void testServeMediaNotFound(@TempDir Path tempDir) throws IOException {
        LocalStorageService service = new LocalStorageService();
        ReflectionTestUtils.setField(service, "downloadPath", tempDir.toString());

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        service.serveMedia("not_existing_file.flac", request, response);
        assertEquals(404, response.getStatus());
    }
}
