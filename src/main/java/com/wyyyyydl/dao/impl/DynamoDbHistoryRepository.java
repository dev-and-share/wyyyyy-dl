package com.wyyyyydl.dao.impl;

import com.wyyyyydl.models.dtos.DownloadHistoryItem;
import com.wyyyyydl.models.dtos.FolderCheckDTO;
import com.wyyyyydl.models.dtos.FolderItemDTO;
import com.wyyyyydl.dao.IHistoryStorageRepository;
import com.wyyyyydl.models.dtos.TrackDTO;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.*;

import java.io.File;
import java.time.Instant;
import java.util.*;

/**
 * AWS DynamoDB 无服务器持久化仓储实现类
 * 严格契约实现 IHistoryStorageRepository 接口，由 Java 编译器强校验所有接口方法。
 */
@Repository("dynamoDbHistoryRepository")
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(name = "storage.type", havingValue = "dynamodb")
@Slf4j
public class DynamoDbHistoryRepository implements IHistoryStorageRepository {

    @Value("${aws.dynamodb.table:${DYNAMODB_TABLE_NAME:}}")
    private String historyTableName;

    @Value("${aws.dynamodb.likes-table:${DYNAMODB_LIKES_TABLE:}}")
    private String likesTableName;

    @Value("${aws.dynamodb.raw-table:${DYNAMODB_RAW_TABLE:}}")
    private String rawTableName;

    @Value("${aws.dynamodb.config-table:${DYNAMODB_CONFIG_TABLE:}}")
    private String configTableName;

    @Value("${aws.region:${AWS_REGION:us-east-1}}")
    private String awsRegion;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.wyyyyydl.service.storage.IStorageService storageService;

    private DynamoDbClient dynamoDbClient;
    private boolean dynamoDbEnabled = false;

    @PostConstruct
    public void init() {
        if (StringUtils.isNotBlank(historyTableName)) {
            try {
                this.dynamoDbClient = DynamoDbClient.builder()
                        .region(Region.of(awsRegion))
                        .build();
                this.dynamoDbEnabled = true;
                log.info("⚡ [DynamoDB Repository] 已启用无服务器数据仓储: table={}, region={}", historyTableName, awsRegion);
            } catch (Exception e) {
                log.warn("⚠️ [DynamoDB Repository] 初始化客户端失败: {}", e.getMessage());
                this.dynamoDbEnabled = false;
            }
        }
    }

    public boolean isDynamoDbEnabled() {
        return dynamoDbEnabled;
    }

    // ==========================================
    // 1. 系统配置存储 (Cookie 持久化等)
    // ==========================================

    @Override
    public void saveConfig(String key, String value) {
        if (!dynamoDbEnabled || StringUtils.isBlank(configTableName) || StringUtils.isBlank(key)) return;
        try {
            Map<String, AttributeValue> item = new HashMap<>();
            item.put("config_key", AttributeValue.builder().s(key).build());
            item.put("config_value", AttributeValue.builder().s(value != null ? value : "").build());
            item.put("updated_at", AttributeValue.builder().s(Instant.now().toString()).build());

            dynamoDbClient.putItem(PutItemRequest.builder()
                    .tableName(configTableName)
                    .item(item)
                    .build());
            log.info("⚡ [DynamoDB] 系统配置已保存: key={}", key);
        } catch (Exception e) {
            log.error("保存配置至 DynamoDB 异常: key={}", key, e);
        }
    }

    @Override
    public String getConfig(String key) {
        if (!dynamoDbEnabled || StringUtils.isBlank(configTableName) || StringUtils.isBlank(key)) return null;
        try {
            GetItemResponse resp = dynamoDbClient.getItem(GetItemRequest.builder()
                    .tableName(configTableName)
                    .key(Map.of("config_key", AttributeValue.builder().s(key).build()))
                    .build());
            if (resp.hasItem() && resp.item().containsKey("config_value")) {
                return resp.item().get("config_value").s();
            }
        } catch (Exception e) {
            log.error("从 DynamoDB 获取配置异常: key={}", key, e);
        }
        return null;
    }

