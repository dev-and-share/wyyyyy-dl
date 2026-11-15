package com.wyy.dao.impl;

import com.wyy.dao.IPlaybackDebugRepository;
import com.wyy.models.dtos.PlaybackDebugReport;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

/**
 * 🩺 播放器诊断上报 JDBC 公共抽象基类 (SQLite / PostgreSQL 共享业务逻辑与自动淘汰策略)
 */
@Slf4j
public abstract class AbstractJdbcPlaybackDebugRepository implements IPlaybackDebugRepository {

    protected static final int MAX_RETAINED_REPORTS = 500;
    private static final int MAX_SHORT_FIELD_LEN = 256;
    private static final int MAX_JSON_FIELD_LEN = 8192;
    private static final int MAX_EVENTS_JSON_LEN = 131072;
    private static final int MAX_NOTE_LEN = 1024;

    protected abstract Connection getConnection() throws SQLException;

    protected abstract String getAutoIncrementPkSql();

    protected void prepareConnection(Connection conn) throws SQLException {
        // 默认空实现；SQLite 子类可设置 PRAGMA busy_timeout 避免与下载入库锁冲突
    }

    @PostConstruct
    public void init() {
        String createTableSql = "CREATE TABLE IF NOT EXISTS playback_debug_reports (" +
                getAutoIncrementPkSql() + ", " +
                "created_at BIGINT NOT NULL, " +
                "session_id VARCHAR(128), " +
                "device_id VARCHAR(128), " +
                "trigger_type VARCHAR(64) NOT NULL, " +
                "app_version VARCHAR(64), " +
                "device_info TEXT, " +
                "track_summary TEXT, " +
                "audio_snapshot TEXT, " +
                "precache_snapshot TEXT, " +
                "stats_json TEXT, " +
                "events_json TEXT, " +
                "note TEXT" +
                ")";
        String createIndexSql = "CREATE INDEX IF NOT EXISTS idx_playback_debug_created_at " +
                "ON playback_debug_reports (created_at DESC)";
        try (Connection conn = getConnection();
             Statement stmt = conn.createStatement()) {
            prepareConnection(conn);
            stmt.executeUpdate(createTableSql);
            stmt.executeUpdate(createIndexSql);
            log.info("✅ [PlaybackDebug] 诊断上报数据表初始化完成");
        } catch (Exception e) {
            log.error("❌ [PlaybackDebug] 初始化诊断上报数据表失败", e);
        }
    }

    @Override
    public PlaybackDebugReport saveReport(PlaybackDebugReport input) {
        if (input == null) {
            return null;
        }
        long createdAt = (input.getCreatedAt() != null && input.getCreatedAt() > 0)
                ? input.getCreatedAt()
                : System.currentTimeMillis();
        String triggerType = sanitize(input.getTriggerType(), MAX_SHORT_FIELD_LEN);
        if (triggerType.isEmpty()) {
            triggerType = "manual";
        }

        PlaybackDebugReport saved = new PlaybackDebugReport();
        saved.setCreatedAt(createdAt);
        saved.setSessionId(sanitize(input.getSessionId(), MAX_SHORT_FIELD_LEN));
        saved.setDeviceId(sanitize(input.getDeviceId(), MAX_SHORT_FIELD_LEN));
        saved.setTriggerType(triggerType);
        saved.setAppVersion(sanitize(input.getAppVersion(), MAX_SHORT_FIELD_LEN));
        saved.setDeviceInfo(sanitize(input.getDeviceInfo(), MAX_JSON_FIELD_LEN));
        saved.setTrackSummary(sanitize(input.getTrackSummary(), MAX_JSON_FIELD_LEN));
        saved.setAudioSnapshot(sanitize(input.getAudioSnapshot(), MAX_JSON_FIELD_LEN));
        saved.setPrecacheSnapshot(sanitize(input.getPrecacheSnapshot(), MAX_JSON_FIELD_LEN));
        saved.setStatsJson(sanitize(input.getStatsJson(), MAX_JSON_FIELD_LEN));
        saved.setEventsJson(sanitize(input.getEventsJson(), MAX_EVENTS_JSON_LEN));
        saved.setNote(sanitize(input.getNote(), MAX_NOTE_LEN));

        String insertSql = "INSERT INTO playback_debug_reports (" +
                "created_at, session_id, device_id, trigger_type, app_version, " +
                "device_info, track_summary, audio_snapshot, precache_snapshot, stats_json, events_json, note" +
                ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

        try (Connection conn = getConnection()) {
            prepareConnection(conn);
            try (PreparedStatement ps = conn.prepareStatement(insertSql, Statement.RETURN_GENERATED_KEYS)) {
                ps.setLong(1, saved.getCreatedAt());
                ps.setString(2, saved.getSessionId());
                ps.setString(3, saved.getDeviceId());
                ps.setString(4, saved.getTriggerType());
                ps.setString(5, saved.getAppVersion());
                ps.setString(6, saved.getDeviceInfo());
                ps.setString(7, saved.getTrackSummary());
                ps.setString(8, saved.getAudioSnapshot());
                ps.setString(9, saved.getPrecacheSnapshot());
                ps.setString(10, saved.getStatsJson());
                ps.setString(11, saved.getEventsJson());
                ps.setString(12, saved.getNote());
                ps.executeUpdate();
                try (ResultSet rs = ps.getGeneratedKeys()) {
                    if (rs.next()) {
                        saved.setId(rs.getLong(1));
                    }
                }
            }
            pruneExcessReports(conn);
        } catch (Exception e) {
            log.error("❌ [PlaybackDebug] 保存诊断报告异常", e);
        }
        return saved;
    }

