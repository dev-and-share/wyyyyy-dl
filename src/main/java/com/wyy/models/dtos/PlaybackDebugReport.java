package com.wyy.models.dtos;

import lombok.Data;

/**
 * 📱 播放器运行状态与异常断播诊断上报实体
 * 仅记录脱敏后的曲目摘要、Audio 状态快照、预缓存指标与紧凑事件流。
 */
@Data
public class PlaybackDebugReport {
    private Long id;
    private Long createdAt;
    private String sessionId;
    private String deviceId;
    private String triggerType;
    private String appVersion;
    private String deviceInfo;
    private String trackSummary;
    private String audioSnapshot;
    private String precacheSnapshot;
    private String statsJson;
    private String eventsJson;
    private String note;
}
