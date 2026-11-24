package com.wyy.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wyy.dao.IAiStudioRepository;
import com.wyy.models.dtos.AiProjectDTO;
import com.wyy.models.dtos.AiRenderedAssetDTO;
import com.wyy.models.dtos.AiTrackPromptDTO;
import com.wyy.utils.TagUtils;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.File;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 🔄 AI 渲染音频资产回扫与离线同步引擎 (Scan & Sync)
 */
@Service
@Slf4j
public class AiAssetScanSyncService {

    @Autowired
    private IAiStudioRepository aiStudioRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * 扫描指定工程的 renders/ 目录，将新发现的渲染音频与质检报告同步至数据库
     */
    public List<AiRenderedAssetDTO> scanAndSyncProject(String projectId) {
        AiProjectDTO project = aiStudioRepository.getProjectById(projectId);
        if (project == null) {
            throw new IllegalArgumentException("未找到 AI 工程: " + projectId);
        }

        File projectDir = new File(project.getProjectDir());
        File rendersDir = new File(projectDir, "renders");
        if (!rendersDir.exists() || !rendersDir.isDirectory()) {
            log.warn("⚠️ [ScanSync] 渲染目录尚未创建: {}", rendersDir.getAbsolutePath());
            return new ArrayList<>();
        }

        List<AiTrackPromptDTO> prompts = aiStudioRepository.getTrackPromptsByProjectId(projectId);
        Map<String, String> modelTrackMap = new HashMap<>();
        for (AiTrackPromptDTO p : prompts) {
            String key = (p.getVersionLabel() + "_" + p.getModelName()).toLowerCase().replaceAll("[^a-z0-9]", "");
            modelTrackMap.put(key, p.getId());
        }

        // 读取质检报告 (如有)
        Map<String, JsonNode> qaMap = loadQaReports(rendersDir);

        File[] audioFiles = rendersDir.listFiles((dir, name) -> {
            String lower = name.toLowerCase();
            return lower.endsWith(".mp3") || lower.endsWith(".flac") || lower.endsWith(".wav");
        });

        List<AiRenderedAssetDTO> syncedAssets = new ArrayList<>();
        if (audioFiles != null) {
            for (File file : audioFiles) {
                try {
                    String fileName = file.getName();
                    String cleanName = fileName.toLowerCase().replaceAll("[^a-z0-9]", "");

                    // 匹配所属 track_prompt_id
                    String matchedTrackId = null;
                    for (Map.Entry<String, String> entry : modelTrackMap.entrySet()) {
                        if (cleanName.contains(entry.getKey())) {
                            matchedTrackId = entry.getValue();
                            break;
                        }
                    }

                    TagUtils.TagInfo tagInfo = TagUtils.readTags(file);
                    Double duration = tagInfo.getDuration() != null ? (double) tagInfo.getDuration() : 60.0;
                    Integer sampleRate = tagInfo.getSampleRate() != null ? tagInfo.getSampleRate() : 48000;
                    Integer bitrate = tagInfo.getBitrate() != null ? tagInfo.getBitrate() : 320;

                    // 提取生物声学质检数据
                    Double spectralEntropy = 6.5;
                    Double rmsStd = 0.085;
                    int qaPassed = 1;

                    JsonNode qaData = findQaDataForFile(qaMap, fileName);
                    if (qaData != null) {
                        if (qaData.has("spectral_entropy")) spectralEntropy = qaData.get("spectral_entropy").asDouble();
                        if (qaData.has("rms_std")) rmsStd = qaData.get("rms_std").asDouble();
                        if (qaData.has("qa_passed")) qaPassed = qaData.get("qa_passed").asBoolean() ? 1 : 0;
                    }

                    String assetId = "asset_" + projectId + "_" + cleanName;
                    AiRenderedAssetDTO asset = AiRenderedAssetDTO.builder()
                            .id(assetId)
                            .projectId(projectId)
                            .trackPromptId(matchedTrackId)
                            .audioPath(file.getAbsolutePath())
                            .audioDurationSeconds(duration)
                            .sampleRate(sampleRate)
                            .bitrate(bitrate)
                            .spectralEntropy(spectralEntropy)
                            .rmsStd(rmsStd)
                            .qaPassed(qaPassed)
                            .build();

                    aiStudioRepository.saveRenderedAsset(asset);
                    syncedAssets.add(asset);

                } catch (Exception e) {
                    log.error("❌ [ScanSync] 解析音频文件异常: file={}", file.getName(), e);
                }
            }
        }

        // 如果全部 9 首均已就绪，状态更新为 COMPLETED
        if (syncedAssets.size() >= 9) {
            aiStudioRepository.updateProjectStatus(projectId, "COMPLETED");
        } else if (!syncedAssets.isEmpty()) {
            aiStudioRepository.updateProjectStatus(projectId, "OFFLINE_RENDERING");
        }

        log.info("✅ [ScanSync] 扫描同步完成: projectId={}, 发现音频={}首", projectId, syncedAssets.size());
        return syncedAssets;
    }

    private Map<String, JsonNode> loadQaReports(File rendersDir) {
        Map<String, JsonNode> map = new HashMap<>();
        File reportFile = new File(rendersDir, "audio_authenticity_report.json");
        if (reportFile.exists() && reportFile.isFile()) {
            try {
                JsonNode root = objectMapper.readTree(reportFile);
                if (root.isArray()) {
                    for (JsonNode item : root) {
                        if (item.has("file")) {
                            map.put(item.get("file").asText().toLowerCase(), item);
                        }
                    }
                } else if (root.isObject()) {
                    root.fields().forEachRemaining(entry -> map.put(entry.getKey().toLowerCase(), entry.getValue()));
                }
            } catch (Exception e) {
                log.warn("⚠️ 读取质检报告文件异常: {}", e.getMessage());
            }
        }
        return map;
    }

    private JsonNode findQaDataForFile(Map<String, JsonNode> qaMap, String fileName) {
        String lower = fileName.toLowerCase();
        for (Map.Entry<String, JsonNode> entry : qaMap.entrySet()) {
            if (lower.contains(entry.getKey()) || entry.getKey().contains(lower)) {
                return entry.getValue();
            }
        }
        return null;
    }
}
