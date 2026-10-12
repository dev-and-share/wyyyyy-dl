# AWS Lambda SnapStart Serverless 部署操作指南

> 📖 **方案概述**：  
> 本指南支持将 `wyyyyy-dl` 部署为全托管 AWS 云原生应用。  
> 我们在同个代码库中提供了**两套开箱即用的部署方案**，代码已完成三模自适应（本地 SQLite / RDS PostgreSQL / DynamoDB），按需挑选即可：
> - 🌟 **方案 1：极致省钱版 (推荐)** — `Lambda SnapStart + S3 + CloudFront + DynamoDB`（**固定月费 $0.00**，无 VPC、免 NAT 网关、免连接池维护）
> - 🏢 **方案 2：企业内网版** — `Lambda SnapStart + S3 + CloudFront + VPC + RDS PostgreSQL`（标准关系型 SQL，内置预留并发防打爆）

---

## 一、 为什么推荐方案 1 (DynamoDB 极致省钱版)？

许多开发者在初试 AWS Serverless 时，最大的痛点是**意外的账单底噪**：
1. **Lambda 本身天然能免费访问公网（网易云 API）**。
2. 一旦挂载私有数据库（RDS），Lambda 就被迫放入 VPC 私有子网，从而**失去公网能力**。为了帮 Lambda 通网，必须被迫购买 **NAT Gateway（~$32/月）**。
3. 高并发下怕打爆 RDS，又有人考虑购买 **RDS Proxy（~$20/月）**。
4. **破局点**：选用 **DynamoDB**，Lambda 彻底无需 VPC，瞬间恢复原生免费上网能力。**直接省下 NAT Gateway 与 RDS 实例费用，待机固定月费真正等于 $0.00**！

---

## 二、 部署前准备

1. **JDK 21**：运行 `./gradlew -v` 确认具备 Java 21。
2. **Terraform CLI (>= 1.5.0)**：运行 `terraform -version`。
3. **AWS CLI**：运行 `aws sts get-caller-identity` 确认已登录具备对应权限的 AWS 账号。

---

## 三、 第一步：统一打包 Serverless 产物

无论采用哪种方案，编译与打包只需在项目根目录下执行一次：

```bash
cd /Users/houtokki/Downloads/fast_sr/wyyyyy-dl

# 执行打包任务 (生成包含 Java 21 class 与所有第三方依赖的标准 Zip)
./gradlew buildAwsZip
```

生成的部署包位置：`build/distributions/wyyyyy-dl-aws.zip` (~56MB)。

---

## 四、 第二步：选择方案并一键部署

### 🌟 路线 A：部署方案 1（极力推荐：$0/月 极致省钱版）

```bash
cd terraform/serverless-dynamodb

# 1. 复制变量配置 (默认开箱即用，无需修改)
cp terraform.tfvars.example terraform.tfvars

# 2. 初始化与查看计划
terraform init
terraform plan

# 3. 执行自动化部署
terraform apply
```
> 输入 `yes` 确认。耗时约 2~3 分钟（主要在 Lambda SnapStart 拍摄快照与 CloudFront 分发）。

---

### 🏢 路线 B：部署方案 2（企业内网版：VPC + RDS PostgreSQL）

```bash
cd terraform/vpc-rds

# 1. 复制变量配置
cp terraform.tfvars.example terraform.tfvars
# (可选：按需修改 terraform.tfvars 中的 rds_password)

# 2. 初始化与查看计划
terraform init
terraform plan

# 3. 执行自动化部署
terraform apply
```
> 输入 `yes` 确认。耗时约 4~6 分钟（包含 RDS 实例创建、VPC NAT 网关与 SnapStart 快照制作）。

---

## 五、 第三步：验证与测试

部署成功后，终端将输出 `cloudfront_url`：

### 1. 验证健康检查与 SnapStart 冷启动表现
```bash
export CDN_URL=$(terraform output -raw cloudfront_url)

# 发送请求测试历史记录接口
curl -i "${CDN_URL}/v3/history/list"
```

进入 AWS CloudWatch Logs，你可以看到类似输出：
```text
RESTORE_START Runtime Version: java:21.v...
⚡ [SnapStart CRaC] 快照恢复完成！
RESTORE_REPORT Restore Duration: 312.45 ms
REPORT Duration: 48.21 ms ...
```
> 🚀 **冷启动仅需 ~300ms**，对比传统 JVM 启动提速近 30 倍！

### 2. 验证歌曲下载与 S3 / CloudFront 播放
```bash
# 解析并下载单曲
curl -X GET "${CDN_URL}/v3/download/single?id=186016"

# 请求音频播放流 (自动 302 重定向至 CloudFront CDN，不消耗 Lambda 时长)
curl -I "${CDN_URL}/v3/history/stream?path=186016.mp3"
```

---

## 六、 日常更新部署

日常修改 Java 代码后：
```bash
# 1. 根目录重新打包
./gradlew buildAwsZip

# 2. 进入你所选的 terraform 目录直接 apply
cd terraform/serverless-dynamodb  # 或 cd terraform/vpc-rds
terraform apply
```
Terraform 会感知代码包的 Hash 变化，自动发布新版本、制作新快照并无缝热切别名。

---

## 七、 资源清理与销毁

不再使用时，进入你部署的目录执行销毁即可：

```bash
# 方案 1 销毁
cd terraform/serverless-dynamodb && terraform destroy

# 或方案 2 销毁
cd terraform/vpc-rds && terraform destroy
```
所有资源将被一键彻底回收，不留任何残留计费。
