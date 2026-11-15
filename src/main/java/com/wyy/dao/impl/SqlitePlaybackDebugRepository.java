package com.wyy.dao.impl;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Repository;

import java.io.File;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;

/**
 * 💾 本地 SQLite 播放器诊断上报仓储实现
 */
@Repository("sqlitePlaybackDebugRepository")
@Primary
@ConditionalOnExpression("T(org.apache.commons.lang3.StringUtils).isBlank('${spring.datasource.url:}') && !'dynamodb'.equalsIgnoreCase('${storage.type:}')")
@Slf4j
public class SqlitePlaybackDebugRepository extends AbstractJdbcPlaybackDebugRepository {

    @Value("${download.path:/media/music/}")
    private String downloadPath;

    private String dbUrl;

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
            super.init();
        } catch (Exception e) {
            log.error("❌ [SQLite PlaybackDebug] 初始化异常", e);
        }
    }

    @Override
    protected String getAutoIncrementPkSql() {
        return "id INTEGER PRIMARY KEY AUTOINCREMENT";
    }

    @Override
    protected void prepareConnection(Connection conn) throws SQLException {
        try (Statement stmt = conn.createStatement()) {
            stmt.execute("PRAGMA busy_timeout=5000;");
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
}
