package com.wyyyyydl.dao.impl;

import com.wyyyyydl.dao.IConfigRepository;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

/**
 * 基于标准 JDBC 的通用配置仓储抽象基类 (适用于 SQLite / PostgreSQL / MySQL)
 */
@Slf4j
public abstract class AbstractJdbcConfigRepository implements IConfigRepository {

    @PostConstruct
    public void init() {
        initTable();
    }

    protected abstract Connection getConnection() throws SQLException;

    protected void initTable() {
        String createTableSql = "CREATE TABLE IF NOT EXISTS system_config (" +
                "config_key VARCHAR(128) PRIMARY KEY, " +
                "config_value TEXT, " +
                "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, " +
                "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                ")";
        try (Connection conn = getConnection();
             Statement stmt = conn.createStatement()) {
            stmt.executeUpdate(createTableSql);
            log.info("⚙️ [Config] system_config 表初始化检查完毕");
        } catch (Exception e) {
            log.error("❌ [Config] 初始化 system_config 表失败", e);
        }
    }

    @Override
    public void saveConfig(String key, String value) {
        if (key == null || key.trim().isEmpty()) return;
        try (Connection conn = getConnection()) {
            boolean exists = false;
            try (PreparedStatement check = conn.prepareStatement("SELECT 1 FROM system_config WHERE config_key = ?")) {
                check.setString(1, key.trim());
                try (ResultSet rs = check.executeQuery()) {
                    exists = rs.next();
                }
            }
            if (exists) {
                try (PreparedStatement update = conn.prepareStatement(
                        "UPDATE system_config SET config_value = ?, updated_at = CURRENT_TIMESTAMP WHERE config_key = ?")) {
                    update.setString(1, value);
                    update.setString(2, key.trim());
                    update.executeUpdate();
                }
            } else {
                try (PreparedStatement insert = conn.prepareStatement(
                        "INSERT INTO system_config (config_key, config_value) VALUES (?, ?)")) {
                    insert.setString(1, key.trim());
                    insert.setString(2, value);
                    insert.executeUpdate();
                }
            }
            log.debug("⚙️ [Config] 成功持久化配置: key={}", key);
        } catch (Exception e) {
            log.error("❌ [Config] 持久化系统配置失败: key={}", key, e);
        }
    }

    @Override
    public String getConfig(String key) {
        if (key == null || key.trim().isEmpty()) return null;
        try (Connection conn = getConnection();
             PreparedStatement stmt = conn.prepareStatement("SELECT config_value FROM system_config WHERE config_key = ?")) {
            stmt.setString(1, key.trim());
            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    return rs.getString("config_value");
                }
            }
        } catch (Exception e) {
            log.error("❌ [Config] 获取系统配置失败: key={}", key, e);
        }
        return null;
    }
}
