package com.wyyyyydl.dao.impl;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("💾 SqliteConfigRepository 本地配置与凭证仓储单元测试")
public class SqliteConfigRepositoryTest {

    private SqliteConfigRepository repo;
    private Path tempDir;

    @BeforeEach
    public void setUp() throws Exception {
        tempDir = Files.createTempDirectory("sqlite_config_test");
        repo = new SqliteConfigRepository();
        ReflectionTestUtils.setField(repo, "downloadPath", tempDir.toAbsolutePath().toString());
        repo.init();
    }

    @AfterEach
    public void tearDown() throws Exception {
        if (tempDir != null && Files.exists(tempDir)) {
            org.springframework.util.FileSystemUtils.deleteRecursively(tempDir);
        }
    }

    @Test
    @DisplayName("测试系统配置保存与读取 (saveConfig & getConfig)")
    public void testSaveAndGetConfig() {
        assertNull(repo.getConfig("NETEASE_COOKIE"), "未保存的配置应返回 null");

        repo.saveConfig("NETEASE_COOKIE", "MUSIC_U=test_token_12345");
        String val = repo.getConfig("NETEASE_COOKIE");
        assertEquals("MUSIC_U=test_token_12345", val, "应正确读取保存的配置");

        // 测试更新覆盖同一 key
        repo.saveConfig("NETEASE_COOKIE", "MUSIC_U=updated_token_67890");
        String updated = repo.getConfig("NETEASE_COOKIE");
        assertEquals("MUSIC_U=updated_token_67890", updated, "应正确更新已有 key 的值");
    }

    @Test
    @DisplayName("测试空值容错保护")
    public void testNullOrEmptyKeyHandling() {
        repo.saveConfig(null, "some_value");
        repo.saveConfig("", "some_value");
        assertNull(repo.getConfig(null));
        assertNull(repo.getConfig(""));
    }
}
