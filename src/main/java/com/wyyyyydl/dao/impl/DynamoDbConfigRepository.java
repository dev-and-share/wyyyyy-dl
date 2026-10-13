package com.wyyyyydl.dao.impl;

import com.wyyyyydl.dao.IConfigRepository;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Repository;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.GetItemRequest;
import software.amazon.awssdk.services.dynamodb.model.GetItemResponse;
import software.amazon.awssdk.services.dynamodb.model.PutItemRequest;

import java.util.HashMap;
import java.util.Map;

/**
 * AWS DynamoDB 云原生 NoSQL 配置仓储实现
 */
@Repository("dynamoDbConfigRepository")
@ConditionalOnProperty(name = "storage.type", havingValue = "dynamodb")
@Slf4j
public class DynamoDbConfigRepository implements IConfigRepository {

    @Value("${aws.dynamodb.config-table:${DYNAMODB_CONFIG_TABLE:wyyyyy-dl-ddb-config-prod}}")
    private String configTableName;

    @Value("${aws.region:${AWS_REGION:us-east-1}}")
    private String awsRegion;

    private DynamoDbClient dynamoDbClient;

    @PostConstruct
    public void init() {
        try {
            this.dynamoDbClient = DynamoDbClient.builder()
                    .region(Region.of(awsRegion))
                    .build();
            log.info("⚡ [DynamoDB Config] 云原生配置仓储就绪! ConfigTable: {}, Region: {}", configTableName, awsRegion);
        } catch (Exception e) {
            log.warn("⚠️ [DynamoDB Config] 初始化 DynamoDB 客户端失败: {}", e.getMessage());
        }
    }

    @Override
    public void saveConfig(String key, String value) {
        if (dynamoDbClient == null || StringUtils.isBlank(key)) return;
        try {
            Map<String, AttributeValue> item = new HashMap<>();
            item.put("config_key", AttributeValue.builder().s(key).build());
            item.put("config_value", AttributeValue.builder().s(value != null ? value : "").build());
            item.put("updated_at", AttributeValue.builder().s(java.time.Instant.now().toString()).build());

            PutItemRequest request = PutItemRequest.builder()
                    .tableName(configTableName)
                    .item(item)
                    .build();
            dynamoDbClient.putItem(request);
            log.info("⚡ [DynamoDB Config] 成功保存配置: key={}", key);
        } catch (Exception e) {
            log.error("❌ [DynamoDB Config] 保存配置异常: key={}", key, e);
        }
    }

    @Override
    public String getConfig(String key) {
        if (dynamoDbClient == null || StringUtils.isBlank(key)) return null;
        try {
            GetItemRequest request = GetItemRequest.builder()
                    .tableName(configTableName)
                    .key(Map.of("config_key", AttributeValue.builder().s(key).build()))
                    .build();
            GetItemResponse response = dynamoDbClient.getItem(request);
            if (response.hasItem() && response.item().containsKey("config_value")) {
                return response.item().get("config_value").s();
            }
        } catch (Exception e) {
            log.error("❌ [DynamoDB Config] 读取配置异常: key={}", key, e);
        }
        return null;
    }
}
