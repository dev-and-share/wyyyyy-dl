package com.wyyyyydl.dao;

import com.wyyyyydl.dao.impl.SqliteHistoryRepository;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Repository;

/**
 * 本地 SQLite 下载历史 DAO (向后兼容门面)
 * 继承自统一的 SqliteHistoryRepository，消除了所有历史打补丁分支，
 * 所有的 SQL 增删改查与物理曲库扫描均由 AbstractJdbcHistoryRepository 模板引擎统一驱动。
 */
@Repository("downloadHistoryDAO")
@Primary
@ConditionalOnExpression("T(org.apache.commons.lang3.StringUtils).isBlank('${spring.datasource.url:}') && !'dynamodb'.equalsIgnoreCase('${storage.type:}')")
@Slf4j
public class DownloadHistoryDAO extends SqliteHistoryRepository {

    /**
     * 向后兼容历史内部类引用
     */
    @EqualsAndHashCode(callSuper = true)
    @NoArgsConstructor
    public static class DownloadHistoryItem extends com.wyyyyydl.models.dtos.DownloadHistoryItem {
    }

    @EqualsAndHashCode(callSuper = true)
    @NoArgsConstructor
    public static class FolderCheckDTO extends com.wyyyyydl.models.dtos.FolderCheckDTO {
    }

    @EqualsAndHashCode(callSuper = true)
    @NoArgsConstructor
    public static class FolderItemDTO extends com.wyyyyydl.models.dtos.FolderItemDTO {
    }
}
