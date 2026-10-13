package com.wyyyyydl.dao.impl;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("💾 SqliteHistoryRepository 方言与特性单元测试")
public class SqliteHistoryRepositoryTest {

    @Test
    @DisplayName("测试 SQLite 自增主键 DDL 方言 (INTEGER PRIMARY KEY AUTOINCREMENT)")
    public void testAutoIncrementPkSql() {
        SqliteHistoryRepository repo = new SqliteHistoryRepository();
        String pkSql = (String) ReflectionTestUtils.invokeMethod(repo, "getAutoIncrementPkSql");
        assertEquals("id INTEGER PRIMARY KEY AUTOINCREMENT", pkSql);
    }

    @Test
    @DisplayName("测试 SQLite 红心喜好忽略冲突方言 (INSERT OR IGNORE)")
    public void testBatchLikedSongsInsertSql() {
        SqliteHistoryRepository repo = new SqliteHistoryRepository();
        String insertSql = (String) ReflectionTestUtils.invokeMethod(repo, "getBatchLikedSongsInsertSql");
        assertTrue(insertSql.contains("INSERT OR IGNORE INTO liked_songs"));
    }
}
