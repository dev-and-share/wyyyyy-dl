package com.wyyyyydl.dao.impl;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.stereotype.Repository;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;

/**
 * PostgreSQL / AWS RDS / Supabase 云原生关系型数据库配置仓储实现
 * 当显式配置 spring.datasource.url (且非 DynamoDB 模式) 时激活。
 */
@Repository("postgresConfigRepository")
@org.springframework.context.annotation.Primary
@ConditionalOnExpression("T(org.apache.commons.lang3.StringUtils).isNotBlank('${spring.datasource.url:}') && !'dynamodb'.equalsIgnoreCase('${storage.type:}')")
@Slf4j
public class PostgresConfigRepository extends AbstractJdbcConfigRepository {

    @Autowired
    private DataSource dataSource;

    @Override
    public void init() {
        log.info("🐘 [PostgreSQL Config] 检测到外部关系型数据源，启用 PostgreSQL 系统配置仓储");
        super.init();
    }

    @Override
    protected Connection getConnection() throws SQLException {
        if (dataSource == null) {
            throw new SQLException("PostgreSQL DataSource 未初始化");
        }
        return dataSource.getConnection();
    }
}
