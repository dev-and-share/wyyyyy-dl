package com.wyyyyydl.service.storage;

import com.wyyyyydl.dao.DownloadHistoryDAO;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.*;

import java.time.Instant;
import java.util.*;

/**
 * AWS DynamoDB 无服务器持久化服务
 * 适用于 Serverless-DynamoDB 架构，实现零 VPC、零 NAT 网关、零月租底噪
 */
@Service
@Slf4j
public class DynamoDbStorageService {

    @Value("${aws.dynamodb.table:${DYNAMODB_TABLE_NAME:}}")
    private String historyTableName;

    @Value("${aws.dynamodb.likes-table:${DYNAMODB_LIKES_TABLE:}}")
    private String likesTableName;

    @Value("${aws.dynamodb.raw-table:${DYNAMODB_RAW_TABLE:}}")
    private String rawTableName;

    @Value("${aws.region:${AWS_REGION:us-east-1}}")
    private String awsRegion;

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
                log.info("⚡ [DynamoDB] 已启用无服务器数据存储: table={}, region={}", historyTableName, awsRegion);
            } catch (Exception e) {
                log.warn("⚠️ [DynamoDB] 初始化客户端失败: {}", e.getMessage());
                this.dynamoDbEnabled = false;
            }
        }
    }

    public boolean isDynamoDbEnabled() {
        return dynamoDbEnabled;
    }

    public void saveHistoryItem(Long id, Long songId, String songName, String artist, String album,
                                String filePath, Long fileSize, String quality, String status) {
        if (!dynamoDbEnabled) return;
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

            PutItemRequest request = PutItemRequest.builder()
                    .tableName(historyTableName)
                    .item(item)
                    .build();
            dynamoDbClient.putItem(request);
            log.info("⚡ [DynamoDB] 保存历史记录成功, id={}, song={}", id, songName);
        } catch (Exception e) {
            log.error("保存历史记录至 DynamoDB 异常, id={}", id, e);
        }
    }

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

    public String getRawJson(Long historyId) {
        if (!dynamoDbEnabled || StringUtils.isBlank(rawTableName) || historyId == null) return null;
        try {
            Map<String, AttributeValue> key = Map.of("history_id", AttributeValue.builder().n(String.valueOf(historyId)).build());
            GetItemResponse resp = dynamoDbClient.getItem(GetItemRequest.builder()
                    .tableName(rawTableName)
                    .key(key)
                    .build());
            if (resp.hasItem() && resp.item().containsKey("raw_json")) {
                return resp.item().get("raw_json").s();
            }
        } catch (Exception e) {
            log.error("从 DynamoDB 获取 Raw JSON 异常, historyId={}", historyId, e);
        }
        return null;
    }

    public List<DownloadHistoryDAO.DownloadHistoryItem> scanHistoryItems(int limit) {
        List<DownloadHistoryDAO.DownloadHistoryItem> list = new ArrayList<>();
        if (!dynamoDbEnabled) return list;
        try {
            ScanRequest req = ScanRequest.builder()
                    .tableName(historyTableName)
                    .limit(limit > 0 ? limit : 50)
                    .build();
            ScanResponse resp = dynamoDbClient.scan(req);
            for (Map<String, AttributeValue> item : resp.items()) {
                DownloadHistoryDAO.DownloadHistoryItem dto = new DownloadHistoryDAO.DownloadHistoryItem();
                if (item.containsKey("id")) dto.setId(Long.parseLong(item.get("id").n()));
                if (item.containsKey("song_id")) dto.setSongId(Long.parseLong(item.get("song_id").n()));
                if (item.containsKey("song_name")) dto.setSongName(item.get("song_name").s());
                if (item.containsKey("artist")) dto.setArtist(item.get("artist").s());
                if (item.containsKey("album")) dto.setAlbum(item.get("album").s());
                if (item.containsKey("file_path")) dto.setFilePath(item.get("file_path").s());
                if (item.containsKey("file_size")) dto.setFileSize(Long.parseLong(item.get("file_size").n()));
                if (item.containsKey("quality")) dto.setQuality(item.get("quality").s());
                if (item.containsKey("status")) dto.setStatus(item.get("status").s());
                if (item.containsKey("created_at")) dto.setCreatedAt(item.get("created_at").s());
                list.add(dto);
            }
            list.sort((a, b) -> Long.compare(b.getId() != null ? b.getId() : 0, a.getId() != null ? a.getId() : 0));
        } catch (Exception e) {
            log.error("扫描 DynamoDB 历史数据异常", e);
        }
        return list;
    }

    public boolean deleteHistoryItem(Long id) {
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
}
