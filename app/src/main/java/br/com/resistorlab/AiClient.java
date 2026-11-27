package br.com.resistorlab;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Envia o pedido à API. Java puro, para poder ser testado fora do Android. */
final class AiClient {
    static final String ENDPOINT = "https://api.anthropic.com/v1/messages";
    static final String API_VERSION = "2026-10-21";
    private static final int MAX_RESPONSE = 1_000_000;

    static final class Reply {
        final int status; // -1 = falha de rede
        final String body;
        Reply(int status, String body) { this.status = status; this.body = body; }
    }

    static Reply send(String endpoint, String apiKey, String json) {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(endpoint).openConnection();
            connection.setInstanceFollowRedirects(false); // a chave nunca segue para outro endereço
            connection.setConnectTimeout(20_000);
            connection.setReadTimeout(70_000);
            connection.setRequestMethod("POST");
            connection.setDoOutput(true);
            connection.setRequestProperty("Authorization", "Bearer " + apiKey);
            connection.setRequestProperty("anthropic-version", API_VERSION);
            connection.setRequestProperty("content-type", "application/json");
            try (OutputStream out = connection.getOutputStream()) {
                out.write(json.getBytes(StandardCharsets.UTF_8));
            }
            int status = connection.getResponseCode();
            InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
            return new Reply(status, stream == null ? "" : read(stream));
        } catch (IOException | RuntimeException error) {
            return new Reply(-1, ""); // sem detalhes, para a chave não aparecer em mensagens
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private static String read(InputStream stream) throws IOException {
        try (InputStream in = stream; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int n;
            while ((n = in.read(buffer)) > 0 && out.size() < MAX_RESPONSE) out.write(buffer, 0, n);
            return new String(out.toByteArray(), StandardCharsets.UTF_8);
        }
    }
}