    // ==========================================
    // 2. 红心单曲 (Likes) 全生命周期
    // ==========================================

    @Override
    public boolean isLiked(Long songId) {
        if (!dynamoDbEnabled || StringUtils.isBlank(likesTableName) || songId == null) return false;
        try {
            GetItemResponse resp = dynamoDbClient.getItem(GetItemRequest.builder()
                    .tableName(likesTableName)
                    .key(Map.of("song_id", AttributeValue.builder().n(String.valueOf(songId)).build()))
                    .build());
            return resp.hasItem();
        } catch (Exception e) {
            log.error("从 DynamoDB 查询红心状态异常: songId={}", songId, e);
            return false;
        }
    }

    @Override
    public boolean addLikedSong(Long songId, String songName, String artist) {
        if (!dynamoDbEnabled || StringUtils.isBlank(likesTableName) || songId == null) return false;
        try {
            Map<String, AttributeValue> item = new HashMap<>();
            item.put("song_id", AttributeValue.builder().n(String.valueOf(songId)).build());
            item.put("song_name", AttributeValue.builder().s(songName != null ? songName : "").build());
            item.put("artist", AttributeValue.builder().s(artist != null ? artist : "").build());
            item.put("created_at", AttributeValue.builder().s(Instant.now().toString()).build());

            dynamoDbClient.putItem(PutItemRequest.builder()
                    .tableName(likesTableName)
                    .item(item)
                    .build());
            log.info("⚡ [DynamoDB] 添加红心单曲: songId={}, name={}", songId, songName);
            return true;
        } catch (Exception e) {
            log.error("保存红心至 DynamoDB 异常: songId={}", songId, e);
            return false;
        }
    }

    @Override
    public boolean removeLikedSong(Long songId) {
        if (!dynamoDbEnabled || StringUtils.isBlank(likesTableName) || songId == null) return false;
        try {
            dynamoDbClient.deleteItem(DeleteItemRequest.builder()
                    .tableName(likesTableName)
                    .key(Map.of("song_id", AttributeValue.builder().n(String.valueOf(songId)).build()))
                    .build());
            log.info("⚡ [DynamoDB] 移除红心单曲: songId={}", songId);
            return true;
        } catch (Exception e) {
            log.error("从 DynamoDB 移除红心异常: songId={}", songId, e);
            return false;
        }
    }

    @Override
    public Set<Long> getLikedSongIds() {
        Set<Long> ids = new HashSet<>();
        if (!dynamoDbEnabled || StringUtils.isBlank(likesTableName)) return ids;
        try {
            Map<String, AttributeValue> lastKey = null;
            do {
                ScanRequest.Builder reqBuilder = ScanRequest.builder()
                        .tableName(likesTableName)
                        .projectionExpression("song_id");
                if (lastKey != null && !lastKey.isEmpty()) {
                    reqBuilder.exclusiveStartKey(lastKey);
                }
                ScanResponse resp = dynamoDbClient.scan(reqBuilder.build());
                for (Map<String, AttributeValue> item : resp.items()) {
                    if (item.containsKey("song_id")) {
                        ids.add(Long.parseLong(item.get("song_id").n()));
                    }
                }
                lastKey = resp.lastEvaluatedKey();
            } while (lastKey != null && !lastKey.isEmpty());
        } catch (Exception e) {
            log.error("扫描 DynamoDB 红心歌曲异常", e);
        }
        return ids;
    }

