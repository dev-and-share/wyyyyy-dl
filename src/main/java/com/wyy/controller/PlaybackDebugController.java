package com.wyy.controller;

import com.wyy.dao.IPlaybackDebugRepository;
import com.wyy.enums.CommonRespInfo;
import com.wyy.models.common.RespEntity;
import com.wyy.models.dtos.PlaybackDebugReport;
import com.wyy.service.AuthContextService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 🩺 播放器运行态与异常断播诊断日志控制器
 */
@Slf4j
@RestController
@RequestMapping("/v3/debug/playback")
public class PlaybackDebugController {

    private final IPlaybackDebugRepository repository;

    @Autowired(required = false)
    private AuthContextService authContextService;

    public PlaybackDebugController(IPlaybackDebugRepository repository) {
        this.repository = repository;
    }

    /**
     * 接收前端自动上报（异常断播/看门狗超时/后台被杀恢复）或手动快照上报
     */
    @PostMapping
    public RespEntity<PlaybackDebugReport> submitReport(@RequestBody(required = false) PlaybackDebugReport report) {
        if (report == null) {
            return RespEntity.apply(CommonRespInfo.NOT_LEGAL_PARAM.getCode(), "诊断上报内容不能为空", null);
        }
        PlaybackDebugReport saved = repository.saveReport(report);
        log.info("🩺 [PlaybackDebug] 已记录诊断上报: id={}, trigger={}, session={}",
                saved != null ? saved.getId() : null,
                saved != null ? saved.getTriggerType() : null,
                saved != null ? saved.getSessionId() : null);
        return RespEntity.apply(CommonRespInfo.SUCCESS, saved);
    }

    /**
     * 查询最近的诊断上报列表
     */
    @GetMapping
    public RespEntity<Map<String, Object>> listReports(
            @RequestParam(value = "limit", defaultValue = "50") int limit) {
        if (authContextService != null && authContextService.isAuthEnabled() && !authContextService.isAdmin()) {
            return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR.getCode(), "仅管理员可查看服务端诊断日志", null);
        }
        List<PlaybackDebugReport> items = repository.listRecentReports(limit);
        Map<String, Object> data = new HashMap<>();
        data.put("items", items);
        data.put("total", repository.countReports());
        return RespEntity.apply(CommonRespInfo.SUCCESS, data);
    }

    /**
     * 清空服务端保存的诊断日志
     */
    @DeleteMapping
    public RespEntity<Map<String, Object>> clearReports() {
        if (authContextService != null && authContextService.isAuthEnabled() && !authContextService.isAdmin()) {
            return RespEntity.apply(CommonRespInfo.SERVICE_EXECUTION_ERROR.getCode(), "仅管理员可清理服务端诊断日志", null);
        }
        int deleted = repository.deleteAllReports();
        Map<String, Object> data = new HashMap<>();
        data.put("deleted", deleted);
        return RespEntity.apply(CommonRespInfo.SUCCESS, data);
    }
}
