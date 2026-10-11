# Sử dụng image Maven chính thức để build ứng dụng
FROM maven:3-eclipse-temurin-21 AS build

# Thiết lập thư mục làm việc trong container
WORKDIR /app

# Sao chép file pom.xml và các file cần thiết để tải về dependencies
COPY pom.xml .

# Tải về dependencies
RUN mvn dependency:go-offline -B

# Sao chép toàn bộ mã nguồn vào container
COPY src ./src

# Build ứng dụng bằng Maven
RUN mvn clean package -DskipTests

# Sử dụng image OpenJDK chính thức để chạy ứng dụng
FROM eclipse-temurin:21-jre-jammy

# Thiết lập múi giờ
RUN apt-get update && apt-get install -y tzdata && \
    ln -snf /usr/share/zoneinfo/Asia/Ho_Chi_Minh /etc/localtime && \
    echo "Asia/Ho_Chi_Minh" > /etc/timezone

ENV TZ=Asia/Ho_Chi_Minh

#them moi doan nay
WORKDIR /app

# Sao chép file JAR từ bước build sang bước chạy
COPY --from=build /app/target/Nso-jar-with-dependencies.jar /app/Nso.jar

# Sao chép các file cấu hình cần thiết
COPY config.properties /app/config.properties
COPY mysql.properties /app/mysql.properties

# Sao chép file run.sh
COPY run.sh /app/run.sh

# Sao chép thư mục Data
COPY Data /app/Data
RUN chmod +x /app/run.sh

# Mở cổng cần thiết để ứng dụng hoạt động
EXPOSE 14444

# Lệnh để chạy ứng dụng khi container khởi động
CMD ["/bin/bash", "/app/run.sh"]
