package com.wyyyyydl.dao.impl;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.GetItemRequest;
import software.amazon.awssdk.services.dynamodb.model.GetItemResponse;
import software.amazon.awssdk.services.dynamodb.model.PutItemRequest;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@DisplayName("⚡ DynamoDbConfigRepository 云原生配置仓储单元测试")
public class DynamoDbConfigRepositoryTest {

    private DynamoDbConfigRepository repo;
    private DynamoDbClient mockClient;

    @BeforeEach
    public void setup() {
        repo = new DynamoDbConfigRepository();
        mockClient = Mockito.mock(DynamoDbClient.class);
        ReflectionTestUtils.setField(repo, "configTableName", "test-config-table");
        ReflectionTestUtils.setField(repo, "awsRegion", "us-east-1");
        ReflectionTestUtils.setField(repo, "dynamoDbClient", mockClient);
    }

    @Test
    @DisplayName("测试云原生配置存取 (saveConfig & getConfig)")
    public void testSaveAndGetConfig() {
        repo.saveConfig("NETEASE_COOKIE", "cookie_token_abc");
        verify(mockClient, times(1)).putItem(any(PutItemRequest.class));

        GetItemResponse mockResp = GetItemResponse.builder()
                .item(Map.of("config_value", AttributeValue.builder().s("cookie_token_abc").build()))
                .build();
        when(mockClient.getItem(any(GetItemRequest.class))).thenReturn(mockResp);

        String fetched = repo.getConfig("NETEASE_COOKIE");
        assertEquals("cookie_token_abc", fetched);
    }

    @Test
    @DisplayName("测试未命中 key 时返回 null")
    public void testGetNonExistentKey() {
        when(mockClient.getItem(any(GetItemRequest.class))).thenReturn(GetItemResponse.builder().build());
        assertNull(repo.getConfig("UNKNOWN_KEY"));
    }
}
