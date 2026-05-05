package br.com.totembite.webview;

import android.app.Activity;
import android.graphics.Color;
import android.net.http.SslError;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.SslErrorHandler;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
    private static final String APP_URL = "https://totembite.yamasoft.com.br/";

    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN
        );

        webView = new WebView(this);
        webView.setBackgroundColor(Color.WHITE);
        webView.setWebViewClient(new AppWebViewClient());

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setMediaPlaybackRequiresUserGesture(false);

        setContentView(webView);
        hideSystemUi();
        showLoading();
        webView.loadUrl(APP_URL);
    }

    @Override
    protected void onResume() {
        super.onResume();
        hideSystemUi();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemUi();
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    private void hideSystemUi() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        );
    }

    private void showLoading() {
        webView.loadDataWithBaseURL(
                null,
                "<!doctype html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'>" +
                        "<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fff8ef;" +
                        "font-family:Arial,sans-serif;color:#2b1406}main{padding:28px;text-align:center}h1{font-size:28px}" +
                        "p{font-size:18px;color:#7a5448}</style></head><body><main><h1>Totem Bite</h1>" +
                        "<p>Carregando cardapio...</p></main></body></html>",
                "text/html",
                "UTF-8",
                null
        );
    }

    private void showError(String detail) {
        String safeDetail = detail == null ? "Erro desconhecido" : detail.replace("<", "").replace(">", "");
        webView.loadDataWithBaseURL(
                null,
                "<!doctype html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'>" +
                        "<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fff8ef;" +
                        "font-family:Arial,sans-serif;color:#2b1406}main{width:min(520px,100%);padding:28px;text-align:center}" +
                        "h1{font-size:28px;margin:0 0 12px}p{font-size:17px;color:#7a5448;line-height:1.4}" +
                        "button{width:100%;min-height:54px;border:0;border-radius:14px;background:#c82e24;color:#fff;" +
                        "font:inherit;font-weight:900}</style></head><body><main><h1>Nao foi possivel abrir</h1>" +
                        "<p>Verifique a internet e tente novamente.</p><p>" + safeDetail + "</p>" +
                        "<button onclick=\"location.href='" + APP_URL + "'\">Tentar novamente</button></main></body></html>",
                "text/html",
                "UTF-8",
                null
        );
    }

    private class AppWebViewClient extends WebViewClient {
        @Override
        public void onPageFinished(WebView view, String url) {
            super.onPageFinished(view, url);
            hideSystemUi();
        }

        @Override
        public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
            super.onReceivedError(view, errorCode, description, failingUrl);
            if (failingUrl != null && failingUrl.startsWith(APP_URL)) {
                showError("Erro " + errorCode + ": " + description);
            }
        }

        @Override
        public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
            handler.cancel();
            showError("Erro SSL: " + error);
        }
    }
}
