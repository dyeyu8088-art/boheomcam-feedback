package com.yanbiangame.app;

import android.app.Activity;
import android.content.pm.ActivityInfo;
import android.content.res.AssetManager;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import fi.iki.elonen.NanoHTTPD;
import java.io.IOException;
import java.io.InputStream;

/**
 * 测试用 WebView 壳：把 dist/ 打进 assets/www，由内嵌 HTTP 服务器（127.0.0.1 随机端口）提供，
 * 这样页面拥有正常的 http 源（localStorage / ES module / fetch / WebSocket 均与浏览器一致）。
 * 服务器地址在登录页「服务器设置」里填写（存 localStorage）。
 * 正式发布仍按 docs/10-deployment.md 用 Capacitor + Android Studio 打包并签名。
 */
public class MainActivity extends Activity {
  private WebView web;
  private AssetServer server;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
    hideSystemUi();
    try {
      server = new AssetServer(getAssets());
      server.start(NanoHTTPD.SOCKET_READ_TIMEOUT, false);
    } catch (IOException e) {
      throw new RuntimeException("asset server failed", e);
    }
    web = new WebView(this);
    WebSettings s = web.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);
    s.setDatabaseEnabled(true);
    s.setMediaPlaybackRequiresUserGesture(false);
    s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
    s.setUseWideViewPort(true);
    s.setLoadWithOverviewMode(true);
    s.setSupportZoom(false);
    s.setBuiltInZoomControls(false);
    s.setAllowFileAccess(false);
    s.setCacheMode(WebSettings.LOAD_DEFAULT);
    s.setUserAgentString(s.getUserAgentString() + " YanbianGameApp/1.0");
    WebView.setWebContentsDebuggingEnabled(true);
    web.setBackgroundColor(Color.parseColor("#0A0E14"));
    web.setWebViewClient(new WebViewClient());
    web.setWebChromeClient(new WebChromeClient());
    setContentView(web);
    web.loadUrl("http://127.0.0.1:" + server.getListeningPort() + "/index.html");
  }

  private void hideSystemUi() {
    View d = getWindow().getDecorView();
    d.setSystemUiVisibility(
        View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            | View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
  }

  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    if (hasFocus) hideSystemUi();
  }

  @Override
  public void onBackPressed() {
    if (web != null && web.canGoBack()) web.goBack();
    else super.onBackPressed();
  }

  @Override
  protected void onPause() {
    super.onPause();
    if (web != null) web.onPause();
  }

  @Override
  protected void onResume() {
    super.onResume();
    if (web != null) web.onResume();
  }

  @Override
  protected void onDestroy() {
    if (server != null) server.stop();
    if (web != null) web.destroy();
    super.onDestroy();
  }

  /** 从 APK assets/www 提供静态文件；未知路径回退 index.html（hash 路由不需要，但保底） */
  static class AssetServer extends NanoHTTPD {
    private final AssetManager assets;

    AssetServer(AssetManager assets) {
      super("127.0.0.1", 0);
      this.assets = assets;
    }

    @Override
    public Response serve(IHTTPSession session) {
      String uri = session.getUri();
      int q = uri.indexOf('?');
      if (q >= 0) uri = uri.substring(0, q);
      if (uri.equals("/") || uri.isEmpty()) uri = "/index.html";
      String path = "www" + uri;
      try {
        InputStream in = assets.open(path);
        Response r = newChunkedResponse(Response.Status.OK, mime(path), in);
        r.addHeader("Cache-Control", "no-cache");
        return r;
      } catch (IOException e) {
        try {
          InputStream in = assets.open("www/index.html");
          return newChunkedResponse(Response.Status.OK, "text/html; charset=utf-8", in);
        } catch (IOException e2) {
          return newFixedLengthResponse(Response.Status.NOT_FOUND, "text/plain", "404");
        }
      }
    }

    static String mime(String p) {
      String l = p.toLowerCase();
      if (l.endsWith(".html")) return "text/html; charset=utf-8";
      if (l.endsWith(".js") || l.endsWith(".mjs")) return "application/javascript; charset=utf-8";
      if (l.endsWith(".css")) return "text/css; charset=utf-8";
      if (l.endsWith(".json")) return "application/json; charset=utf-8";
      if (l.endsWith(".png")) return "image/png";
      if (l.endsWith(".webp")) return "image/webp";
      if (l.endsWith(".jpg") || l.endsWith(".jpeg")) return "image/jpeg";
      if (l.endsWith(".svg")) return "image/svg+xml";
      if (l.endsWith(".mp3")) return "audio/mpeg";
      if (l.endsWith(".ogg")) return "audio/ogg";
      if (l.endsWith(".woff2")) return "font/woff2";
      if (l.endsWith(".woff")) return "font/woff";
      if (l.endsWith(".ttf")) return "font/ttf";
      if (l.endsWith(".wasm")) return "application/wasm";
      if (l.endsWith(".ico")) return "image/x-icon";
      return "application/octet-stream";
    }
  }
}
