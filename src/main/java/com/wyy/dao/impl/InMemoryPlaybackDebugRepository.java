package com.wyy.dao.impl;

import com.wyy.dao.IPlaybackDebugRepository;
import com.wyy.models.dtos.PlaybackDebugReport;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Repository;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.Iterator;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

/**
 * ☁️ 无服务器 DynamoDB 模式下使用的内存环形缓冲诊断仓储实现（无需额外建表即可安全启动）
 */
@Repository("inMemoryPlaybackDebugRepository")
@ConditionalOnProperty(name = "storage.type", havingValue = "dynamodb")
public class InMemoryPlaybackDebugRepository implements IPlaybackDebugRepository {

    private static final int MAX_RETAINED_REPORTS = 500;
    private final Deque<PlaybackDebugReport> buffer = new ArrayDeque<>();
    private final AtomicLong seq = new AtomicLong(1);

    @Override
    public synchronized PlaybackDebugReport saveReport(PlaybackDebugReport input) {
        if (input == null) {
            return null;
        }
        PlaybackDebugReport copy = new PlaybackDebugReport();
        copy.setId(seq.getAndIncrement());
        copy.setCreatedAt(input.getCreatedAt() != null && input.getCreatedAt() > 0
                ? input.getCreatedAt()
                : System.currentTimeMillis());
        copy.setSessionId(input.getSessionId());
        copy.setDeviceId(input.getDeviceId());
        copy.setTriggerType(input.getTriggerType() != null && !input.getTriggerType().isBlank()
                ? input.getTriggerType()
                : "manual");
        copy.setAppVersion(input.getAppVersion());
        copy.setDeviceInfo(input.getDeviceInfo());
        copy.setTrackSummary(input.getTrackSummary());
        copy.setAudioSnapshot(input.getAudioSnapshot());
        copy.setPrecacheSnapshot(input.getPrecacheSnapshot());
        copy.setStatsJson(input.getStatsJson());
        copy.setEventsJson(input.getEventsJson());
        copy.setNote(input.getNote());

        buffer.addFirst(copy);
        while (buffer.size() > MAX_RETAINED_REPORTS) {
            buffer.removeLast();
        }
        return copy;
    }

    @Override
    public synchronized List<PlaybackDebugReport> listRecentReports(int limit) {
        int safeLimit = Math.max(1, Math.min(200, limit));
        List<PlaybackDebugReport> list = new ArrayList<>();
        Iterator<PlaybackDebugReport> it = buffer.iterator();
        while (it.hasNext() && list.size() < safeLimit) {
            list.add(it.next());
        }
        return list;
    }

    @Override
    public synchronized int deleteAllReports() {
        int count = buffer.size();
        buffer.clear();
        return count;
    }

    @Override
    public synchronized int countReports() {
        return buffer.size();
    }
}
