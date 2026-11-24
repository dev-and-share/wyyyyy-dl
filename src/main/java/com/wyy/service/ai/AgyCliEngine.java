package com.wyy.service.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * ⚡ 本地 agy 命令行 Agent 引擎实现
 * 支持两种调度模式：
 * 1. 原生进程模式：直接调度 /Users/houtokki/.local/bin/agy (适用于本地原生运行)
 * 2. 宿主机 Bridge 模式：通过 http://host.docker.internal:23333/agy 调度宿主机 agy (适用于 Docker 容器环境)
 */
@Component("agyCliEngine")
@Slf4j
public class AgyCliEngine implements IAiEngine {

    @Value("${ai.agy.path:/Users/houtokki/.local/bin/agy}")
    private String configuredAgyPath;

    @Value("${ai.agy.bridge-url:${AI_AGY_BRIDGE_URL:http://host.docker.internal:23333}}")
    private String configuredBridgeUrl;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    @Override
    public String getEngineType() {
        return "LOCAL_AGY";
    }

    @Override
    public AiEngineResponse execute(String prompt, String conversationId, String effort) {
        long startTime = System.currentTimeMillis();

        // 1. 若宿主/本地可以直接运行可执行文件 (Native 模式)
        String executable = resolveExecutablePath();
        if (executable != null) {
            try {
                return executeDirectCli(executable, prompt, conversationId, effort, startTime);
            } catch (Exception e) {
                log.warn("⚠️ 本地直接调度 agy 进程失败 (可能处于容器隔离环境)，将自动降级至宿主机 Bridge: {}", e.getMessage());
            }
        }

        // 2. 尝试宿主机 Bridge (Docker 模式，经 host.docker.internal:23333 或 localhost:23333)
        return executeViaBridge(prompt, conversationId, effort, startTime);
    }

