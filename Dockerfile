# ==============================================================================
# Stage 1: Build Svelte 5 frontend (isolated to static/svelte,不覆盖旧版)
# ==============================================================================
FROM node:22-alpine AS frontend-builder
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json* ./frontend/
RUN cd frontend && npm ci
COPY frontend/ ./frontend/
COPY src/main/resources/static/css/ ./src/main/resources/static/css/
RUN cd frontend && npm run build

# ==============================================================================
# Stage 2: Build Spring Boot JAR (JDK21 + Gradle wrapper)
# ==============================================================================
FROM eclipse-temurin:21-jdk AS jar-builder
WORKDIR /build
COPY gradlew settings.gradle build.gradle gradle.properties ./
COPY gradle ./gradle/
COPY src ./src/
# 注入已编译的 Svelte 产物
COPY --from=frontend-builder /build/src/main/resources/static/svelte ./src/main/resources/static/svelte
RUN chmod +x ./gradlew && ./gradlew bootJar -x test --no-daemon

# ==============================================================================
# Stage 3: Runtime
# ==============================================================================
FROM eclipse-temurin:21-jre
RUN mkdir -p /app/java/ /media/music
ENV auther=pewee
WORKDIR /app/java/
COPY --from=jar-builder /build/build/libs/neteasemusic-1.0.0.jar /app/java/app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
