package com.wyyyyydl.dao.impl;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Repository;

import java.io.File;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

/**
 * 本地 SQLite 单机环境系统配置实现类
 * 仅在无外部关系型数据源配置 (spring.datasource.url 为空) 且非 DynamoDB 模式时激活。
 */
@Repository("sqliteConfigRepository")
@Primary
@ConditionalOnExpression("T(org.apache.commons.lang3.StringUtils).isBlank('${spring.datasource.url:}') && !'dynamodb'.equalsIgnoreCase('${storage.type:}')")
@Slf4j
public class SqliteConfigRepository extends AbstractJdbcConfigRepository {

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
            log.info("💾 [SQLite Config] 启用本地 SQLite 系统配置仓储: {}", dbFile.getAbsolutePath());
            super.init();
        } catch (Exception e) {
            log.error("❌ [SQLite Config] 初始化 SQLite 配置仓储异常", e);
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
