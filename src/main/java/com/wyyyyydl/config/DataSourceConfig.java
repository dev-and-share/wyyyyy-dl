package com.wyyyyydl.config;

import com.zaxxer.hikari.HikariDataSource;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

/**
 * 外部关系型数据库条件化数据源配置
 * 仅在显式配置 spring.datasource.url (例如连接 AWS RDS / Supabase) 时激活，
 * 本地环境与 DynamoDB 环境下自动跳过，避免无 URL 时触发 DataSourceAutoConfiguration 异常。
 */
@Configuration
@org.springframework.boot.autoconfigure.condition.ConditionalOnExpression("T(org.apache.commons.lang3.StringUtils).isNotBlank('${spring.datasource.url:}')")
public class DataSourceConfig {

    @Bean
    @Primary
    @ConfigurationProperties("spring.datasource")
    public DataSourceProperties dataSourceProperties() {
        return new DataSourceProperties();
    }

    @Bean
    @Primary
    @ConfigurationProperties("spring.datasource.hikari")
    public HikariDataSource dataSource(DataSourceProperties properties) {
        return properties.initializeDataSourceBuilder().type(HikariDataSource.class).build();
    }
}
