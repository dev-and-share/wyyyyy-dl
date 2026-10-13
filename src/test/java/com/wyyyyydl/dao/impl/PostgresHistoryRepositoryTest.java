package com.wyyyyydl.dao.impl;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("🐘 PostgresHistoryRepository 方言与特性单元测试")
public class PostgresHistoryRepositoryTest {

    @Test
    @DisplayName("测试 PostgreSQL 自增主键 DDL 方言 (BIGSERIAL)")
    public void testAutoIncrementPkSql() {
        PostgresHistoryRepository repo = new PostgresHistoryRepository();
        String pkSql = (String) ReflectionTestUtils.invokeMethod(repo, "getAutoIncrementPkSql");
        assertEquals("id BIGSERIAL PRIMARY KEY", pkSql);
    }

    @Test
    @DisplayName("测试 PostgreSQL 红心喜好冲突避免方言 (ON CONFLICT DO NOTHING)")
    public void testBatchLikedSongsInsertSql() {
        PostgresHistoryRepository repo = new PostgresHistoryRepository();
        String insertSql = (String) ReflectionTestUtils.invokeMethod(repo, "getBatchLikedSongsInsertSql");
        assertTrue(insertSql.contains("ON CONFLICT (song_id) DO NOTHING"));
    }
}
