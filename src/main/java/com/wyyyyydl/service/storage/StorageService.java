package com.wyyyyydl.service.storage;

import java.io.File;
import java.io.InputStream;

public interface StorageService {

    /**
     * 是否已开启 S3 云存储模式
     */
    boolean isS3Enabled();

    /**
     * 上传本地文件到存储（S3 或本地归档）
     * @param key 存储对象键（相对路径）
     * @param file 本地物理文件
     * @param contentType MIME 类型
     * @return 存储后的访问路径或 Key
     */
    String uploadFile(String key, File file, String contentType);

    /**
     * 上传流数据
     */
    String uploadStream(String key, InputStream is, long length, String contentType);

    /**
     * 获取文件访问 URL（优先经由 CloudFront 加速或 S3 签名 URL）
     */
    String getAccessUrl(String key);

    /**
     * 删除文件
     */
    boolean deleteFile(String key);
}
