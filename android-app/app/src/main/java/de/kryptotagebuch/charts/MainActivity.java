package de.kryptotagebuch.charts;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.GestureDetector;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity {
    private static final String DATA_URL = "https://krypto-tagebuch.vercel.app/api/mobile/markets";
    private static final String CACHE_NAME = "market_cache";
    private static final String CACHE_KEY = "last_payload";
    private static final int PANEL = Color.rgb(15, 23, 42);
    private static final int PANEL_2 = Color.rgb(30, 41, 59);
    private static final int BORDER = Color.rgb(51, 65, 85);
    private static final int TEXT = Color.rgb(248, 250, 252);
    private static final int MUTED = Color.rgb(148, 163, 184);
    private static final int BLUE = Color.rgb(56, 189, 248);
    private static final int GREEN = Color.rgb(52, 211, 153);
    private static final int RED = Color.rgb(251, 113, 133);
    private static final int AMBER = Color.rgb(251, 191, 36);
    private static final String[] TIMEFRAMES = {"m30", "daily", "weekly", "monthly"};
    private static final String[] TIMEFRAME_LABELS = {"30M", "1D", "1W", "1M"};

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final List<JSONObject> markets = new ArrayList<>();
    private FrameLayout root;
    private JSONObject selectedMarket;
    private int timeframeIndex;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        root = findViewById(R.id.app_root);
        String cached = getSharedPreferences(CACHE_NAME, MODE_PRIVATE).getString(CACHE_KEY, "");
        if (!cached.isEmpty() && parseMarkets(cached)) showHome();
        else showLoading();
        refreshMarkets();
    }

    private void refreshMarkets() {
        executor.execute(() -> {
            try {
                HttpURLConnection connection = (HttpURLConnection) new URL(DATA_URL).openConnection();
                connection.setRequestMethod("GET");
                connection.setConnectTimeout(12_000);
                connection.setReadTimeout(20_000);
                connection.setRequestProperty("Accept", "application/json");
                connection.setRequestProperty("User-Agent", "KryptoChartsAndroid/2.0");
                int status = connection.getResponseCode();
                if (status != 200) throw new IllegalStateException("HTTP " + status);
                BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8));
                StringBuilder body = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) body.append(line);
                reader.close();
                connection.disconnect();
                String json = body.toString();
                if (!parseMarkets(json)) throw new IllegalStateException("Leere Marktdaten");
                getSharedPreferences(CACHE_NAME, MODE_PRIVATE).edit().putString(CACHE_KEY, json).apply();
                mainHandler.post(() -> {
                    if (selectedMarket == null) showHome();
                    else showDetail(selectedMarket, timeframeIndex);
                });
            } catch (Exception ignored) {
                mainHandler.post(() -> { if (markets.isEmpty()) showError(); });
            }
        });
    }

    private synchronized boolean parseMarkets(String json) {
        try {
            JSONArray items = new JSONObject(json).getJSONArray("markets");
            List<JSONObject> parsed = new ArrayList<>();
            for (int index = 0; index < items.length(); index++) parsed.add(items.getJSONObject(index));
            if (parsed.isEmpty()) return false;
            markets.clear();
            markets.addAll(parsed);
            if (selectedMarket != null) {
                String symbol = selectedMarket.optString("symbol");
                for (JSONObject market : parsed) if (symbol.equals(market.optString("symbol"))) selectedMarket = market;
            }
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }

    private void showLoading() {
        root.removeAllViews();
        ProgressBar progress = new ProgressBar(this);
        root.addView(progress, new FrameLayout.LayoutParams(dp(52), dp(52), Gravity.CENTER));
    }

    private void showError() {
        root.removeAllViews();
        LinearLayout box = vertical();
        box.setGravity(Gravity.CENTER);
        box.setPadding(dp(32), dp(32), dp(32), dp(32));
        TextView message = text(getString(R.string.network_error), 18, TEXT, true);
        message.setGravity(Gravity.CENTER);
        box.addView(message);
        Button retry = new Button(this);
        retry.setText(R.string.retry);
        retry.setOnClickListener(view -> { showLoading(); refreshMarkets(); });
        LinearLayout.LayoutParams retryParams = wrap();
        retryParams.topMargin = dp(18);
        box.addView(retry, retryParams);
        root.addView(box, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
    }

    private void showHome() {
        selectedMarket = null;
        root.removeAllViews();
        LinearLayout page = vertical();
        page.setPadding(dp(20), dp(22), dp(20), dp(24));
        LinearLayout heading = horizontal();
        LinearLayout titleBox = vertical();
        titleBox.addView(text(getString(R.string.home_title), 30, TEXT, true));
        titleBox.addView(text(getString(R.string.home_subtitle), 14, MUTED, false));
        heading.addView(titleBox, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        TextView refresh = pill("↻", BLUE, PANEL_2);
        refresh.setGravity(Gravity.CENTER);
        refresh.setOnClickListener(view -> refreshMarkets());
        heading.addView(refresh, new LinearLayout.LayoutParams(dp(48), dp(48)));
        page.addView(heading);

        for (JSONObject market : markets) {
            LinearLayout.LayoutParams params = matchWrap();
            params.topMargin = dp(16);
            page.addView(createCoinCard(market), params);
        }
        TextView hint = text("Tippe auf einen Coin, um seine Charts zu öffnen.", 13, MUTED, false);
        hint.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams hintParams = matchWrap();
        hintParams.topMargin = dp(22);
        page.addView(hint, hintParams);
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.addView(page);
        root.addView(scroll, fullFrame());
    }

    private View createCoinCard(JSONObject market) {
        LinearLayout card = horizontal();
        card.setGravity(Gravity.CENTER_VERTICAL);
        card.setPadding(dp(18), dp(18), dp(16), dp(18));
        card.setBackground(rounded(PANEL, BORDER, 22));
        String symbol = market.optString("symbol").replace("USDT", "");
        TextView coin = text(coinGlyph(symbol), 25, TEXT, true);
        coin.setGravity(Gravity.CENTER);
        coin.setBackground(rounded(coinColor(symbol), coinColor(symbol), 26));
        card.addView(coin, new LinearLayout.LayoutParams(dp(52), dp(52)));
        LinearLayout info = vertical();
        info.setPadding(dp(14), 0, 0, 0);
        info.addView(text(symbol, 21, TEXT, true));
        info.addView(text(formatPrice(market.optDouble("currentPrice")) + " USDT", 15, MUTED, false));
        card.addView(info, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        String direction = market.optString("direction", "wait");
        card.addView(pill(directionLabel(direction), directionColor(direction), PANEL_2));
        card.addView(text("  ›", 30, MUTED, false));
        card.setOnClickListener(view -> {
            selectedMarket = market;
            timeframeIndex = preferredStartIndex(market);
            showDetail(market, timeframeIndex);
        });
        return card;
    }

    private void showDetail(JSONObject market, int index) {
        selectedMarket = market;
        timeframeIndex = Math.max(0, Math.min(index, TIMEFRAMES.length - 1));
        root.removeAllViews();
        LinearLayout page = vertical();
        LinearLayout top = horizontal();
        top.setGravity(Gravity.CENTER_VERTICAL);
        top.setPadding(dp(12), dp(12), dp(16), dp(10));
        TextView back = text("‹", 40, TEXT, false);
        back.setGravity(Gravity.CENTER);
        back.setOnClickListener(view -> showHome());
        top.addView(back, new LinearLayout.LayoutParams(dp(48), dp(48)));
        LinearLayout title = vertical();
        String coin = market.optString("symbol").replace("USDT", "");
        title.addView(text(coin + " / USDT", 22, TEXT, true));
        title.addView(text(formatPrice(market.optDouble("currentPrice")) + " USDT", 14, MUTED, false));
        top.addView(title, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        page.addView(top);

        LinearLayout tabs = horizontal();
        tabs.setPadding(dp(14), 0, dp(14), dp(10));
        for (int tabIndex = 0; tabIndex < TIMEFRAME_LABELS.length; tabIndex++) {
            final int target = tabIndex;
            boolean active = tabIndex == timeframeIndex;
            TextView tab = text(TIMEFRAME_LABELS[tabIndex], 14, active ? Color.rgb(2, 6, 23) : MUTED, true);
            tab.setGravity(Gravity.CENTER);
            tab.setBackground(rounded(active ? BLUE : PANEL, active ? BLUE : BORDER, 12));
            tab.setOnClickListener(view -> showDetail(market, target));
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, dp(42), 1);
            if (tabIndex > 0) params.leftMargin = dp(7);
            tabs.addView(tab, params);
        }
        page.addView(tabs);

        JSONObject plan = findPlan(market, TIMEFRAMES[timeframeIndex]);
        ChartView chart = new ChartView(this);
        chart.setMarketData(market, TIMEFRAMES[timeframeIndex], plan);
        LinearLayout.LayoutParams chartParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(360));
        chartParams.leftMargin = dp(10);
        chartParams.rightMargin = dp(10);
        page.addView(chart, chartParams);
        GestureDetector detector = new GestureDetector(this, new GestureDetector.SimpleOnGestureListener() {
            @Override public boolean onDown(MotionEvent event) { return true; }
            @Override public boolean onFling(MotionEvent first, MotionEvent second, float velocityX, float velocityY) {
                if (first == null || second == null || Math.abs(second.getX() - first.getX()) < dp(60) || Math.abs(velocityX) < 250) return false;
                int next = timeframeIndex + (second.getX() < first.getX() ? 1 : -1);
                if (next >= 0 && next < TIMEFRAMES.length) showDetail(market, next);
                return true;
            }
        });
        chart.setOnTouchListener((view, event) -> detector.onTouchEvent(event));
        TextView swipeHint = text("←  Wischen für unter- oder übergeordneten Chart  →", 12, MUTED, false);
        swipeHint.setGravity(Gravity.CENTER);
        swipeHint.setPadding(0, dp(6), 0, dp(10));
        page.addView(swipeHint);
        page.addView(createDescription(market, plan));
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.addView(page);
        root.addView(scroll, fullFrame());
    }

    private View createDescription(JSONObject market, JSONObject plan) {
        LinearLayout card = vertical();
        card.setPadding(dp(18), dp(16), dp(18), dp(18));
        card.setBackground(rounded(PANEL, BORDER, 20));
        LinearLayout.LayoutParams cardParams = matchWrap();
        cardParams.setMargins(dp(14), 0, dp(14), dp(24));
        card.setLayoutParams(cardParams);
        String wave;
        String direction;
        JSONArray levels;
        JSONObject invalidation;
        if (plan != null) {
            wave = plan.optString("waveLabel", "Welle unklar");
            direction = plan.optString("direction", "wait");
            levels = plan.optJSONArray("levels");
            invalidation = plan.optJSONObject("invalidation");
        } else {
            JSONObject active = market.optJSONObject("activeCase");
            wave = active == null ? "Welle unklar" : active.optString("waveLabel", "Welle unklar");
            direction = market.optString("direction", "wait");
            levels = active == null ? null : active.optJSONArray("fibonacciLevels");
            invalidation = market.optJSONObject("invalidation");
        }
        LinearLayout line = horizontal();
        line.setGravity(Gravity.CENTER_VERTICAL);
        line.addView(text("Laufende Welle", 13, MUTED, true), new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        line.addView(pill(directionLabel(direction), directionColor(direction), PANEL_2));
        card.addView(line);
        TextView waveView = text(wave, 21, TEXT, true);
        LinearLayout.LayoutParams waveParams = matchWrap();
        waveParams.topMargin = dp(6);
        card.addView(waveView, waveParams);
        if (levels != null && levels.length() > 0) {
            TextView heading = text("Fibonacci-Level", 13, MUTED, true);
            LinearLayout.LayoutParams headingParams = matchWrap();
            headingParams.topMargin = dp(18);
            card.addView(heading, headingParams);
            for (int i = 0; i < levels.length(); i++) {
                JSONObject level = levels.optJSONObject(i);
                if (level == null) continue;
                String role = level.optString("role");
                String roleText = role.equals("long_entry") ? "LONG-EINSTIEG" : role.equals("short_entry") ? "SHORT-EINSTIEG" : "ZIEL";
                TextView row = text("Fib " + level.optString("ratio") + "  ·  " + formatPrice(level.optDouble("price")) + " USDT  ·  " + roleText, 15, AMBER, true);
                row.setPadding(0, dp(7), 0, 0);
                card.addView(row);
            }
        }
        if (invalidation != null) {
            String relation = invalidation.optString("relation").equals("below") ? "Unter " : "Über ";
            TextView invalid = text("Invalidierung: " + relation + formatPrice(invalidation.optDouble("price")) + " USDT", 14, RED, true);
            invalid.setPadding(0, dp(18), 0, 0);
            card.addView(invalid);
        }
        String note = plan == null ? market.optString("currentWaveSummary") : plan.optString("note");
        if (!note.isEmpty()) {
            TextView noteView = text(note, 14, MUTED, false);
            noteView.setPadding(0, dp(13), 0, 0);
            card.addView(noteView);
        }
        return card;
    }

    private JSONObject findPlan(JSONObject market, String timeframe) {
        JSONArray plans = market.optJSONArray("signalPlans");
        if (plans == null) return null;
        for (int i = 0; i < plans.length(); i++) {
            JSONObject plan = plans.optJSONObject(i);
            if (plan != null && timeframe.equals(plan.optString("timeframe"))) return plan;
        }
        return null;
    }

    private int preferredStartIndex(JSONObject market) {
        JSONObject candles = market.optJSONObject("candles");
        JSONArray m30 = candles == null ? null : candles.optJSONArray("m30");
        return m30 != null && m30.length() > 1 ? 0 : 1;
    }

    private LinearLayout vertical() { LinearLayout view = new LinearLayout(this); view.setOrientation(LinearLayout.VERTICAL); return view; }
    private LinearLayout horizontal() { LinearLayout view = new LinearLayout(this); view.setOrientation(LinearLayout.HORIZONTAL); return view; }
    private TextView text(String value, float size, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value); view.setTextSize(size); view.setTextColor(color);
        view.setTypeface(Typeface.create("sans", bold ? Typeface.BOLD : Typeface.NORMAL));
        return view;
    }
    private TextView pill(String value, int color, int background) {
        TextView view = text(value, 12, color, true);
        view.setGravity(Gravity.CENTER); view.setPadding(dp(11), dp(7), dp(11), dp(7));
        view.setBackground(rounded(background, color, 18)); return view;
    }
    private GradientDrawable rounded(int fill, int stroke, int radiusDp) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(fill); drawable.setCornerRadius(dp(radiusDp)); drawable.setStroke(dp(1), stroke); return drawable;
    }
    private LinearLayout.LayoutParams matchWrap() { return new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT); }
    private LinearLayout.LayoutParams wrap() { return new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT); }
    private FrameLayout.LayoutParams fullFrame() { return new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT); }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }

    private static String directionLabel(String direction) { return "long".equals(direction) ? "LONG" : "short".equals(direction) ? "SHORT" : "WARTEN"; }
    private static int directionColor(String direction) { return "long".equals(direction) ? GREEN : "short".equals(direction) ? RED : AMBER; }
    private static int coinColor(String symbol) { return "BTC".equals(symbol) ? Color.rgb(245, 158, 11) : "ETH".equals(symbol) ? Color.rgb(99, 102, 241) : Color.rgb(139, 92, 246); }
    private static String coinGlyph(String symbol) { return "BTC".equals(symbol) ? "₿" : "ETH".equals(symbol) ? "Ξ" : "S"; }
    static String formatPrice(double value) {
        if (!Double.isFinite(value)) return "—";
        NumberFormat format = NumberFormat.getNumberInstance(Locale.GERMANY);
        format.setMinimumFractionDigits(value < 1000 ? 2 : 0); format.setMaximumFractionDigits(value < 1000 ? 2 : 0);
        return format.format(value);
    }

    @Override public void onBackPressed() { if (selectedMarket != null) showHome(); else super.onBackPressed(); }
    @Override protected void onDestroy() { executor.shutdownNow(); super.onDestroy(); }
}
