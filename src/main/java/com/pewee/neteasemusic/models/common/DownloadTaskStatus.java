package com.pewee.neteasemusic.models.common;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DownloadTaskStatus {
    private Long id;
    private String name;
    private String status;      // PENDING, DOWNLOADING, SUCCESS, SKIP, FAILED
    private String errorMsg;
    private Long timestamp;
    private String filePath;

    public DownloadTaskStatus(Long id, String name, String status, String errorMsg, Long timestamp) {
        this.id = id;
        this.name = name;
        this.status = status;
        this.errorMsg = errorMsg;
        this.timestamp = timestamp;
    }
}
