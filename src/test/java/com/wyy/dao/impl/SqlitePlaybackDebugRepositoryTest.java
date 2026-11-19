package com.wyy.dao.impl;

import com.wyy.models.dtos.PlaybackDebugReport;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.util.FileSystemUtils;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("🩺 SqlitePlaybackDebugRepository 诊断报告持久化与自动淘汰单元测试")
public class SqlitePlaybackDebugRepositoryTest {

    private SqlitePlaybackDebugRepository repo;
    private Path tempDir;

    @BeforeEach
    public void setUp() throws Exception {
        tempDir = Files.createTempDirectory("sqlite_playback_debug_test");
        repo = new SqlitePlaybackDebugRepository() {
            @Override
            protected int getMaxRetainedReports() {
                return 5;
            }
        };
        ReflectionTestUtils.setField(repo, "downloadPath", tempDir.toAbsolutePath().toString());
        repo.init();
    }

    @AfterEach
    public void tearDown() throws Exception {
        if (tempDir != null && Files.exists(tempDir)) {
            FileSystemUtils.deleteRecursively(tempDir);
        }
    }

    @Test
    @DisplayName("保存、倒序查询与清空诊断报告")
    public void testSaveListAndDelete() {
        PlaybackDebugReport first = buildReport("audio_error", 1000L, "first");
        PlaybackDebugReport second = buildReport("watchdog_timeout", 2000L, "second");

        PlaybackDebugReport saved1 = repo.saveReport(first);
        PlaybackDebugReport saved2 = repo.saveReport(second);

        assertNotNull(saved1.getId());
        assertNotNull(saved2.getId());
        assertEquals(2, repo.countReports());

        List<PlaybackDebugReport> list = repo.listRecentReports(10);
        assertEquals(2, list.size());
        assertEquals("watchdog_timeout", list.get(0).getTriggerType());
        assertEquals("second", list.get(0).getNote());
        assertEquals("audio_error", list.get(1).getTriggerType());

        int deleted = repo.deleteAllReports();
        assertEquals(2, deleted);
        assertEquals(0, repo.countReports());
        assertTrue(repo.listRecentReports(10).isEmpty());
    }

    @Test
    @DisplayName("超出最大保留条数时自动淘汰最旧记录")
    public void testPrunesOldReportsBeyondLimit() {
        for (int i = 1; i <= 7; i++) {
            repo.saveReport(buildReport("manual", i * 1000L, "note-" + i));
        }
        assertEquals(5, repo.countReports());

        List<PlaybackDebugReport> remaining = repo.listRecentReports(20);
        assertEquals(5, remaining.size());
        assertEquals("note-7", remaining.get(0).getNote());
        assertEquals("note-3", remaining.get(4).getNote());
    }

    private static PlaybackDebugReport buildReport(String trigger, long createdAt, String note) {
        PlaybackDebugReport r = new PlaybackDebugReport();
        r.setCreatedAt(createdAt);
        r.setSessionId("sess-1");
        r.setDeviceId("dev-1");
        r.setTriggerType(trigger);
        r.setAppVersion("1.0.0");
        r.setDeviceInfo("{\"ios\":true}");
        r.setTrackSummary("{\"id\":\"123\"}");
        r.setAudioSnapshot("{\"readyState\":2}");
        r.setPrecacheSnapshot("{\"preloaded\":true}");
        r.setStatsJson("{\"audioErrors\":1}");
        r.setEventsJson("[{\"t\":1000,\"type\":\"audio_error\"}]");
        r.setNote(note);
        return r;
    }
}
