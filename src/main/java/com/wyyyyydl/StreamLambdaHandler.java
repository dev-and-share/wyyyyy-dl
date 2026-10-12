package com.wyyyyydl;

import com.amazonaws.serverless.exceptions.ContainerInitializationException;
import com.amazonaws.serverless.proxy.model.AwsProxyRequest;
import com.amazonaws.serverless.proxy.model.AwsProxyResponse;
import com.amazonaws.serverless.proxy.spring.SpringBootLambdaContainerHandler;
import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestStreamHandler;
import org.crac.Core;
import org.crac.Resource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * AWS Lambda 入口处理器 (适配 Spring Boot 3 与 AWS SnapStart)
 */
public class StreamLambdaHandler implements RequestStreamHandler, Resource {

    private static final Logger log = LoggerFactory.getLogger(StreamLambdaHandler.class);
    private static SpringBootLambdaContainerHandler<AwsProxyRequest, AwsProxyResponse> handler;

    static {
        try {
            log.info("🚀 [SnapStart] 开始初始化 Spring Boot 3 容器...");
            long start = System.currentTimeMillis();
            handler = SpringBootLambdaContainerHandler.getAwsProxyHandler(WyyyyyDlApplication.class);
            log.info("✅ [SnapStart] Spring Boot 3 容器预热完成，耗时: {} ms", (System.currentTimeMillis() - start));
        } catch (ContainerInitializationException e) {
            log.error("❌ [SnapStart] 初始化 Spring Boot 容器失败", e);
            throw new RuntimeException("Could not initialize Spring Boot application", e);
        }
    }

    public StreamLambdaHandler() {
        // 注册 CRaC 钩子监听快照检查点事件
        Core.getGlobalContext().register(this);
    }

    @Override
    public void handleRequest(InputStream inputStream, OutputStream outputStream, Context context)
            throws IOException {
        handler.proxyStream(inputStream, outputStream, context);
    }

    @Override
    public void beforeCheckpoint(org.crac.Context<? extends Resource> context) {
        log.info("📸 [SnapStart CRaC] 正在制作快照，执行清理工作...");
    }

    @Override
    public void afterRestore(org.crac.Context<? extends Resource> context) {
        log.info("⚡ [SnapStart CRaC] 从快照恢复完成，已就绪接收请求！");
    }
}
