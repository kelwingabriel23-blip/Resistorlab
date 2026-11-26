package br.com.resistorlab;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Insets;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.window.OnBackInvokedDispatcher;

/** Mostra a interface do Resistor Lab, que está dentro do próprio APK (pasta assets). */
public class MainActivity extends Activity {
    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(4, 10, 23));
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(4, 10, 23));
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true); // histórico e cálculos salvos
        settings.setAllowContentAccess(false);
        web.setWebViewClient(new WebViewClient());
        root.addView(web);
        setContentView(root);

        // Android 11+: mantém o conteúdo fora das barras do sistema e do teclado.
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            root.setOnApplyWindowInsetsListener((View view, WindowInsets insets) -> {
                Insets area = insets.getInsets(WindowInsets.Type.systemBars()
                        | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                view.setPadding(area.left, area.top, area.right, area.bottom);
                return WindowInsets.CONSUMED;
            });
        }
        // Android 13+: gesto de voltar.
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::handleBack);
        }
        web.loadUrl("file:///android_asset/index.html");
    }

    private void handleBack() {
        web.evaluateJavascript("window.appBack ? window.appBack() : false", handled -> {
            if (!"true".equals(handled)) finish();
        });
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        handleBack();
    }

    @Override
    protected void onDestroy() {
        web.destroy();
        super.onDestroy();
    }
}
