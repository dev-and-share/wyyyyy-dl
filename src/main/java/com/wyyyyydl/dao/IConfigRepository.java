package com.wyyyyydl.dao;

/**
 * 系统通用配置与凭证仓储契约接口
 * 负责网易云 Cookie、系统偏好设置等键值对持久化，彻底与下载历史解耦 (SRP 单一职责原则)
 */
public interface IConfigRepository {

    /**
     * 保存系统配置项
     * @param key 配置键名 (例如 NETEASE_COOKIE)
     * @param value 配置内容
     */
    void saveConfig(String key, String value);

    /**
     * 获取系统配置项
     * @param key 配置键名
     * @return 配置内容，不存在时返回 null
     */
    String getConfig(String key);
}
