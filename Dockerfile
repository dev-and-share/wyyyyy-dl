FROM eclipse-temurin:21-jre
RUN mkdir -p /app/java/ /media/music
ENV auther=pewee
WORKDIR /app/java/
COPY ./build/libs/neteasemusic-1.0.0.jar /app/java/app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]