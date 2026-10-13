package com.wyyyyydl.dao.impl;

import com.wyyyyydl.models.dtos.DownloadHistoryItem;
import com.wyyyyydl.dao.IHistoryStorageRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.*;

import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@DisplayName("⚡ IHistoryStorageRepository DynamoDB 接口实现类单元测试")
public class DynamoDbHistoryRepositoryTest {

    private IHistoryStorageRepository repo;
    private DynamoDbHistoryRepository impl;
    private DynamoDbClient mockClient;

    @BeforeEach
    public void setup() {
        impl = new DynamoDbHistoryRepository();
        repo = impl;
        mockClient = Mockito.mock(DynamoDbClient.class);

        ReflectionTestUtils.setField(impl, "historyTableName", "test-history");
        ReflectionTestUtils.setField(impl, "likesTableName", "test-likes");
        ReflectionTestUtils.setField(impl, "rawTableName", "test-raw");
        ReflectionTestUtils.setField(impl, "configTableName", "test-config");
        ReflectionTestUtils.setField(impl, "awsRegion", "us-east-1");
        ReflectionTestUtils.setField(impl, "dynamoDbClient", mockClient);
        ReflectionTestUtils.setField(impl, "dynamoDbEnabled", true);
    }

    @Test
    @DisplayName("测试契约方法: 配置项读写 (saveConfig / getConfig)")
    public void testConfigSaveAndGet() {
        repo.saveConfig("NETEASE_COOKIE", "cookie_test_value");
        verify(mockClient, times(1)).putItem(any(PutItemRequest.class));

        GetItemResponse mockResp = GetItemResponse.builder()
                .item(Map.of("config_value", AttributeValue.builder().s("cookie_test_value").build()))
                .build();
        when(mockClient.getItem(any(GetItemRequest.class))).thenReturn(mockResp);

        String config = repo.getConfig("NETEASE_COOKIE");
        assertEquals("cookie_test_value", config);
    }

    @Test
    @DisplayName("测试契约方法: 红心喜好管理 (isLiked / addLikedSong / removeLikedSong)")
    public void testLikesOperations() {
        when(mockClient.getItem(any(GetItemRequest.class))).thenReturn(GetItemResponse.builder().build());
        assertFalse(repo.isLiked(12345L));

        boolean added = repo.addLikedSong(12345L, "告白气球", "周杰伦");
        assertTrue(added);
        verify(mockClient, times(1)).putItem(any(PutItemRequest.class));

        boolean removed = repo.removeLikedSong(12345L);
        assertTrue(removed);
        verify(mockClient, times(1)).deleteItem(any(DeleteItemRequest.class));
    }

    @Test
    @DisplayName("测试契约方法: GSI 检索 (findLocalFileBySongId)")
    public void testFindBySongId() {
        Map<String, AttributeValue> itemMap = Map.of(
                "id", AttributeValue.builder().n("999").build(),
                "song_id", AttributeValue.builder().n("8888").build(),
                "song_name", AttributeValue.builder().s("晴天").build(),
                "artist", AttributeValue.builder().s("周杰伦").build(),
                "status", AttributeValue.builder().s("SUCCESS").build()
        );

        QueryResponse queryResp = QueryResponse.builder()
                .items(List.of(itemMap))
                .build();
        when(mockClient.query(any(QueryRequest.class))).thenReturn(queryResp);

        DownloadHistoryItem item = repo.findLocalFileBySongId(8888L);
        assertNotNull(item);
        assertEquals(8888L, item.getSongId());
        assertEquals("晴天", item.getSongName());
        assertTrue(item.getFileExists());
    }

    @Test
    @DisplayName("测试契约方法: 统计计算 (getStats)")
    public void testGetStats() {
        Map<String, AttributeValue> itemMap1 = Map.of(
                "id", AttributeValue.builder().n("1").build(),
                "status", AttributeValue.builder().s("SUCCESS").build(),
                "file_size", AttributeValue.builder().n("1000").build(),
                "quality", AttributeValue.builder().s("lossless").build()
        );
        Map<String, AttributeValue> itemMap2 = Map.of(
                "id", AttributeValue.builder().n("2").build(),
                "status", AttributeValue.builder().s("SUCCESS").build(),
                "file_size", AttributeValue.builder().n("2000").build(),
                "quality", AttributeValue.builder().s("standard").build()
        );

        ScanResponse scanResp = ScanResponse.builder()
                .items(List.of(itemMap1, itemMap2))
                .build();
        when(mockClient.scan(any(ScanRequest.class))).thenReturn(scanResp);

        Map<String, Object> stats = repo.getStats();
        assertEquals(2, stats.get("totalCount"));
        assertEquals(2, stats.get("successTotal"));
        assertEquals(3000L, stats.get("totalSize"));
    }
}