    @Override
    public void syncLikedSongIds(List<Long> onlineIds) {
        if (!dynamoDbEnabled || StringUtils.isBlank(likesTableName) || onlineIds == null || onlineIds.isEmpty()) return;
        try {
            for (Long songId : onlineIds) {
                if (songId == null || songId <= 0) continue;
                Map<String, AttributeValue> item = new HashMap<>();
                item.put("song_id", AttributeValue.builder().n(String.valueOf(songId)).build());
                item.put("created_at", AttributeValue.builder().s(Instant.now().toString()).build());
                dynamoDbClient.putItem(PutItemRequest.builder()
                        .tableName(likesTableName)
                        .item(item)
                        .build());
            }
            log.info("⚡ [DynamoDB] 成功同步 {} 首线上红心歌曲", onlineIds.size());
        } catch (Exception e) {
            log.error("同步线上红心至 DynamoDB 异常", e);
        }
    }

    // ==========================================
    // 3. 下载历史记录 CRUD
    // ==========================================

    @Override
    public long addRecord(Long songId, String songName, String artist, String album,
                          String filePath, Long fileSize, String quality, String status) {
        long id = System.currentTimeMillis();
        if (!dynamoDbEnabled) return id;
        try {
            Map<String, AttributeValue> item = new HashMap<>();
            item.put("id", AttributeValue.builder().n(String.valueOf(id)).build());
            if (songId != null) item.put("song_id", AttributeValue.builder().n(String.valueOf(songId)).build());
            item.put("song_name", AttributeValue.builder().s(songName != null ? songName : "").build());
            item.put("artist", AttributeValue.builder().s(artist != null ? artist : "").build());
            item.put("album", AttributeValue.builder().s(album != null ? album : "").build());
            item.put("file_path", AttributeValue.builder().s(filePath != null ? filePath : "").build());
            item.put("file_size", AttributeValue.builder().n(String.valueOf(fileSize != null ? fileSize : 0L)).build());
            item.put("quality", AttributeValue.builder().s(quality != null ? quality : "lossless").build());
            item.put("status", AttributeValue.builder().s(status != null ? status : "SUCCESS").build());
            item.put("created_at", AttributeValue.builder().s(Instant.now().toString()).build());

            dynamoDbClient.putItem(PutItemRequest.builder()
                    .tableName(historyTableName)
                    .item(item)
                    .build());
            log.info("⚡ [DynamoDB] 保存历史记录成功, id={}, song={}", id, songName);
        } catch (Exception e) {
            log.error("保存历史记录至 DynamoDB 异常, id={}", id, e);
        }
        return id;
    }

    @Override
    public DownloadHistoryItem getRecordById(Long historyId) {
        if (!dynamoDbEnabled || historyId == null) return null;
        try {
            GetItemResponse resp = dynamoDbClient.getItem(GetItemRequest.builder()
                    .tableName(historyTableName)
                    .key(Map.of("id", AttributeValue.builder().n(String.valueOf(historyId)).build()))
                    .build());
            if (resp.hasItem()) {
                return mapItemFromAttributes(resp.item());
            }
        } catch (Exception e) {
            log.error("从 DynamoDB 获取记录异常, id={}", historyId, e);
        }
        return null;
    }

    @Override
    public List<DownloadHistoryItem> getRecordsByIds(List<Long> ids) {
        List<DownloadHistoryItem> result = new ArrayList<>();
        if (!dynamoDbEnabled || ids == null || ids.isEmpty()) return result;
        for (Long id : ids) {
            DownloadHistoryItem item = getRecordById(id);
            if (item != null) result.add(item);
        }
        return result;
    }

    @Override
    public List<DownloadHistoryItem> getRecords(String keyword, int page, int pageSize) {
        List<DownloadHistoryItem> all = scanFilteredItems(keyword, null, null);
        int fromIndex = Math.max(0, (page - 1) * pageSize);
        if (fromIndex >= all.size()) {
            return Collections.emptyList();
        }
        int toIndex = Math.min(fromIndex + pageSize, all.size());
        return all.subList(fromIndex, toIndex);
    }

    @Override
    public int countRecords(String keyword) {
        return scanFilteredItems(keyword, null, null).size();
    }

