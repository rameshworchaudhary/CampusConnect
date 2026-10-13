package com.campusconnect.config;

import com.zaxxer.hikari.HikariDataSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

@Configuration
public class AivenDataSourceConfig {

    private final String caPath;

    public AivenDataSourceConfig(@Value("${AIVEN_CA_PATH:}") String caPath) {
        this.caPath = caPath;
    }

    @Bean
    @ConfigurationProperties("spring.datasource")
    public DataSourceProperties dataSourceProperties() {
        return new DataSourceProperties();
    }

    @Bean
    public HikariDataSource dataSource(DataSourceProperties properties) {
        HikariDataSource dataSource = properties.initializeDataSourceBuilder()
                .type(HikariDataSource.class)
                .build();

        dataSource.addDataSourceProperty("sslMode", "VERIFY_IDENTITY");
        dataSource.addDataSourceProperty("allowPublicKeyRetrieval", "false");
        dataSource.addDataSourceProperty("sslCa", resolveCaPath());
        return dataSource;
    }

    private String resolveCaPath() {
        if (!caPath.isBlank()) {
            Path configuredPath = Path.of(caPath);
            if (!Files.isRegularFile(configuredPath) || !Files.isReadable(configuredPath)) {
                throw new IllegalStateException("AIVEN_CA_PATH must point to a readable CA certificate file");
            }
            return configuredPath.toAbsolutePath().toString();
        }

        try {
            Path extractedPath = Files.createTempFile("campusconnect-aiven-ca-", ".pem");
            extractedPath.toFile().deleteOnExit();
            try (var certificate = new ClassPathResource("aiven-ca.pem").getInputStream()) {
                Files.copy(certificate, extractedPath, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            }
            return extractedPath.toAbsolutePath().toString();
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to prepare the Aiven CA certificate for MySQL TLS", exception);
        }
    }
}
