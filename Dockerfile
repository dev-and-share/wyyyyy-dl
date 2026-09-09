# ==============================================================================
# Stage 1: Build Svelte 5 frontend (isolated to static/svelte,不覆盖旧版)
# ==============================================================================
FROM node:22-alpine AS frontend-builder
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json* ./frontend/
RUN --mount=type=cache,target=/root/.npm cd frontend && npm ci --ignore-scripts
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# ==============================================================================
# Stage 2: Build Spring Boot JAR (JDK21 + Gradle wrapper)
# ==============================================================================
FROM eclipse-temurin:21-jdk AS jar-builder
WORKDIR /build
COPY gradlew settings.gradle build.gradle gradle.properties ./
COPY gradle ./gradle/
# 提前预热并持久化缓存 Gradle Wrapper (避免每次重新下载 120MB zip)
RUN --mount=type=cache,target=/root/.gradle chmod +x ./gradlew && ./gradlew --version
COPY src ./src/
# 注入已编译的 Svelte 产物
COPY --from=frontend-builder /build/src/main/resources/static/svelte ./src/main/resources/static/svelte
RUN --mount=type=cache,target=/root/.gradle ./gradlew bootJar -x test --no-daemon

# ==============================================================================
# Stage 3: Runtime
# ==============================================================================
FROM eclipse-temurin:21-jre
RUN mkdir -p /app/java/ /media/music
ENV auther=wyyyyy-dl
WORKDIR /app/java/
COPY --from=jar-builder /build/build/libs/wyyyyy-dl-*.jar /app/java/app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
