package com.wyy.models.dtos;

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
    private String source; // 🌟 来源标识: "netease" (默认网易云) | "musicfree" (第三方音源)

    public boolean isMusicFree() {
        return "musicfree".equalsIgnoreCase(source);
    }
}
