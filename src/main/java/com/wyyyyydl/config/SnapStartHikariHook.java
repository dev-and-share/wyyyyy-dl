package com.wyyyyydl.config;

import com.zaxxer.hikari.HikariDataSource;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.crac.Core;
import org.crac.Resource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;

/**
 * SnapStart CRaC 钩子：在快照生成前主动释放/驱逐 Hikari 数据库连接，
 * 避免快照恢复后因网络套接字已断开而产生 Connection Reset 异常。
 */
@Component
@Slf4j
public class SnapStartHikariHook implements Resource {

    @Autowired(required = false)
    private DataSource dataSource;

    @PostConstruct
    public void registerCrac() {
        try {
            Core.getGlobalContext().register(this);
            log.info("📦 [SnapStart] CRaC 数据库生命周期监听钩子注册成功。");
        } catch (Throwable t) {
            log.debug("当前环境不支持 CRaC (非 SnapStart 运行时)");
        }
    }

    @Override
    public void beforeCheckpoint(org.crac.Context<? extends Resource> context) {
        if (dataSource instanceof HikariDataSource hikariDataSource) {
            log.info("📸 [SnapStart CRaC] 快照检查点开始：正在驱逐 Hikari 连接池中的存活连接...");
            try {
                if (hikariDataSource.getHikariPoolMXBean() != null) {
                    hikariDataSource.getHikariPoolMXBean().softEvictConnections();
                }
            } catch (Exception e) {
                log.warn("驱逐 Hikari 连接池连接异常: {}", e.getMessage());
            }
        }
    }

    @Override
    public void afterRestore(org.crac.Context<? extends Resource> context) {
        log.info("⚡ [SnapStart CRaC] 快照恢复完成：数据库连接将在后续请求中按需重新建立。");
    }
}
