package com.wyy.dao.impl;

import com.wyy.dao.IAiStudioRepository;
import com.wyy.models.dtos.AiProjectDTO;
import com.wyy.models.dtos.AiRenderedAssetDTO;
import com.wyy.models.dtos.AiSessionHistoryDTO;
import com.wyy.models.dtos.AiSongAnalysisDTO;
import com.wyy.models.dtos.AiTrackPromptDTO;
import com.wyy.models.dtos.AiVersionPlanDTO;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * 🎨 AI 创作工坊与资产存储抽象基类 (SQLite / PostgreSQL 共享实现)
 */
@Slf4j
public abstract class AbstractJdbcAiStudioRepository implements IAiStudioRepository {

    protected abstract Connection getConnection() throws SQLException;

    protected abstract String getAutoIncrementPkSql();

    protected void prepareConnection(Connection conn) throws SQLException {
    }

    @PostConstruct
    public void init() {
        String createProjectTableSql = "CREATE TABLE IF NOT EXISTS ai_project (" +
                "id VARCHAR(64) PRIMARY KEY, " +
                "ref_song_id VARCHAR(64), " +
                "ref_song_title VARCHAR(255), " +
                "ref_artist VARCHAR(255), " +
                "genre_category VARCHAR(128), " +
                "project_dir TEXT, " +
                "status VARCHAR(32), " +
                "analysis_report TEXT, " +
                "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, " +
                "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                ")";