    @Override
    public boolean deleteRecord(Long id) {
        if (!dynamoDbEnabled || id == null) return false;
        try {
            dynamoDbClient.deleteItem(DeleteItemRequest.builder()
                    .tableName(historyTableName)
                    .key(Map.of("id", AttributeValue.builder().n(String.valueOf(id)).build()))
                    .build());
            return true;
        } catch (Exception e) {
            log.error("从 DynamoDB 删除记录异常, id={}", id, e);
            return false;
        }
    }

    @Override
    public boolean deleteSongFileAndRecord(Long songId, String name, String artist) {
        DownloadHistoryItem item = findLocalFileBySongOrName(songId, name, artist);
        if (item != null && item.getId() != null) {
            if (storageService != null && StringUtils.isNotBlank(item.getFilePath())) {
                storageService.deleteFile(item.getFilePath());
            }
            return deleteRecord(item.getId());
        }
        return false;
    }

    @Override
    public void saveRawJson(Long historyId, String rawJson) {
        if (!dynamoDbEnabled || StringUtils.isBlank(rawTableName) || historyId == null) return;
        try {
            Map<String, AttributeValue> item = new HashMap<>();
            item.put("history_id", AttributeValue.builder().n(String.valueOf(historyId)).build());
            item.put("raw_json", AttributeValue.builder().s(rawJson != null ? rawJson : "{}").build());
            item.put("updated_at", AttributeValue.builder().s(Instant.now().toString()).build());

            dynamoDbClient.putItem(PutItemRequest.builder()
                    .tableName(rawTableName)
                    .item(item)
                    .build());
        } catch (Exception e) {
            log.error("保存 Raw JSON 至 DynamoDB 异常, historyId={}", historyId, e);
        }
    }

    @Override
    public String getRawJson(Long historyId) {
        if (!dynamoDbEnabled || StringUtils.isBlank(rawTableName) || historyId == null) return null;
        try {
            GetItemResponse resp = dynamoDbClient.getItem(GetItemRequest.builder()
                    .tableName(rawTableName)
                    .key(Map.of("history_id", AttributeValue.builder().n(String.valueOf(historyId)).build()))
                    .build());
            if (resp.hasItem() && resp.item().containsKey("raw_json")) {
                return resp.item().get("raw_json").s();
            }
        } catch (Exception e) {
            log.error("从 DynamoDB 获取 Raw JSON 异常, historyId={}", historyId, e);
        }
        return null;
    }

    // ==========================================
    // 4. 音轨匹配、查重与定位
    // ==========================================

    @Override
    public DownloadHistoryItem findLocalFileBySongId(Long songId) {
        if (!dynamoDbEnabled || songId == null || songId <= 0) return null;
        try {
            QueryResponse resp = dynamoDbClient.query(QueryRequest.builder()
                    .tableName(historyTableName)
                    .indexName("song_id-index")
                    .keyConditionExpression("song_id = :sid")
                    .expressionAttributeValues(Map.of(":sid", AttributeValue.builder().n(String.valueOf(songId)).build()))
                    .scanIndexForward(false)
                    .limit(1)
                    .build());
            if (resp.hasItems() && !resp.items().isEmpty()) {
                return mapItemFromAttributes(resp.items().get(0));
            }
        } catch (Exception e) {
            log.warn("通过 DynamoDB song_id-index 查询失败: songId={}, msg={}", songId, e.getMessage());
        }
        return null;
    }

    @Override
    public DownloadHistoryItem findLocalFileBySongOrName(Long songId, String name, String artist) {
        if (songId != null && songId > 0) {
            DownloadHistoryItem item = findLocalFileBySongId(songId);
            if (item != null && Boolean.TRUE.equals(item.getFileExists())) {
                return item;
            }
        }
        if (StringUtils.isNotBlank(name)) {
            String targetClean = name.trim().toLowerCase();
            List<DownloadHistoryItem> candidates = scanFilteredItems(name, null, null);
            for (DownloadHistoryItem item : candidates) {
                if (item.getSongName() != null && item.getSongName().trim().equalsIgnoreCase(targetClean)) {
                    if (StringUtils.isBlank(artist) || (item.getArtist() != null && item.getArtist().contains(artist.trim()))) {
                        return item;
                    }
                }
            }
        }
        return null;
    }

