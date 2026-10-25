package com.wyyyyydl.models.dtos;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 历史下载记录实体与传输对象 (DTO)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DownloadHistoryItem {
    private Long id;
    private Long songId;
    private String songName;
    private String artist;
    private String album;
    private String filePath;
    private String relativePath;
    private String hostFilePath;
    private Long fileSize;
    private String quality;
    private String status;
    private String createdAt;
    private Boolean fileExists;
}
