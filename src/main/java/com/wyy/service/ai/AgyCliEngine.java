package com.wyy.service.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * ⚡ 本地 agy 命令行 Agent 引擎实现
 * 调度 /Users/houtokki/.local/bin/agy 执行高阶乐理推理与多轮追问
 */
@Component("agyCliEngine")
@Slf4j
public class AgyCliEngine implements IAiEngine {

    @Value("${ai.agy.path:/Users/houtokki/.local/bin/agy}")
    private String configuredAgyPath;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public String getEngineType() {
        return "LOCAL_AGY";
    }

    @Override
    public AiEngineResponse execute(String prompt, String conversationId, String effort) {
        long startTime = System.currentTimeMillis();
        String executable = resolveExecutablePath();
        if (executable == null) {
            return AiEngineResponse.builder()
                    .engineType(getEngineType())
                    .success(false)
                    .errorMsg("未在本地找到可执行的 agy 命令 (已探测: " + configuredAgyPath + ")")
                    .build();
        }

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

        log.info("🚀 [agy CLI] 启动执行: convId={}, effort={}, promptLen={}",
                conversationId, eff, prompt.length());

        Process process = null;
        try {
            ProcessBuilder pb = new ProcessBuilder(command);
            pb.redirectErrorStream(true);

            // 保持环境变量
            String pathEnv = System.getenv("PATH");
            if (pathEnv != null) {
                pb.environment().put("PATH", pathEnv + ":/usr/local/bin:/usr/bin:/bin:/Users/houtokki/.local/bin");
            }

            process = pb.start();

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
                        .build();
            }

            int exitCode = process.exitValue();
            String rawOutput = outputBuilder.toString().trim();
            long duration = System.currentTimeMillis() - startTime;

            if (exitCode != 0) {
                log.error("❌ [agy CLI] 退出码异常: code={}, output={}", exitCode, rawOutput);
                return AiEngineResponse.builder()
                        .engineType(getEngineType())
                        .success(false)
                        .errorMsg("agy 执行异常 (退出码 " + exitCode + "): " + rawOutput)
                        .durationMs(duration)
                        .build();
            }

            // 解析 JSON 输出
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
                log.warn("⚠️ [agy CLI] 未能按 JSON 结构解析输出，将使用纯文本兜底: {}", e.getMessage());
            }

            log.info("✅ [agy CLI] 执行完成: convId={}, 耗时={}ms", convId, duration);
            return AiEngineResponse.builder()
                    .engineType(getEngineType())
                    .conversationId(convId)
                    .responseText(resText)
                    .success(true)
                    .durationMs(duration)
                    .build();

        } catch (Exception e) {
            log.error("❌ [agy CLI] 进程执行失败", e);
            return AiEngineResponse.builder()
                    .engineType(getEngineType())
                    .success(false)
                    .errorMsg("调度 agy 进程失败: " + e.getMessage())
                    .durationMs(System.currentTimeMillis() - startTime)
                    .build();
        } finally {
            if (process != null && process.isAlive()) {
                process.destroyForcibly();
            }
        }
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
        return "agy";
    }
}