    @Override
    public void markLocalStatusBatch(List<TrackDTO> tracks) {
        if (tracks == null || tracks.isEmpty()) return;
        for (TrackDTO track : tracks) {
            if (track != null && track.getId() != null) {
                DownloadHistoryItem item = findLocalFileBySongId(track.getId());
                if (item != null && Boolean.TRUE.equals(item.getFileExists())) {
                    track.setIsLocal(true);
                }
            }
        }
    }

    // ==========================================
    // 5. 统计与巡检维护
    // ==========================================

    @Override
    public Map<String, Object> getStats() {
        Map<String, Object> stats = new HashMap<>();
        List<DownloadHistoryItem> all = scanFilteredItems(null, null, null);
        long totalSize = 0;
        int successCount = 0;
        Map<String, Integer> qualityCount = new HashMap<>();

        for (DownloadHistoryItem item : all) {
            if ("SUCCESS".equalsIgnoreCase(item.getStatus())) {
                successCount++;
                if (item.getFileSize() != null) totalSize += item.getFileSize();
                String q = StringUtils.isNotBlank(item.getQuality()) ? item.getQuality() : "unknown";
                qualityCount.put(q, qualityCount.getOrDefault(q, 0) + 1);
            }
        }

        stats.put("total", all.size());
        stats.put("totalCount", all.size());
        stats.put("successTotal", successCount);
        stats.put("totalSize", totalSize);
        stats.put("missingCount", 0);
        stats.put("nonMp3Count", 0);
        stats.put("qualityCount", qualityCount);
        return stats;
    }

    @Override
    public List<DownloadHistoryItem> getMissingRecords() {
        return Collections.emptyList(); // 云端 S3 存储下无本地丢失概念
    }

    @Override
    public int cleanMissingRecords() {
        return 0;
    }

    @Override
    public List<DownloadHistoryItem> getNonMp3Records() {
        return Collections.emptyList();
    }

    @Override
    public int cleanNonMp3Records() {
        return 0;
    }

    // ==========================================
    // 6. 文件系统与目录树兼容抽象 (云原生无状态安全回退)
    // ==========================================

    @Override
    public List<FolderItemDTO> listFolderContents(String relativePath) {
        return Collections.emptyList();
    }

    @Override
    public List<DownloadHistoryItem> getFolderTracks(String folderPath, boolean recursive) {
        return Collections.emptyList();
    }

    @Override
    public FolderCheckDTO checkFolder(String path) {
        // 云端 Serverless 模式不开放宿主机本地目录遍历
        return null;
    }

    @Override
    public File resolveFile(String filePath) {
        return new File(filePath != null ? filePath : "");
    }

    @Override
    public Map<String, Object> scanExternalLibraries() {
        Map<String, Object> res = new HashMap<>();
        res.put("scannedFiles", 0);
        res.put("addedCount", 0);
        return res;
    }

    // ==========================================
    // 私有辅助方法
    // ==========================================

