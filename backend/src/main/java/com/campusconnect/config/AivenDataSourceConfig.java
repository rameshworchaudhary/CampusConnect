package com.campusconnect.config;

import com.zaxxer.hikari.HikariDataSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.core.io.ClassPathResource;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyStore;
import java.security.SecureRandom;
import java.security.cert.Certificate;
import java.security.cert.CertificateFactory;
import java.util.Base64;
import java.util.Collection;

@Configuration
public class AivenDataSourceConfig {

    private final String caPath;

    public AivenDataSourceConfig(@Value("${AIVEN_CA_PATH:}") String caPath) {
        this.caPath = caPath;
    }

    @Bean
    @Primary
    public HikariDataSource dataSource(DataSourceProperties properties) {
        HikariDataSource dataSource = properties.initializeDataSourceBuilder()
                .type(HikariDataSource.class)
                .build();

        TrustStore trustStore = createTrustStore();
        dataSource.addDataSourceProperty("sslMode", "VERIFY_IDENTITY");
        dataSource.addDataSourceProperty("allowPublicKeyRetrieval", "false");
        dataSource.addDataSourceProperty("trustCertificateKeyStoreUrl", trustStore.path().toUri().toString());
        dataSource.addDataSourceProperty("trustCertificateKeyStoreType", "PKCS12");
        dataSource.addDataSourceProperty("trustCertificateKeyStorePassword", trustStore.password());
        dataSource.addDataSourceProperty("fallbackToSystemTrustStore", "false");
        return dataSource;
    }

    private TrustStore createTrustStore() {
        Path caFile = resolveCaPath();
        try (InputStream certificateInput = Files.newInputStream(caFile)) {
            CertificateFactory certificateFactory = CertificateFactory.getInstance("X.509");
            Collection<? extends Certificate> certificates = certificateFactory.generateCertificates(certificateInput);
            if (certificates.isEmpty()) {
                throw new IllegalStateException("AIVEN_CA_PATH does not contain an X.509 CA certificate");
            }

            char[] password = Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(randomBytes(24)).toCharArray();
            KeyStore keyStore = KeyStore.getInstance("PKCS12");
            keyStore.load(null, password);
            int index = 0;
            for (Certificate certificate : certificates) {
                keyStore.setCertificateEntry("aiven-ca-" + index++, certificate);
            }

            Path trustStorePath = Files.createTempFile("campusconnect-aiven-trust-", ".p12");
            trustStorePath.toFile().deleteOnExit();
            try (var output = Files.newOutputStream(trustStorePath)) {
                keyStore.store(output, password);
            }
            return new TrustStore(trustStorePath, new String(password));
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to prepare the Aiven CA truststore for MySQL TLS", exception);
        }
    }

    private byte[] randomBytes(int length) {
        byte[] bytes = new byte[length];
        new SecureRandom().nextBytes(bytes);
        return bytes;
    }

    private Path resolveCaPath() {
        if (!caPath.isBlank()) {
            Path configuredPath = Path.of(caPath);
            if (!Files.isRegularFile(configuredPath) || !Files.isReadable(configuredPath)) {
                throw new IllegalStateException("AIVEN_CA_PATH must point to a readable CA certificate file");
            }
            return configuredPath.toAbsolutePath();
        }

        try {
            Path extractedPath = Files.createTempFile("campusconnect-aiven-ca-", ".pem");
            extractedPath.toFile().deleteOnExit();
            try (var certificate = new ClassPathResource("aiven-ca.pem").getInputStream()) {
                Files.copy(certificate, extractedPath, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            }
            return extractedPath.toAbsolutePath();
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to prepare the Aiven CA certificate for MySQL TLS", exception);
        }
    }

    private record TrustStore(Path path, String password) {}
}
