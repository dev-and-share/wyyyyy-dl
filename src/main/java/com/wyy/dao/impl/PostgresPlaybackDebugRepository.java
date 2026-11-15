package com.wyy.dao.impl;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Repository;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;

/**
 * 🐘 PostgreSQL / 云原生 RDS 播放器诊断上报仓储实现
 */
@Repository("postgresPlaybackDebugRepository")
@Primary
@ConditionalOnExpression("T(org.apache.commons.lang3.StringUtils).isNotBlank('${spring.datasource.url:}') && !'dynamodb'.equalsIgnoreCase('${storage.type:}')")
@Slf4j
public class PostgresPlaybackDebugRepository extends AbstractJdbcPlaybackDebugRepository {

    @Autowired
    private DataSource dataSource;

    @Override
    protected String getAutoIncrementPkSql() {
        return "id BIGSERIAL PRIMARY KEY";
    }

    @Override
    protected Connection getConnection() throws SQLException {
        if (dataSource == null) {
            throw new SQLException("PostgreSQL DataSource 未初始化");
        }
        return dataSource.getConnection();
    }
}