    private AiEngineResponse executeDirectCli(String executable, String prompt, String conversationId, String effort, long startTime) throws Exception {
        List<String> command = new ArrayList<>();
        command.add(executable);
        command.add("--output-format");
        command.add("json");

        if (StringUtils.isNotBlank(conversationId)) {
            command.add("--conversation");
            command.add(conversationId.trim());
        }

        String eff = StringUtils.isNotBlank(effort) ? effort.trim() : "high";
        command.add("--effort");
        command.add(eff);

        command.add("--prompt");
        command.add(prompt);

        log.info("🚀 [agy CLI 原生] 启动执行: convId={}, effort={}, promptLen={}",
                conversationId, eff, prompt.length());

        ProcessBuilder pb = new ProcessBuilder(command);
        pb.redirectErrorStream(true);

        String pathEnv = System.getenv("PATH");
        if (pathEnv != null) {
            pb.environment().put("PATH", pathEnv + ":/usr/local/bin:/usr/bin:/bin:/Users/houtokki/.local/bin");
        }

        Process process = pb.start();

        StringBuilder outputBuilder = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                outputBuilder.append(line).append("\n");
            }
        }

        boolean finished = process.waitFor(180, TimeUnit.SECONDS);
        if (!finished) {
            process.destroyForcibly();
            return AiEngineResponse.builder()
                    .engineType(getEngineType())
                    .success(false)
                    .errorMsg("agy 命令执行超时 (超过 180 秒)")
                    .durationMs(System.currentTimeMillis() - startTime)
                    .build();
        }

        int exitCode = process.exitValue();
        String rawOutput = outputBuilder.toString().trim();
        long duration = System.currentTimeMillis() - startTime;

        if (exitCode != 0) {
            log.error("❌ [agy CLI 原生] 退出码异常: code={}, output={}", exitCode, rawOutput);
            return AiEngineResponse.builder()
                    .engineType(getEngineType())
                    .success(false)
                    .errorMsg("agy 执行异常 (退出码 " + exitCode + "): " + rawOutput)
                    .durationMs(duration)
                    .build();
        }

        String resText = rawOutput;
        String convId = conversationId;
        try {
            JsonNode jsonNode = objectMapper.readTree(rawOutput);
            if (jsonNode.has("response")) {
                resText = jsonNode.get("response").asText();
            }
            if (jsonNode.has("conversation_id")) {
                convId = jsonNode.get("conversation_id").asText();
            }
        } catch (Exception e) {
            log.warn("⚠️ [agy CLI 原生] 未能按 JSON 解析输出，兜底纯文本: {}", e.getMessage());
        }

        log.info("✅ [agy CLI 原生] 执行完成: convId={}, 耗时={}ms", convId, duration);
        return AiEngineResponse.builder()
                .engineType(getEngineType())
                .conversationId(convId)
                .responseText(resText)
                .success(true)
                .durationMs(duration)
                .build();
    }

    private AiEngineResponse executeViaBridge(String prompt, String conversationId, String effort, long startTime) {
        String[] candidateUrls = {
                configuredBridgeUrl.replaceAll("/+$", "") + "/agy",
                "http://localhost:23333/agy",
                "http://127.0.0.1:23333/agy"
        };

        String lastError = null;
        for (String targetUrl : candidateUrls) {
            try {
                ObjectNode reqNode = objectMapper.createObjectNode();
                reqNode.put("prompt", prompt);
                if (StringUtils.isNotBlank(conversationId)) {
                    reqNode.put("conversationId", conversationId.trim());
                }
                reqNode.put("effort", StringUtils.isNotBlank(effort) ? effort.trim() : "high");

                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(targetUrl))
                        .timeout(Duration.ofSeconds(185))
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(reqNode)))
                        .build();

                log.info("📡 [agy CLI Bridge] 正在请求宿主机网桥: url={}, convId={}", targetUrl, conversationId);
                HttpResponse<String> resp = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

                long duration = System.currentTimeMillis() - startTime;
                if (resp.statusCode() == 200) {
                    JsonNode respJson = objectMapper.readTree(resp.body());
                    boolean success = respJson.path("success").asBoolean(true);
                    String respText = respJson.path("response").asText("");
                    String convId = respJson.path("conversationId").asText(conversationId);

                    if (!success) {
                        String errMsg = respJson.path("errorMsg").asText("网桥返回失败");
                        return AiEngineResponse.builder()
                                .engineType(getEngineType())
                                .success(false)
                                .errorMsg(errMsg)
                                .durationMs(duration)
                                .build();
                    }

                    log.info("✅ [agy CLI Bridge] 宿主机网桥调用成功: convId={}, 耗时={}ms", convId, duration);
                    return AiEngineResponse.builder()
                            .engineType(getEngineType())
                            .conversationId(convId)
                            .responseText(respText)
                            .success(true)
                            .durationMs(duration)
                            .build();
                } else {
                    lastError = "Bridge HTTP " + resp.statusCode() + ": " + resp.body();
                    log.warn("⚠️ [agy CLI Bridge] 候选网桥响应非200: {} -> {}", targetUrl, lastError);
                }
            } catch (Exception e) {
                lastError = e.getMessage();
                log.warn("⚠️ [agy CLI Bridge] 候选网桥连接失败: {} -> {}", targetUrl, e.getMessage());
            }
        }

        return AiEngineResponse.builder()
                .engineType(getEngineType())
                .success(false)
                .errorMsg("本地与宿主机 agy 网桥均未连通 (请确保 python3 scripts/agy_host_bridge.py 正在宿主机运行)。原因: " + lastError)
                .durationMs(System.currentTimeMillis() - startTime)
                .build();
    }

    private String resolveExecutablePath() {
        if (StringUtils.isNotBlank(configuredAgyPath)) {
            File f = new File(configuredAgyPath);
            if (f.exists() && f.canExecute()) {
                return f.getAbsolutePath();
            }
        }
        String userHome = System.getProperty("user.home");
        if (userHome != null) {
            File homeBin = new File(userHome, ".local/bin/agy");
            if (homeBin.exists() && homeBin.canExecute()) {
                return homeBin.getAbsolutePath();
            }
        }
        return null;
    }
}