    private List<DownloadHistoryItem> scanFilteredItems(String keyword, String quality, String status) {
        List<DownloadHistoryItem> list = new ArrayList<>();
        if (!dynamoDbEnabled) return list;
        try {
            Map<String, AttributeValue> lastKey = null;
            List<Map<String, AttributeValue>> allItems = new ArrayList<>();
            do {
                ScanRequest.Builder reqBuilder = ScanRequest.builder().tableName(historyTableName);
                if (lastKey != null && !lastKey.isEmpty()) {
                    reqBuilder.exclusiveStartKey(lastKey);
                }
                ScanResponse resp = dynamoDbClient.scan(reqBuilder.build());
                if (resp.hasItems()) {
                    allItems.addAll(resp.items());
                }
                lastKey = resp.lastEvaluatedKey();
            } while (lastKey != null && !lastKey.isEmpty());
            for (Map<String, AttributeValue> item : allItems) {
                DownloadHistoryItem dto = mapItemFromAttributes(item);
                if (StringUtils.isNotBlank(keyword)) {
                    String kw = keyword.toLowerCase();
                    boolean match = (dto.getSongName() != null && dto.getSongName().toLowerCase().contains(kw))
                            || (dto.getArtist() != null && dto.getArtist().toLowerCase().contains(kw))
                            || (dto.getAlbum() != null && dto.getAlbum().toLowerCase().contains(kw));
                    if (!match) continue;
                }
                if (StringUtils.isNotBlank(quality) && !quality.equalsIgnoreCase(dto.getQuality())) {
                    continue;
                }
                if (StringUtils.isNotBlank(status) && !status.equalsIgnoreCase(dto.getStatus())) {
                    continue;
                }
                list.add(dto);
            }
            list.sort((a, b) -> Long.compare(b.getId() != null ? b.getId() : 0, a.getId() != null ? a.getId() : 0));
        } catch (Exception e) {
            log.error("扫描 DynamoDB 历史数据异常", e);
        }
        return list;
    }

    private DownloadHistoryItem mapItemFromAttributes(Map<String, AttributeValue> item) {
        DownloadHistoryItem dto = new DownloadHistoryItem();
        if (item.containsKey("id")) dto.setId(Long.parseLong(item.get("id").n()));
        if (item.containsKey("song_id")) dto.setSongId(Long.parseLong(item.get("song_id").n()));
        if (item.containsKey("song_name")) dto.setSongName(item.get("song_name").s());
        if (item.containsKey("artist")) dto.setArtist(item.get("artist").s());
        if (item.containsKey("album")) dto.setAlbum(item.get("album").s());
        if (item.containsKey("file_path")) {
            String fp = item.get("file_path").s();
            dto.setFilePath(fp);
            dto.setRelativePath(fp);
        }
        if (item.containsKey("file_size")) dto.setFileSize(Long.parseLong(item.get("file_size").n()));
        if (item.containsKey("quality")) dto.setQuality(item.get("quality").s());
        if (item.containsKey("status")) dto.setStatus(item.get("status").s());
        if (item.containsKey("created_at")) dto.setCreatedAt(item.get("created_at").s());
        dto.setFileExists("SUCCESS".equalsIgnoreCase(dto.getStatus()));
        return dto;
    }

    @Override
    public List<Map<String, String>> getFolderRoots() {
        return Collections.emptyList();
    }

    @Override
    public boolean ignoreFolder(String folderPath) {
        return false;
    }

    @Override
    public boolean deleteFolder(String folderPath) {
        return false;
    }

    @Override
    public Map<String, Object> scanFiles() {
        return Collections.emptyMap();
    }

    @Override
    public int importUntrackedFiles() {
        return 0;
    }

    @Override
    public String toHostPath(File file) {
        return file != null ? file.getPath() : "";
    }

    @Override
    public String toRelativePath(String fullPath) {
        return fullPath != null ? fullPath : "";
    }

    @Override
    public List<DownloadHistoryItem> getRecordsBySongIds(List<Long> songIds) {
        if (songIds == null || songIds.isEmpty()) return Collections.emptyList();
        List<DownloadHistoryItem> list = new ArrayList<>();
        for (Long sid : songIds) {
            DownloadHistoryItem item = findLocalFileBySongId(sid);
            if (item != null) list.add(item);
        }
        return list;
    }

    @Override
    public Set<Long> getAllDownloadedSongIds() {
        Set<Long> ids = new HashSet<>();
        List<DownloadHistoryItem> all = getRecords(null, 1, 10000);
        for (DownloadHistoryItem item : all) {
            if (item != null && item.getSongId() != null) {
                ids.add(item.getSongId());
            }
        }
        return ids;
    }

    @Override
    public boolean isSongDownloaded(Long songId) {
        return findLocalFileBySongId(songId) != null;
    }

    @Override
    public void migrateLegacyIdsFileIfPresent(String basePath) {
    }
}
