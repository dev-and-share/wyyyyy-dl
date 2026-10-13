package com.wyyyyydl.dao.impl;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.stereotype.Repository;

import java.io.File;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

/**
 * SQLite 本地单机轻量级历史记录仓储实现
 * 仅在无外部关系型数据源配置 (spring.datasource.url 为空) 且非 DynamoDB 模式时激活。
 */
@Slf4j
public class SqliteHistoryRepository extends AbstractJdbcHistoryRepository {

    protected String dbUrl;

    @Override
    public void init() {
        try {
            Class.forName("org.sqlite.JDBC");
            File dir = new File(downloadPath != null ? downloadPath : "/media/music/");
            if (!dir.exists()) {
                dir.mkdirs();
            }
            File dbFile = new File(dir, "downloads.db");
            this.dbUrl = "jdbc:sqlite:" + dbFile.getAbsolutePath();
            log.info("💾 [SQLite] 启用本地单机嵌入式 SQLite 数据库: {}", dbFile.getAbsolutePath());
            super.init();
        } catch (Exception e) {
            log.error("❌ [SQLite] 初始化 SQLite 驱动或数据库文件异常", e);
        }
    }

    @Override
    protected Connection getConnection() throws SQLException {
        if (dbUrl == null) {
            File dir = new File(downloadPath != null ? downloadPath : "/media/music/");
            File dbFile = new File(dir, "downloads.db");
            this.dbUrl = "jdbc:sqlite:" + dbFile.getAbsolutePath();
        }
        return DriverManager.getConnection(dbUrl);
    }

    @Override
    protected String getAutoIncrementPkSql() {
        return "id INTEGER PRIMARY KEY AUTOINCREMENT";
    }

    @Override
    protected String getBatchLikedSongsInsertSql() {
        return "INSERT OR IGNORE INTO liked_songs (song_id, created_at) VALUES (?, CURRENT_TIMESTAMP)";
    }
}
