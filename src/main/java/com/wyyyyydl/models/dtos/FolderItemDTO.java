package com.wyyyyydl.models.dtos;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 文件夹内项目（子目录或音频单曲）条目 DTO
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class FolderItemDTO {
    private String name;
    private String path;
    private String hostPath;
    private boolean isDirectory;
    private long size;
    private int trackCount;
    private String songName;
    private String artist;
    private String album;
    private Long songId;
    private Long historyId;
    private String streamUrl;
}
