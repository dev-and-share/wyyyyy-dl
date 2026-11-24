package com.wyy.models.dtos;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 🔬 原曲逆向特征工程分析结果 DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiSongAnalysisDTO {
    private String refSongId;
    private String title;
    private String artist;
    private String album;
    private Integer duration;
    private String format;
    private Integer bitrate;
    private Integer sampleRate;
    private String genre;
    private String lyric;
    private String mood;
    private String instrumentation;
    private Integer estimatedBpm;
    private String estimatedKey;
    private String analysisSummary;
}
