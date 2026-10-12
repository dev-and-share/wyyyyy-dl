# AWS Lambda SnapStart + S3 + RDS 部署操作指南

> 📖 **方案概述**：  
> 本指南将带领你将 `wyyyyy-dl` 部署到 AWS 全托管 Serverless 架构上。  
> 核心技术包含：**Java 21 + Spring Boot 3 + AWS Lambda SnapStart（毫秒级冷启动）+ AWS S3（音频持久化存储）+ CloudFront（CDN 统一分发与媒体流加速）+ RDS PostgreSQL（关系型状态库）**。  
> 全部基础设施由 **Terraform** 进行声明式自动化编排。

---

## 一、 为什么采用这套架构？

1. **SnapStart 彻底攻克 Java 冷启动**：  
   传统的 Spring Boot 在 Lambda 上冷启动通常需要 8 ~ 15 秒。SnapStart 在部署阶段为初始化好的 JVM 内存拍摄 MicroVM 快照，每次冷启动直接从快照恢复，冷启动耗时从 **10 秒级骤降至 200~400 毫秒**。
2. **CDN 选型：为什么选择 CloudFront？**  
   - **S3 回源免流量费**：S3 向 CloudFront 传输媒体文件流量费为 **$0.00/GB**（若用 Cloudflare，AWS 会收取 $0.09/GB 的外网出站费）。
   - **终身免费额度**：CloudFront 提供每月 **1 TB 免费出网流量** 与 **1000 万次免费请求**。
   - **S3 OAC 私有鉴权**：S3 存储桶完全禁止外网直接访问，仅允许 CloudFront 通过 Origin Access Control (OAC) 加密回源，安全性极高。
3. **架构与本地完全解耦**：  
   代码已做环境自适应适配：在本地开发或 Docker 运行时自动使用 **本地目录 + SQLite**；在设置了 AWS 环境变量时无缝切换为 **S3 + RDS PostgreSQL**。

---

## 二、 部署前准备

确保你的本地开发环境安装并配置好以下工具：

1. **JDK 21**：运行 `./gradlew -v` 确认构建环境具备 Java 21。
2. **Terraform CLI (>= 1.5.0)**：运行 `terraform -version` 确认安装。
3. **AWS CLI**：运行 `aws sts get-caller-identity` 确认本地已配置具备足够权限的 AWS 凭证（Region 推荐 `us-east-1` 或亚太区域）。

---

## 三、 第一步：编译与打包 Serverless ZIP 产物

在项目根目录下，执行专属的 Serverless 打包任务：

```bash
# 回到项目根目录
cd /Users/houtokki/Downloads/fast_sr/wyyyyy-dl

# 执行打包任务 (该任务会将 Java 21 class 和依赖库按 Lambda 标准 Classpath 打包)
./gradlew buildAwsZip
```

构建成功后，在 `build/distributions/` 目录下将生成标准部署文件：
```bash
ls -lh build/distributions/wyyyyy-dl-aws.zip
# 输出类似: wyyyyy-dl-aws.zip (~56MB)
```

---

## 四、 第二步：配置 Terraform 变量

进入 `terraform/` 目录并根据示例创建你的专属变量文件：

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
```

打开 `terraform.tfvars`，检查并根据需要微调参数：

```hcl
aws_region   = "us-east-1"
project_name = "wyyyyy-dl"
environment  = "prod"

# Lambda 配置
lambda_memory_size = 2048  # Spring Boot 3 建议至少分配 1536MB ~ 2048MB
lambda_timeout     = 30

# 是否启用 RDS 数据库 (true 为创建 PostgreSQL; false 为暂不创建)
enable_rds            = true
rds_instance_class    = "db.t4g.micro"
rds_db_name           = "musicdb"
rds_username          = "dbadmin"
rds_password          = "YourStrongPassword2026!" # ⚠️ 请设置你自己的强密码

# CloudFront 定价层级 (PriceClass_100: 美欧边缘节点，成本最低)
cloudfront_price_class = "PriceClass_100"
```

---

## 五、 第三步：一键初始化与部署基础设施

在 `terraform/` 目录下依次运行以下命令：

```bash
# 1. 初始化 Provider 与模块
terraform init

# 2. 预览本次将要创建的资源计划
terraform plan

# 3. 开始执行自动化部署
terraform apply
```

在终端提示 `Do you want to perform these actions?` 时，输入 `yes` 并回车。

> ⏳ **关于部署等待时间的特别说明**：  
> - **RDS 实例创建**：通常需要 3 ~ 5 分钟完成初始化与安全检查。  
> - **Lambda SnapStart 快照制作**：AWS 后台在创建版本时，会自动冷启动一次 Spring Boot 容器、执行所有初始化（包括 CRaC 预热钩子）、制作内存快照并持久化分发。因此在 `aws_lambda_function` 和 `aws_lambda_alias` 这一步停留 1 ~ 3 分钟属于**完全正常的预期现象**。  
> - **CloudFront CDN 分发**：全球边缘节点同步通常需要 2 ~ 3 分钟。

部署成功后，控制台会输出类似如下的关键接入点信息：

```text
Apply complete! Resources: 24 added, 0 changed, 0 destroyed.