        String createSessionTableSql = "CREATE TABLE IF NOT EXISTS ai_session_history (" +
                "id VARCHAR(64) PRIMARY KEY, " +
                "project_id VARCHAR(64), " +
                "version_label VARCHAR(64), " +
                "engine_type VARCHAR(32), " +
                "session_id VARCHAR(128), " +
                "role VARCHAR(32), " +
                "content TEXT, " +
                "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                ")";

        String createPromptTableSql = "CREATE TABLE IF NOT EXISTS ai_track_prompt (" +
                "id VARCHAR(64) PRIMARY KEY, " +
                "project_id VARCHAR(64), " +
                "version_label VARCHAR(64), " +
                "model_name VARCHAR(64), " +
                "track_title VARCHAR(255), " +
                "prompt_content TEXT, " +
                "lyrics_plan TEXT, " +
                "model_params_json TEXT, " +
                "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                ")";

        String createAssetTableSql = "CREATE TABLE IF NOT EXISTS ai_rendered_asset (" +
                "id VARCHAR(64) PRIMARY KEY, " +
                "project_id VARCHAR(64), " +
                "track_prompt_id VARCHAR(64), " +
                "audio_path TEXT, " +
                "audio_duration_seconds REAL, " +
                "sample_rate INT, " +
                "bitrate INT, " +
                "spectral_entropy REAL, " +
                "rms_std REAL, " +
                "qa_passed INT DEFAULT 0, " +
                "synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                ")";

        String createAnalysisTableSql = "CREATE TABLE IF NOT EXISTS ai_song_analysis (" +
                "ref_song_id VARCHAR(64) PRIMARY KEY, " +
                "title VARCHAR(255), " +
                "artist VARCHAR(255), " +
                "album VARCHAR(255), " +
                "duration INT, " +
                "format VARCHAR(32), " +
                "bitrate INT, " +
                "sample_rate INT, " +
                "genre VARCHAR(128), " +
                "lyric TEXT, " +
                "mood TEXT, " +
                "instrumentation TEXT, " +
                "estimated_bpm INT, " +
                "estimated_key VARCHAR(64), " +
                "analysis_summary TEXT, " +
                "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                ")";

        String createVersionPlanTableSql = "CREATE TABLE IF NOT EXISTS ai_version_plan (" +
                "id VARCHAR(128) PRIMARY KEY, " +
                "project_id VARCHAR(64), " +
                "version_label VARCHAR(64), " +
                "plan_title VARCHAR(255), " +
                "genre VARCHAR(128), " +
                "bpm INT, " +
                "musical_key VARCHAR(64), " +
                "arrangement_notes TEXT, " +
                "lyrics_text TEXT, " +
                "session_id VARCHAR(128), " +
                "applied_models TEXT, " +
                "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                ")";

        try (Connection conn = getConnection();
             Statement stmt = conn.createStatement()) {
            prepareConnection(conn);
            stmt.executeUpdate(createProjectTableSql);
            stmt.executeUpdate(createSessionTableSql);
            stmt.executeUpdate(createPromptTableSql);
            stmt.executeUpdate(createAssetTableSql);
            stmt.executeUpdate(createAnalysisTableSql);
            stmt.executeUpdate(createVersionPlanTableSql);

            try {
                stmt.executeUpdate("ALTER TABLE ai_session_history ADD COLUMN version_label VARCHAR(64)");
            } catch (Exception ignored) {
                // 列已存在或表刚新建，忽略
            }

            stmt.executeUpdate("CREATE INDEX IF NOT EXISTS idx_ai_sess_proj ON ai_session_history(project_id)");
            stmt.executeUpdate("CREATE INDEX IF NOT EXISTS idx_ai_prompt_proj ON ai_track_prompt(project_id)");
            stmt.executeUpdate("CREATE INDEX IF NOT EXISTS idx_ai_asset_proj ON ai_rendered_asset(project_id)");

            log.info("✅ [AI Studio DB] AI 创作工坊与资产表结构初始化完成");
        } catch (Exception e) {
            log.error("❌ [AI Studio DB] 初始化数据表异常", e);
        }
    }

    @Override
    public void saveProject(AiProjectDTO p) {
        String sql = "INSERT INTO ai_project (id, ref_song_id, ref_song_title, ref_artist, " +
                "genre_category, project_dir, status, analysis_report, created_at, updated_at) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) " +
                "ON CONFLICT(id) DO UPDATE SET " +
                "ref_song_title = excluded.ref_song_title, " +
                "ref_artist = excluded.ref_artist, " +
                "genre_category = excluded.genre_category, " +
                "status = excluded.status, " +
                "analysis_report = excluded.analysis_report, " +
                "updated_at = CURRENT_TIMESTAMP";

        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            prepareConnection(conn);
            ps.setString(1, p.getId());
            ps.setString(2, p.getRefSongId());
            ps.setString(3, p.getRefSongTitle());
            ps.setString(4, p.getRefArtist());
            ps.setString(5, p.getGenreCategory());
            ps.setString(6, p.getProjectDir());
            ps.setString(7, p.getStatus());
            ps.setString(8, p.getAnalysisReport());
            ps.executeUpdate();
        } catch (Exception e) {
            log.error("❌ [AI Studio DB] 保存工程失败: id={}", p.getId(), e);
        }
    }

    @Override
    public AiProjectDTO getProjectById(String id) {
        String sql = "SELECT * FROM ai_project WHERE id = ?";
        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            prepareConnection(conn);
            ps.setString(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    AiProjectDTO p = mapProject(rs);
                    p.setTrackPrompts(getTrackPromptsByProjectId(id));
                    p.setVersionPlans(getVersionPlansByProjectId(id));
                    p.setRenderedAssets(getRenderedAssetsByProjectId(id));
                    p.setSessionHistories(getSessionHistories(id));
                    return p;
                }
            }
        } catch (Exception e) {
            log.error("❌ [AI Studio DB] 查询工程失败: id={}", id, e);
        }
        return null;
    }

    @Override
    public List<AiProjectDTO> listProjects(int limit) {
        List<AiProjectDTO> list = new ArrayList<>();
        String sql = "SELECT * FROM ai_project ORDER BY created_at DESC LIMIT ?";
        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            prepareConnection(conn);
            ps.setInt(1, limit > 0 ? limit : 50);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(mapProject(rs));
                }
            }
        } catch (Exception e) {
            log.error("❌ [AI Studio DB] 列表查询失败", e);
        }
        return list;
    }

    @Override
    public void updateProjectStatus(String id, String status) {
        String sql = "UPDATE ai_project SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?";
        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            prepareConnection(conn);
            ps.setString(1, status);
            ps.setString(2, id);
            ps.executeUpdate();
        } catch (Exception e) {
            log.error("❌ [AI Studio DB] 更新状态失败: id={}", id, e);
        }
    }

    @Override
    public void saveSessionHistory(AiSessionHistoryDTO s) {
        String sql = "INSERT INTO ai_session_history (id, project_id, version_label, engine_type, session_id, role, content) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?)";
        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            prepareConnection(conn);
            ps.setString(1, s.getId());
            ps.setString(2, s.getProjectId());
            ps.setString(3, s.getVersionLabel());
            ps.setString(4, s.getEngineType());
            ps.setString(5, s.getSessionId());
            ps.setString(6, s.getRole());
            ps.setString(7, s.getContent());
            ps.executeUpdate();
        } catch (Exception e) {
            log.error("❌ [AI Studio DB] 保存会话历史失败", e);
        }
    }

    @Override
    public List<AiSessionHistoryDTO> getSessionHistories(String projectId) {
        List<AiSessionHistoryDTO> list = new ArrayList<>();
        String sql = "SELECT * FROM ai_session_history WHERE project_id = ? ORDER BY created_at ASC";
        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            prepareConnection(conn);
            ps.setString(1, projectId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String vLabel = null;
                    try {
                        vLabel = rs.getString("version_label");
                    } catch (Exception ignored) {}
                    list.add(AiSessionHistoryDTO.builder()
                            .id(rs.getString("id"))
                            .projectId(rs.getString("project_id"))
                            .versionLabel(vLabel)
                            .engineType(rs.getString("engine_type"))
                            .sessionId(rs.getString("session_id"))
                            .role(rs.getString("role"))
                            .content(rs.getString("content"))
                            .createdAt(rs.getString("created_at"))
                            .build());
                }
            }
        } catch (Exception e) {
            log.error("❌ [AI Studio DB] 查询会话历史失败: projectId={}", projectId, e);
        }
        return list;
    }

    @Override
    public void saveTrackPrompts(List<AiTrackPromptDTO> prompts) {
        if (prompts == null || prompts.isEmpty()) return;
        String sql = "INSERT INTO ai_track_prompt (id, project_id, version_label, model_name, " +
                "track_title, prompt_content, lyrics_plan, model_params_json) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?) " +
                "ON CONFLICT(id) DO UPDATE SET " +
                "track_title = excluded.track_title, " +
                "prompt_content = excluded.prompt_content, " +
                "lyrics_plan = excluded.lyrics_plan, " +
                "model_params_json = excluded.model_params_json";

        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            prepareConnection(conn);
            for (AiTrackPromptDTO p : prompts) {
                ps.setString(1, p.getId());
                ps.setString(2, p.getProjectId());
                ps.setString(3, p.getVersionLabel());
                ps.setString(4, p.getModelName());
                ps.setString(5, p.getTrackTitle());
                ps.setString(6, p.getPromptContent());
                ps.setString(7, p.getLyricsPlan());
                ps.setString(8, p.getModelParamsJson());
                ps.addBatch();
            }
            ps.executeBatch();
        } catch (Exception e) {
            log.error("❌ [AI Studio DB] 批量保存 Prompt 失败", e);
        }
    }

    @Override
    public List<AiTrackPromptDTO> getTrackPromptsByProjectId(String projectId) {
        List<AiTrackPromptDTO> list = new ArrayList<>();
        String sql = "SELECT * FROM ai_track_prompt WHERE project_id = ? ORDER BY id ASC";
        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            prepareConnection(conn);
            ps.setString(1, projectId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(AiTrackPromptDTO.builder()
                            .id(rs.getString("id"))
                            .projectId(rs.getString("project_id"))
                            .versionLabel(rs.getString("version_label"))
                            .modelName(rs.getString("model_name"))
                            .trackTitle(rs.getString("track_title"))
                            .promptContent(rs.getString("prompt_content"))
                            .lyricsPlan(rs.getString("lyrics_plan"))
                            .modelParamsJson(rs.getString("model_params_json"))
                            .createdAt(rs.getString("created_at"))
                            .build());
                }
            }
        } catch (Exception e) {
            log.error("❌ [AI Studio DB] 查询 Prompt 失败: projectId={}", projectId, e);
        }
        return list;
    }

    @Override
    public void saveRenderedAsset(AiRenderedAssetDTO asset) {
        String sql = "INSERT INTO ai_rendered_asset (id, project_id, track_prompt_id, audio_path, " +
                "audio_duration_seconds, sample_rate, bitrate, spectral_entropy, rms_std, qa_passed) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
                "ON CONFLICT(id) DO UPDATE SET " +
                "audio_path = excluded.audio_path, " +
                "audio_duration_seconds = excluded.audio_duration_seconds, " +
                "sample_rate = excluded.sample_rate, " +
                "bitrate = excluded.bitrate, " +
                "spectral_entropy = excluded.spectral_entropy, " +
                "rms_std = excluded.rms_std, " +
                "qa_passed = excluded.qa_passed, " +
                "synced_at = CURRENT_TIMESTAMP";

        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            prepareConnection(conn);
            ps.setString(1, asset.getId());
            ps.setString(2, asset.getProjectId());
            ps.setString(3, asset.getTrackPromptId());
            ps.setString(4, asset.getAudioPath());
            ps.setObject(5, asset.getAudioDurationSeconds());
            ps.setObject(6, asset.getSampleRate());
            ps.setObject(7, asset.getBitrate());
            ps.setObject(8, asset.getSpectralEntropy());
            ps.setObject(9, asset.getRmsStd());
            ps.setInt(10, asset.getQaPassed() != null ? asset.getQaPassed() : 0);
            ps.executeUpdate();
        } catch (Exception e) {
            log.error("❌ [AI Studio DB] 保存渲染资产失败: id={}", asset.getId(), e);
        }
    }

    @Override
    public List<AiRenderedAssetDTO> getRenderedAssetsByProjectId(String projectId) {
        List<AiRenderedAssetDTO> list = new ArrayList<>();
        String sql = "SELECT * FROM ai_rendered_asset WHERE project_id = ? ORDER BY id ASC";
        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            prepareConnection(conn);
            ps.setString(1, projectId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(AiRenderedAssetDTO.builder()
                            .id(rs.getString("id"))
                            .projectId(rs.getString("project_id"))
                            .trackPromptId(rs.getString("track_prompt_id"))
                            .audioPath(rs.getString("audio_path"))
                            .audioDurationSeconds(rs.getDouble("audio_duration_seconds"))
                            .sampleRate(rs.getInt("sample_rate"))
                            .bitrate(rs.getInt("bitrate"))
                            .spectralEntropy(rs.getDouble("spectral_entropy"))
                            .rmsStd(rs.getDouble("rms_std"))
                            .qaPassed(rs.getInt("qa_passed"))
                            .syncedAt(rs.getString("synced_at"))
                            .build());
                }
            }
        } catch (Exception e) {
            log.error("❌ [AI Studio DB] 查询渲染资产失败: projectId={}", projectId, e);
        }
        return list;
    }

    @Override
    public void saveSongAnalysis(AiSongAnalysisDTO a) {
        if (a == null || a.getRefSongId() == null) return;
        String sql = "INSERT INTO ai_song_analysis (ref_song_id, title, artist, album, duration, format, bitrate, " +
                "sample_rate, genre, lyric, mood, instrumentation, estimated_bpm, estimated_key, analysis_summary, updated_at) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) " +
                "ON CONFLICT(ref_song_id) DO UPDATE SET " +
                "title = excluded.title, artist = excluded.artist, album = excluded.album, " +
                "duration = excluded.duration, format = excluded.format, bitrate = excluded.bitrate, " +
                "sample_rate = excluded.sample_rate, genre = excluded.genre, lyric = excluded.lyric, " +
                "mood = excluded.mood, instrumentation = excluded.instrumentation, estimated_bpm = excluded.estimated_bpm, " +
                "estimated_key = excluded.estimated_key, analysis_summary = excluded.analysis_summary, " +
                "updated_at = CURRENT_TIMESTAMP";
        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            prepareConnection(conn);
            ps.setString(1, a.getRefSongId());
            ps.setString(2, a.getTitle());
            ps.setString(3, a.getArtist());
            ps.setString(4, a.getAlbum());
            ps.setObject(5, a.getDuration());
            ps.setString(6, a.getFormat());
            ps.setObject(7, a.getBitrate());
            ps.setObject(8, a.getSampleRate());
            ps.setString(9, a.getGenre());
            ps.setString(10, a.getLyric());
            ps.setString(11, a.getMood());
            ps.setString(12, a.getInstrumentation());
            ps.setObject(13, a.getEstimatedBpm());
            ps.setString(14, a.getEstimatedKey());
            ps.setString(15, a.getAnalysisSummary());
            ps.executeUpdate();
        } catch (Exception e) {
            log.error("❌ [AI Studio DB] 保存原曲分析结果失败: songId={}", a.getRefSongId(), e);
        }
    }

    @Override
    public AiSongAnalysisDTO getSongAnalysisBySongId(String refSongId) {
        if (refSongId == null) return null;
        String sql = "SELECT * FROM ai_song_analysis WHERE ref_song_id = ?";
        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            prepareConnection(conn);
            ps.setString(1, refSongId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return AiSongAnalysisDTO.builder()
                            .refSongId(rs.getString("ref_song_id"))
                            .title(rs.getString("title"))
                            .artist(rs.getString("artist"))
                            .album(rs.getString("album"))
                            .duration(rs.getObject("duration") != null ? rs.getInt("duration") : null)
                            .format(rs.getString("format"))
                            .bitrate(rs.getObject("bitrate") != null ? rs.getInt("bitrate") : null)
                            .sampleRate(rs.getObject("sample_rate") != null ? rs.getInt("sample_rate") : null)
                            .genre(rs.getString("genre"))
                            .lyric(rs.getString("lyric"))
                            .mood(rs.getString("mood"))
                            .instrumentation(rs.getString("instrumentation"))
                            .estimatedBpm(rs.getObject("estimated_bpm") != null ? rs.getInt("estimated_bpm") : null)
                            .estimatedKey(rs.getString("estimated_key"))
                            .analysisSummary(rs.getString("analysis_summary"))
                            .build();
                }
            }
        } catch (Exception e) {
            log.error("❌ [AI Studio DB] 查询原曲分析缓存失败: songId={}", refSongId, e);
        }
        return null;
    }

    @Override
    public AiProjectDTO getLatestProjectBySongId(String refSongId) {
        if (refSongId == null) return null;
        String sql = "SELECT id FROM ai_project WHERE ref_song_id = ? ORDER BY updated_at DESC LIMIT 1";
        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            prepareConnection(conn);
            ps.setString(1, refSongId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return getProjectById(rs.getString("id"));
                }
            }
        } catch (Exception e) {
            log.error("❌ [AI Studio DB] 按曲目查询最新工程失败: songId={}", refSongId, e);
        }
        return null;
    }

    @Override
    public void deleteTrackPromptsByProjectAndVersion(String projectId, String versionLabel) {
        String sql = "DELETE FROM ai_track_prompt WHERE project_id = ? AND version_label = ?";
        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            prepareConnection(conn);
            ps.setString(1, projectId);
            ps.setString(2, versionLabel);
            ps.executeUpdate();
        } catch (Exception e) {
            log.error("❌ [AI Studio DB] 删除版本关联音轨失败: projectId={}, version={}", projectId, versionLabel, e);
        }
    }

    @Override
    public void saveVersionPlans(List<AiVersionPlanDTO> plans) {
        if (plans == null || plans.isEmpty()) return;
        String sql = "INSERT INTO ai_version_plan (id, project_id, version_label, plan_title, genre, bpm, " +
                "musical_key, arrangement_notes, lyrics_text, session_id, applied_models, updated_at) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) " +
                "ON CONFLICT(id) DO UPDATE SET " +
                "plan_title = excluded.plan_title, genre = excluded.genre, bpm = excluded.bpm, " +
                "musical_key = excluded.musical_key, arrangement_notes = excluded.arrangement_notes, " +
                "lyrics_text = excluded.lyrics_text, session_id = excluded.session_id, " +
                "applied_models = excluded.applied_models, updated_at = CURRENT_TIMESTAMP";
        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            prepareConnection(conn);
            for (AiVersionPlanDTO plan : plans) {
                ps.setString(1, plan.getId());
                ps.setString(2, plan.getProjectId());
                ps.setString(3, plan.getVersionLabel());
                ps.setString(4, plan.getPlanTitle());
                ps.setString(5, plan.getGenre());
                ps.setObject(6, plan.getBpm());
                ps.setString(7, plan.getMusicalKey());
                ps.setString(8, plan.getArrangementNotes());
                ps.setString(9, plan.getLyricsText());
                ps.setString(10, plan.getSessionId());
                ps.setString(11, plan.getAppliedModels() != null ? String.join(",", plan.getAppliedModels()) : "");
                ps.addBatch();
            }
            ps.executeBatch();
        } catch (Exception e) {
            log.error("❌ [AI Studio DB] 批量保存版本歌词编曲方案失败", e);
        }
    }

    @Override
    public List<AiVersionPlanDTO> getVersionPlansByProjectId(String projectId) {
        List<AiVersionPlanDTO> list = new ArrayList<>();
        String sql = "SELECT * FROM ai_version_plan WHERE project_id = ? ORDER BY version_label ASC";
        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            prepareConnection(conn);
            ps.setString(1, projectId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String modelsRaw = rs.getString("applied_models");
                    List<String> models = StringUtils.isNotBlank(modelsRaw)
                            ? Arrays.asList(modelsRaw.split(","))
                            : new ArrayList<>();
                    list.add(AiVersionPlanDTO.builder()
                            .id(rs.getString("id"))
                            .projectId(rs.getString("project_id"))
                            .versionLabel(rs.getString("version_label"))
                            .planTitle(rs.getString("plan_title"))
                            .genre(rs.getString("genre"))
                            .bpm(rs.getObject("bpm") != null ? rs.getInt("bpm") : null)
                            .musicalKey(rs.getString("musical_key"))
                            .arrangementNotes(rs.getString("arrangement_notes"))
                            .lyricsText(rs.getString("lyrics_text"))
                            .sessionId(rs.getString("session_id"))
                            .appliedModels(models)
                            .updatedAt(rs.getString("updated_at"))
                            .build());
                }
            }
        } catch (Exception e) {
            log.error("❌ [AI Studio DB] 查询版本歌词编曲方案失败: projectId={}", projectId, e);
        }
        return list;
    }

    @Override
    public boolean deleteProject(String id) {
        String sql = "DELETE FROM ai_project WHERE id = ?";
        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            prepareConnection(conn);
            ps.setString(1, id);
            return ps.executeUpdate() > 0;
        } catch (Exception e) {
            log.error("❌ [AI Studio DB] 删除工程失败: id={}", id, e);
            return false;
        }
    }

    private AiProjectDTO mapProject(ResultSet rs) throws SQLException {
        return AiProjectDTO.builder()
                .id(rs.getString("id"))
                .refSongId(rs.getString("ref_song_id"))
                .refSongTitle(rs.getString("ref_song_title"))
                .refArtist(rs.getString("ref_artist"))
                .genreCategory(rs.getString("genre_category"))
                .projectDir(rs.getString("project_dir"))
                .status(rs.getString("status"))
                .analysisReport(rs.getString("analysis_report"))
                .createdAt(rs.getString("created_at"))
                .updatedAt(rs.getString("updated_at"))
                .build();
    }
}
