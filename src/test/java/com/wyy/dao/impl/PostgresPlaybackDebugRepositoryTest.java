package com.wyy.dao.impl;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

@DisplayName("🐘 PostgresPlaybackDebugRepository 方言单元测试")
public class PostgresPlaybackDebugRepositoryTest {

    @Test
    @DisplayName("验证 PostgreSQL 诊断表自增主键方言 (BIGSERIAL)")
    public void testAutoIncrementPkSql() {
        PostgresPlaybackDebugRepository repo = new PostgresPlaybackDebugRepository();
        assertEquals("id BIGSERIAL PRIMARY KEY", repo.getAutoIncrementPkSql());
    }
}
