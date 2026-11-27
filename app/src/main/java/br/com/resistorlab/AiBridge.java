package br.com.resistorlab;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Ponte usada pela tela do app. A chave de API é cifrada com o Android Keystore
 * e não existe método que a devolva para a página.
 */
public final class AiBridge {
    private static final String ALIAS = "resistorlab_ai";
    private final Activity activity;
    private final WebView web;
    private final SharedPreferences prefs;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();

    AiBridge(Activity activity, WebView web) {
        this.activity = activity;
        this.web = web;
        this.prefs = activity.getSharedPreferences("ai", Context.MODE_PRIVATE);
    }

    @JavascriptInterface
    public boolean hasKey() {
        return loadKey() != null;
    }

    @JavascriptInterface
    public boolean saveKey(String apiKey) {
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, secret());
            byte[] data = cipher.doFinal(apiKey.getBytes(StandardCharsets.UTF_8));
            prefs.edit()
                    .putString("data", Base64.encodeToString(data, Base64.NO_WRAP))
                    .putString("iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
                    .apply();
            return true;
        } catch (Exception error) {
            return false;
        }
    }

    @JavascriptInterface
    public void clearKey() {
        prefs.edit().clear().apply();
    }

    @JavascriptInterface
    public void ask(final String id, final String json) {
        worker.execute(() -> {
            String apiKey = loadKey();
            AiClient.Reply reply = apiKey == null
                    ? new AiClient.Reply(0, "")
                    : AiClient.send(AiClient.ENDPOINT, apiKey, json);
            final String script = "window.aiReply && window.aiReply(" + JSONObject.quote(id) + ","
                    + reply.status + "," + JSONObject.quote(reply.body) + ")";
            activity.runOnUiThread(() -> {
                if (!activity.isDestroyed()) web.evaluateJavascript(script, null);
            });
        });
    }

    void close() {
        worker.shutdownNow();
    }

    private String loadKey() {
        try {
            String data = prefs.getString("data", null);
            String iv = prefs.getString("iv", null);
            if (data == null || iv == null) return null;
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, secret(), new GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP)));
            return new String(cipher.doFinal(Base64.decode(data, Base64.NO_WRAP)), StandardCharsets.UTF_8);
        } catch (Exception error) {
            return null; // por exemplo, backup restaurado em outro aparelho
        }
    }

    private SecretKey secret() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (store.containsAlias(ALIAS)) return (SecretKey) store.getKey(ALIAS, null);
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .build());
        return generator.generateKey();
    }
}