Outputs:

cloudfront_url = "https://d123456abcdef.cloudfront.net"
api_gateway_url = "https://a1b2c3d4.execute-api.us-east-1.amazonaws.com"
lambda_alias_arn = "arn:aws:lambda:us-east-1:123456789012:function:wyyyyy-dl-backend-prod:prod"
rds_endpoint = "wyyyyy-dl-postgres-prod.c123456.us-east-1.rds.amazonaws.com:5432"
s3_bucket_name = "wyyyyy-dl-music-prod-a1b2c3d4"
quick_test_command = "curl -I https://d123456abcdef.cloudfront.net/v3/history/list"
```

---

## 六、 第四步：功能验证与性能测试

### 1. 验证 API 连通性与冷启动表现

使用刚才输出的 CloudFront 地址进行一次调用测试：

```bash
# 获取 CloudFront 地址
export CDN_URL=$(terraform output -raw cloudfront_url)

# 发送请求测试历史记录列表接口
curl -i "${CDN_URL}/v3/history/list"
```

你可以打开 **AWS CloudWatch Logs 控制台**，查看函数日志 `/aws/lambda/wyyyyy-dl-backend-prod`，你将看到如下记录：

```text
RESTORE_START Runtime Version: java:21.v...
...
⚡ [SnapStart CRaC] 快照恢复完成：数据库连接将在后续请求中按需重新建立。
RESTORE_REPORT Restore Duration: 312.45 ms
REPORT Duration: 48.21 ms    Billed Duration: 49 ms    Memory Size: 2048 MB    Max Memory Used: 218 MB
```
> 🚀 可以清楚看到：**Restore Duration 仅需约 300 毫秒**！Spring Boot 容器瞬间就绪并直接处理业务请求。

### 2. 测试歌曲解析与自动同步 S3

通过接口触发一首单曲下载（以歌曲 ID 为例）：

```bash
curl -X GET "${CDN_URL}/v3/download/single?id=186016"
```

后端执行流：
1. Lambda 在容器内通过网易云 API 解析音轨 URL。
2. 歌曲落盘至临时内存目录 `/tmp/`，写入 ID3 标签。
3. `S3StorageService` 自动将音频与歌词上传至私有 S3 存储桶 `s3://${s3_bucket_name}/`。
4. 元数据自动插入私有 RDS PostgreSQL 数据库 `download_history`。

### 3. 测试通过 CloudFront 播放流媒体

调用音频流接口：

```bash
curl -I "${CDN_URL}/v3/history/stream?path=186016.mp3"
```

你将观察到后端返回 **`302 Found`**，Location 直接指向 **`https://${CDN_URL}/media/186016.mp3`**。  
客户端将直接从 CloudFront CDN 读取 S3 缓存的音频，支持 Range 分片与拖拽播放，无需长时间占用 Lambda 运行开销！

---

## 七、 第五步：日常更新与迭代部署

日常开发修改了 Java 代码后，仅需两步即可平滑完成发布：

```bash
# 1. 重新打包 ZIP
cd ..
./gradlew buildAwsZip

# 2. 进入 terraform 目录执行更新
cd terraform
terraform apply
```

Terraform 会自动计算 `wyyyyy-dl-aws.zip` 的 SHA256 哈希值：
- 检测到文件变动，自动上传新包并执行 `publish = true` 创建新版本（如版本 2）。
- 后台触发 SnapStart 自动拍摄新快照。
- 快照制作完毕后，自动将别名 `prod` 指向新版本。
- 全程零停机无缝切换！

---

## 八、 资源清理与成本优化指南

如果你只是为了学习或测试体验，不想产生后续云端费用，可以在 `terraform/` 目录下执行一键销毁：

```bash
cd terraform

# ⚠️ 清理前请注意：若 S3 桶内已有音乐文件，请先清空桶或在 AWS Console 删除对象
terraform destroy
```

### 💡 生产低成本建议：
- **NAT Gateway 开销**：NAT Gateway 基础保有费用约 $32/月。如果仅为个人低频使用，可考虑在不使用时临时调整子网路由或采用轻量级的 EC2 NAT 替代方案。
- **RDS 费用**：`db.t4g.micro` 每月约 $13。如果状态数据量小，也可以将 `enable_rds` 设置为 `false`，使用 Lambda 临时轻量模式。
- **S3 + CloudFront**：在 1TB/月 流量内基本免费，长期音频存储每 GB 仅约 $0.023/月。
