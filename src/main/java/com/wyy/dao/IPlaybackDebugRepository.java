package com.wyy.dao;

import com.wyy.models.dtos.PlaybackDebugReport;
import java.util.List;

/**
 * 🩺 播放器运行诊断上报持久化仓储接口
 */
public interface IPlaybackDebugRepository {
    PlaybackDebugReport saveReport(PlaybackDebugReport report);

    List<PlaybackDebugReport> listRecentReports(int limit);

    int deleteAllReports();

    int countReports();
}