    @Override
    public List<PlaybackDebugReport> listRecentReports(int limit) {
        int safeLimit = Math.max(1, Math.min(200, limit));
        List<PlaybackDebugReport> result = new ArrayList<>();
        String sql = "SELECT id, created_at, session_id, device_id, trigger_type, app_version, " +
                "device_info, track_summary, audio_snapshot, precache_snapshot, stats_json, events_json, note " +
                "FROM playback_debug_reports ORDER BY created_at DESC, id DESC LIMIT ?";
        try (Connection conn = getConnection()) {
            prepareConnection(conn);
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setInt(1, safeLimit);
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        PlaybackDebugReport item = new PlaybackDebugReport();
                        item.setId(rs.getLong("id"));
                        item.setCreatedAt(rs.getLong("created_at"));
                        item.setSessionId(rs.getString("session_id"));
                        item.setDeviceId(rs.getString("device_id"));
                        item.setTriggerType(rs.getString("trigger_type"));
                        item.setAppVersion(rs.getString("app_version"));
                        item.setDeviceInfo(rs.getString("device_info"));
                        item.setTrackSummary(rs.getString("track_summary"));
                        item.setAudioSnapshot(rs.getString("audio_snapshot"));
                        item.setPrecacheSnapshot(rs.getString("precache_snapshot"));
                        item.setStatsJson(rs.getString("stats_json"));
                        item.setEventsJson(rs.getString("events_json"));
                        item.setNote(rs.getString("note"));
                        result.add(item);
                    }
                }
            }
        } catch (Exception e) {
            log.error("❌ [PlaybackDebug] 查询诊断报告异常", e);
        }
        return result;
    }

    @Override
    public int deleteAllReports() {
        String sql = "DELETE FROM playback_debug_reports";
        try (Connection conn = getConnection()) {
            prepareConnection(conn);
            try (Statement stmt = conn.createStatement()) {
                return stmt.executeUpdate(sql);
            }
        } catch (Exception e) {
            log.error("❌ [PlaybackDebug] 清空诊断报告异常", e);
            return 0;
        }
    }

    @Override
    public int countReports() {
        String sql = "SELECT COUNT(*) FROM playback_debug_reports";
        try (Connection conn = getConnection()) {
            prepareConnection(conn);
            try (Statement stmt = conn.createStatement();
                 ResultSet rs = stmt.executeQuery(sql)) {
                if (rs.next()) {
                    return rs.getInt(1);
                }
            }
        } catch (Exception e) {
            log.error("❌ [PlaybackDebug] 统计诊断报告数量异常", e);
        }
        return 0;
    }

    private void pruneExcessReports(Connection conn) {
        String pruneSql = "DELETE FROM playback_debug_reports WHERE id NOT IN (" +
                "SELECT id FROM playback_debug_reports ORDER BY created_at DESC, id DESC LIMIT ?" +
                ")";
        try (PreparedStatement ps = conn.prepareStatement(pruneSql)) {
            ps.setInt(1, getMaxRetainedReports());
            ps.executeUpdate();
        } catch (Exception e) {
            log.warn("⚠️ [PlaybackDebug] 自动淘汰超限诊断报告失败: {}", e.getMessage());
        }
    }

    protected int getMaxRetainedReports() {
        return MAX_RETAINED_REPORTS;
    }

    private static String sanitize(String val, int maxLen) {
        if (val == null) {
            return "";
        }
        return val.length() <= maxLen ? val : val.substring(0, maxLen);
    }
}
