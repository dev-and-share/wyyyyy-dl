package com.wyyyyydl.dao.impl;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.stereotype.Repository;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;

/**
 * PostgreSQL / AWS RDS / Supabase 云原生关系型数据库历史记录仓储实现
 * 当显式配置 spring.datasource.url (且非 DynamoDB 模式) 时激活。
 */
@Repository("postgresHistoryRepository")
@org.springframework.context.annotation.Primary
@ConditionalOnExpression("T(org.apache.commons.lang3.StringUtils).isNotBlank('${spring.datasource.url:}') && !'dynamodb'.equalsIgnoreCase('${storage.type:}')")
@Slf4j
public class PostgresHistoryRepository extends AbstractJdbcHistoryRepository {

    @Autowired
    private DataSource dataSource;

    @Override
    public void init() {
        log.info("🐘 [PostgreSQL] 检测到外部数据源配置，启用 PostgreSQL / RDS 仓储模式");
        super.init();
    }

    @Override
    protected Connection getConnection() throws SQLException {
        if (dataSource == null) {
            throw new SQLException("PostgreSQL DataSource 未初始化");
        }
        return dataSource.getConnection();
    }

    @Override
    protected String getAutoIncrementPkSql() {
        return "id BIGSERIAL PRIMARY KEY";
    }

    @Override
    protected String getBatchLikedSongsInsertSql() {
        return "INSERT INTO liked_songs (song_id, created_at) VALUES (?, CURRENT_TIMESTAMP) ON CONFLICT (song_id) DO NOTHING";
    }
}
