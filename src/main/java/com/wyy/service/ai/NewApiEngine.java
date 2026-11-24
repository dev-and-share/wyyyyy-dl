package com.wyy.service.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.UUID;

/**
 * 🌐 网络 API 引擎 (兼容 OpenAI / New API 规范)
 */
@Component("newApiEngine")
@Slf4j
public class NewApiEngine implements IAiEngine {

    @Value("${ai.newapi.base-url:${AI_API_BASE_URL:https://api.openai.com/v1}}")
    private String baseUrl;

    @Value("${ai.newapi.api-key:${AI_API_KEY:}}")
    private String apiKey;

    @Value("${ai.newapi.model:${AI_MODEL_NAME:gpt-4o}}")
    private String modelName;

    @Value("${ai.newapi.timeout-seconds:120}")
    private int timeoutSeconds;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .build();

    @Override
    public String getEngineType() {
        return "NEW_API";
    }

    @Override
    public AiEngineResponse execute(String prompt, String conversationId, String effort) {
        long startTime = System.currentTimeMillis();
        if (StringUtils.isBlank(apiKey)) {
            return AiEngineResponse.builder()
                    .engineType(getEngineType())
                    .success(false)
                    .errorMsg("未配置 AI_API_KEY，请在 .env 中设置 AI_API_KEY 与 AI_API_BASE_URL")
                    .build();
        }

        String targetUrl = baseUrl.replaceAll("/+$", "") + "/chat/completions";
        String convId = StringUtils.isNotBlank(conversationId) ? conversationId : UUID.randomUUID().toString();

        try {
            ObjectNode root = objectMapper.createObjectNode();
            root.put("model", modelName);
            ArrayNode messages = root.putArray("messages");

            ObjectNode userMsg = messages.addObject();
            userMsg.put("role", "user");
            userMsg.put("content", prompt);

            String requestBody = objectMapper.writeValueAsString(root);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(targetUrl))
                    .timeout(Duration.ofSeconds(timeoutSeconds))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .build();

            log.info("🌐 [New API] 发起网络调用: url={}, model={}", targetUrl, modelName);
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            long duration = System.currentTimeMillis() - startTime;
            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                JsonNode resJson = objectMapper.readTree(response.body());
                String content = "";
                if (resJson.has("choices") && resJson.get("choices").isArray() && resJson.get("choices").size() > 0) {
                    JsonNode choice = resJson.get("choices").get(0);
                    if (choice.has("message") && choice.get("message").has("content")) {
                        content = choice.get("message").get("content").asText();
                    }
                }

                log.info("✅ [New API] 响应成功: 耗时={}ms", duration);
                return AiEngineResponse.builder()
                        .engineType(getEngineType())
                        .conversationId(convId)
                        .responseText(content)
                        .success(true)
                        .durationMs(duration)
                        .build();
            } else {
                log.error("❌ [New API] 响应失败: code={}, body={}", response.statusCode(), response.body());
                return AiEngineResponse.builder()
                        .engineType(getEngineType())
                        .success(false)
                        .errorMsg("New API 响应异常 HTTP " + response.statusCode() + ": " + response.body())
                        .durationMs(duration)
                        .build();
            }

        } catch (Exception e) {
            log.error("❌ [New API] 调用异常", e);
            return AiEngineResponse.builder()
                    .engineType(getEngineType())
                    .success(false)
                    .errorMsg("网络 API 请求失败: " + e.getMessage())
                    .durationMs(System.currentTimeMillis() - startTime)
                    .build();
        }
    }
}
