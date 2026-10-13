package com.wyyyyydl.models.dtos;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 文件夹状态检查与诊断 DTO
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class FolderCheckDTO {
    private String path;
    private String hostPath;
    private String folderName;
    private int totalFiles;
    private int totalDirs;
    private List<String> sampleFiles;
    private boolean isRoot;
}
