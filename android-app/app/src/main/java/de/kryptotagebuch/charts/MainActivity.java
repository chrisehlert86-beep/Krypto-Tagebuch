package de.kryptotagebuch.charts;

import android.app.Activity;
import android.app.TimePickerDialog;
import android.Manifest;
import android.content.pm.PackageManager;
import android.content.Intent;
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
import android.widget.ImageView;
import android.widget.Toast;
import android.widget.EditText;
import android.widget.Spinner;
import android.widget.ArrayAdapter;
import android.view.ViewGroup;
import android.text.InputType;
import android.os.Build;
import android.view.WindowInsets;

import com.google.firebase.messaging.FirebaseMessaging;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.NumberFormat;
import java.text.SimpleDateFormat;
import java.util.Date;
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
    private static final String[] TIMEFRAMES = {"m15", "daily", "weekly", "monthly"};
    private static final String[] TIMEFRAME_LABELS = {"15 Min", "1 Tag", "Woche", "Monat"};

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private JSONObject liveQuotes = new JSONObject();
    private JSONArray personalAlerts = new JSONArray();
    private LinearLayout personalAlertsBox;
    private boolean foreground;
    private boolean liveAvailable;
    private String alarmSymbol = "BTCUSDT";
    private final Runnable liveRefresh = new Runnable() {
        @Override public void run() {
            if (!foreground) return;
            JSONObject result = LocalAlarmService.snapshot();
            liveAvailable = result.optBoolean("connected");
            JSONObject next = new JSONObject();
            JSONArray values = result.optJSONArray("quotes");
            if (values != null) for (int i = 0; i < values.length(); i++) {
                JSONObject value = values.optJSONObject(i);
                if (value != null) try { next.put(value.optString("symbol"), value); } catch (Exception ignored) {}
            }
            liveQuotes = next; updateLiveLabels(root);
            try {
                JSONArray stored = LocalPriceAlarms.items(MainActivity.this);
                if (!stored.toString().equals(personalAlerts.toString())) { personalAlerts = stored; renderPersonalAlerts(); }
            } catch (Exception ignored) {}
            mainHandler.postDelayed(this, 500);
        }
    };
    private final List<JSONObject> markets = new ArrayList<>();
    private FrameLayout root;
    private JSONObject selectedMarket;
    private int timeframeIndex;
    private String activeScreen = "markets";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        root = findViewById(R.id.app_root);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            } else {
                view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                        insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        root.requestApplyInsets();
        MarketMessagingService.createChannels(this);
        FirebaseMessaging.getInstance().unsubscribeFromTopic("market-alerts");
        personalAlerts = LocalPriceAlarms.items(this);
        if (android.os.Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1001);
        }
        String cached = getSharedPreferences(CACHE_NAME, MODE_PRIVATE).getString(CACHE_KEY, "");
        String requestedScreen = getIntent().getStringExtra("screen");
        if (!cached.isEmpty() && parseMarkets(cached)) {
            if ("alarms".equals(requestedScreen)) showAlarms(); else showHome();
        }
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
                connection.setRequestProperty("User-Agent", "KryptoChartsAndroid/3.1");
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
                    if (selectedMarket == null) {
                        if ("signals".equals(activeScreen)) showSignals();
                        else if ("alarms".equals(activeScreen)) showAlarms();
                        else showHome();
                    }
                    else showDetail(selectedMarket, timeframeIndex);
                    Toast.makeText(this, "Marktdaten aktualisiert", Toast.LENGTH_SHORT).show();
                });
            } catch (Exception ignored) {
                mainHandler.post(() -> {
                    if (markets.isEmpty()) showError();
                    else Toast.makeText(this, "Aktualisierung fehlgeschlagen – gespeicherte Daten angezeigt", Toast.LENGTH_LONG).show();
                });
            }
        });
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if ("alarms".equals(intent.getStringExtra("screen"))) showAlarms();
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
        activeScreen = "markets";
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
        refresh.setContentDescription("Marktdaten aktualisieren");
        refresh.setOnClickListener(view -> { refresh.setText("…"); refreshMarkets(); });
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
        root.addView(withNavigation(scroll, "markets"), fullFrame());
    }

    private void showSignals() {
        activeScreen = "signals";
        selectedMarket = null;
        root.removeAllViews();
        LinearLayout page = vertical();
        page.setPadding(dp(20), dp(22), dp(20), dp(24));
        page.addView(text("Kompakte Signale", 30, TEXT, true));
        page.addView(text("Laufende Wellen und alle Fibonacci-Level", 14, MUTED, false));
        boolean any = false;
        for (JSONObject market : markets) {
            JSONArray plans = market.optJSONArray("signalPlans");
            if (plans == null) continue;
            for (int i = 0; i < plans.length(); i++) {
                JSONObject plan = plans.optJSONObject(i);
                if (plan == null) continue;
                any = true;
                LinearLayout.LayoutParams params = matchWrap();
                params.topMargin = dp(14);
                page.addView(createSignalCard(market, plan), params);
            }
        }
        if (!any) {
            TextView empty = text("Noch keine laufenden Signale vorhanden.", 16, MUTED, false);
            empty.setGravity(Gravity.CENTER);
            empty.setPadding(0, dp(48), 0, 0);
            page.addView(empty);
        }
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.addView(page);
        root.addView(withNavigation(scroll, "signals"), fullFrame());
    }

    private View createSignalCard(JSONObject market, JSONObject plan) {
        LinearLayout card = vertical();
        card.setPadding(dp(17), dp(15), dp(17), dp(16));
        card.setBackground(rounded(PANEL, BORDER, 18));
        String symbol = market.optString("symbol").replace("USDT", "");
        String timeframe = timeframeLabel(plan.optString("timeframe"));
        String direction = plan.optString("direction", "wait");
        LinearLayout head = horizontal();
        head.setGravity(Gravity.CENTER_VERTICAL);
        head.addView(text(symbol + " · " + timeframe, 19, TEXT, true), new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        head.addView(pill(directionLabel(direction), directionColor(direction), PANEL_2));
        card.addView(head);
        TextView wave = text("Laufende Welle: " + plan.optString("waveLabel", "unklar"), 15, MUTED, false);
        wave.setPadding(0, dp(8), 0, dp(4));
        card.addView(wave);
        JSONArray levels = plan.optJSONArray("levels");
        if (levels != null) for (int i = 0; i < levels.length(); i++) {
            JSONObject level = levels.optJSONObject(i);
            if (level == null) continue;
            String role = level.optString("role");
            String action = "long_entry".equals(role) ? "LONG-EINSTIEG" : "short_entry".equals(role) ? "SHORT-EINSTIEG" : "ZIEL";
            TextView row = text("Fib " + level.optString("ratio") + " · " + formatPrice(level.optDouble("price")) + " USDT · " + action, 14, AMBER, true);
            row.setPadding(0, dp(5), 0, 0);
            card.addView(row);
        }
        card.setOnClickListener(view -> {
            selectedMarket = market;
            showDetail(market, timeframeIndex(plan.optString("timeframe")));
        });
        return card;
    }

    private void showAlarms() {
        activeScreen = "alarms";
        selectedMarket = null;
        SignalStore.markAllRead(this);
        root.removeAllViews();
        LinearLayout page = vertical();
        page.setPadding(dp(20), dp(22), dp(20), dp(24));
        page.addView(text("Alarme", 30, TEXT, true));
        page.addView(text("Außerhalb der Ruhezeit hörbar – Nicht stören wird respektiert.", 14, MUTED, false));

        page.addView(createPersonalAlarmForm(), matchWrap());

        LinearLayout settings = vertical();
        settings.setPadding(dp(17), dp(15), dp(17), dp(16));
        settings.setBackground(rounded(PANEL, BORDER, 18));
        LinearLayout.LayoutParams settingsParams = matchWrap();
        settingsParams.topMargin = dp(16);
        page.addView(settings, settingsParams);
        settings.addView(text("Ruhezeit", 17, TEXT, true));
        settings.addView(text("In dieser Zeit bleibt der Alarm stumm und erscheint als ungelesene Meldung.", 13, MUTED, false));
        LinearLayout times = horizontal();
        times.setPadding(0, dp(12), 0, 0);
        Button start = timeButton("Von " + NotificationPreferences.format(NotificationPreferences.quietStart(this)));
        Button end = timeButton("Bis " + NotificationPreferences.format(NotificationPreferences.quietEnd(this)));
        start.setOnClickListener(view -> chooseQuietTime(true));
        end.setOnClickListener(view -> chooseQuietTime(false));
        times.addView(start, new LinearLayout.LayoutParams(0, dp(50), 1));
        LinearLayout.LayoutParams endParams = new LinearLayout.LayoutParams(0, dp(50), 1);
        endParams.leftMargin = dp(9);
        times.addView(end, endParams);
        settings.addView(times);

        LinearLayout historyHeader = horizontal();
        historyHeader.setGravity(Gravity.CENTER_VERTICAL);
        historyHeader.setPadding(0, dp(24), 0, dp(5));
        historyHeader.addView(text("Letzte Meldungen", 19, TEXT, true), new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        TextView clear = text("Alle löschen", 13, RED, true);
        clear.setPadding(dp(8), dp(8), 0, dp(8));
        clear.setOnClickListener(view -> { SignalStore.clear(this); showAlarms(); });
        historyHeader.addView(clear);
        page.addView(historyHeader);
        JSONArray history = SignalStore.items(this);
        if (history.length() == 0) {
            TextView empty = text("Noch kein Preislevel erreicht.", 15, MUTED, false);
            empty.setGravity(Gravity.CENTER);
            empty.setPadding(0, dp(30), 0, dp(30));
            page.addView(empty);
        } else for (int i = 0; i < history.length(); i++) {
            JSONObject item = history.optJSONObject(i);
            if (item == null) continue;
            LinearLayout.LayoutParams params = matchWrap();
            params.topMargin = dp(9);
            page.addView(createHistoryCard(item), params);
        }
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.addView(page);
        root.addView(withNavigation(scroll, "alarms"), fullFrame());
    }

    private View createHistoryCard(JSONObject item) {
        LinearLayout card = vertical();
        card.setPadding(dp(15), dp(13), dp(15), dp(13));
        card.setBackground(rounded(PANEL, BORDER, 16));
        String symbol = item.optString("symbol", "Markt").replace("USDT", "");
        String tf = item.optString("timeframe").toUpperCase(Locale.GERMANY);
        String direction = item.optString("direction").toUpperCase(Locale.GERMANY);
        card.addView(text(symbol + " · " + tf + " · " + direction, 17, TEXT, true));
        String body = item.optString("body", item.optString("waveLabel", "Laufende Welle") + " · Fib " + item.optString("ratio") + " bei " + item.optString("price") + " USDT");
        TextView message = text(body, 14, AMBER, false);
        message.setPadding(0, dp(5), 0, dp(4));
        card.addView(message);
        String suffix = item.optBoolean("quiet") ? " · in Ruhezeit stumm gemeldet" : "";
        card.addView(text(new SimpleDateFormat("dd.MM.yyyy · HH:mm", Locale.GERMANY).format(new Date(item.optLong("receivedAt"))) + suffix, 12, MUTED, false));
        return card;
    }

    private void chooseQuietTime(boolean start) {
        int current = start ? NotificationPreferences.quietStart(this) : NotificationPreferences.quietEnd(this);
        new TimePickerDialog(this, (picker, hour, minute) -> {
            NotificationPreferences.store(this).edit().putInt(start ? NotificationPreferences.QUIET_START : NotificationPreferences.QUIET_END, hour * 60 + minute).apply();
            showAlarms();
        }, current / 60, current % 60, true).show();
    }

    private Button timeButton(String label) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextColor(TEXT);
        button.setTextSize(15);
        button.setAllCaps(false);
        button.setBackground(rounded(PANEL_2, BORDER, 12));
        return button;
    }

    private View withNavigation(View content, String active) {
        LinearLayout shell = vertical();
        shell.addView(content, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1));
        LinearLayout nav = horizontal();
        nav.setPadding(dp(8), dp(7), dp(8), dp(8));
        nav.setBackgroundColor(PANEL);
        nav.addView(navItem("Märkte", "markets", active), new LinearLayout.LayoutParams(0, dp(54), 1));
        nav.addView(navItem("Signale", "signals", active), new LinearLayout.LayoutParams(0, dp(54), 1));
        int unread = SignalStore.unreadCount(this);
        nav.addView(navItem("Alarme" + (unread > 0 ? " (" + unread + ")" : ""), "alarms", active), new LinearLayout.LayoutParams(0, dp(54), 1));
        shell.addView(nav);
        return shell;
    }

    private TextView navItem(String label, String target, String active) {
        TextView item = text(label, 13, target.equals(active) ? BLUE : MUTED, true);
        item.setGravity(Gravity.CENTER);
        item.setBackground(rounded(target.equals(active) ? PANEL_2 : PANEL, target.equals(active) ? BLUE : PANEL, 12));
        item.setOnClickListener(view -> { if ("markets".equals(target)) showHome(); else if ("signals".equals(target)) showSignals(); else showAlarms(); });
        return item;
    }

    private View createCoinCard(JSONObject market) {
        LinearLayout card = horizontal();
        card.setGravity(Gravity.CENTER_VERTICAL);
        card.setPadding(dp(18), dp(18), dp(16), dp(18));
        card.setBackground(rounded(PANEL, BORDER, 22));
        String symbol = market.optString("symbol").replace("USDT", "");
        View coin;
        if ("ETH".equals(symbol) || "SOL".equals(symbol)) {
            ImageView logo = new ImageView(this);
            logo.setImageResource("ETH".equals(symbol) ? R.drawable.coin_eth : R.drawable.coin_sol);
            logo.setScaleType(ImageView.ScaleType.FIT_CENTER);
            int padding = dp("ETH".equals(symbol) ? 10 : 11);
            logo.setPadding(padding, padding, padding, padding);
            int background = "ETH".equals(symbol) ? Color.WHITE : Color.BLACK;
            logo.setBackground(rounded(background, BORDER, 26));
            coin = logo;
        } else {
            TextView glyph = text("BTC".equals(symbol) ? "₿" : symbol, 25, TEXT, true);
            glyph.setGravity(Gravity.CENTER);
            glyph.setBackground(rounded(Color.rgb(245, 158, 11), Color.rgb(245, 158, 11), 26));
            coin = glyph;
        }
        coin.setContentDescription(symbol + " Logo");
        card.addView(coin, new LinearLayout.LayoutParams(dp(52), dp(52)));
        LinearLayout info = vertical();
        info.setPadding(dp(14), 0, 0, 0);
        info.addView(text(symbol, 21, TEXT, true));
        info.addView(livePriceLabel(market, 15));
        String direction = market.optString("direction", "wait");
        info.addView(text("wait".equals(direction) ? "Wellenanalyse fehlt" : directionLabel(direction), 12, directionColor(direction), true));
        card.addView(info, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
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
        title.addView(livePriceLabel(market, 14));
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
        LinearLayout zoomBar = horizontal();
        zoomBar.setPadding(dp(14), 0, dp(14), dp(6));
        String[] zoomLabels = {"−", "Ausschnitt", "+"};
        for (int zi = 0; zi < zoomLabels.length; zi++) {
            final int action = zi;
            Button zoom = timeButton(zoomLabels[zi]);
            zoom.setContentDescription(zi == 0 ? "Herauszoomen" : zi == 2 ? "Hineinzoomen" : "Aktuellen Ausschnitt zurücksetzen");
            zoom.setOnClickListener(v -> { if (action == 0) chart.zoom(.75f); else if (action == 2) chart.zoom(1.4f); else chart.resetZoom(); });
            zoomBar.addView(zoom, new LinearLayout.LayoutParams(0, dp(42), 1));
        }
        page.addView(zoomBar);
        GestureDetector detector = new GestureDetector(this, new GestureDetector.SimpleOnGestureListener() {
            @Override public boolean onDown(MotionEvent event) { return true; }
            @Override public boolean onFling(MotionEvent first, MotionEvent second, float velocityX, float velocityY) {
                if (first == null || second == null || Math.abs(second.getX() - first.getX()) < dp(60) || Math.abs(velocityX) < 250) return false;
                int next = timeframeIndex + (second.getX() < first.getX() ? 1 : -1);
                if (next >= 0 && next < TIMEFRAMES.length) showDetail(market, next);
                return true;
            }
        });
        TextView swipeHint = text("Chart: ziehen / mit zwei Fingern zoomen\nZeitebene: hier nach links oder rechts wischen", 12, MUTED, false);
        swipeHint.setOnTouchListener((view, event) -> detector.onTouchEvent(event));
        swipeHint.setGravity(Gravity.CENTER);
        swipeHint.setPadding(0, dp(6), 0, dp(10));
        page.addView(swipeHint);
        Button priceAlarm = timeButton("Preisalarm für " + coin + " anlegen");
        priceAlarm.setOnClickListener(view -> { alarmSymbol = market.optString("symbol", "BTCUSDT"); showAlarms(); });
        page.addView(priceAlarm, matchWrap());
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
            JSONObject active = "daily".equals(TIMEFRAMES[timeframeIndex]) ? market.optJSONObject("activeCase") : null;
            wave = active == null ? "Welle unklar" : active.optString("waveLabel", "Welle unklar");
            direction = active == null ? "wait" : market.optString("direction", "wait");
            levels = active == null ? null : active.optJSONArray("fibonacciLevels");
            invalidation = active == null ? null : market.optJSONObject("invalidation");
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
        if (invalidation != null && ChartData.positive(invalidation.optDouble("price"))) {
            String relation = invalidation.optString("relation").equals("below") ? "Unter " : "Über ";
            TextView invalid = text("Invalidierung: " + relation + formatPrice(invalidation.optDouble("price")) + " USDT", 14, RED, true);
            invalid.setPadding(0, dp(18), 0, 0);
            card.addView(invalid);
        }
        String note = plan == null ? "Für diese Zeitebene liegt keine Wellenanalyse vor." : plan.optString("note");
        if ("wait".equals(direction)) {
            waveView.setText("Keine geprüfte Wellenzählung verfügbar");
            note = "Der Analysedienst liefert für diese Zeitebene derzeit keine belegte Richtung und keine gezählten Wellen. Deshalb sind kein Kursziel und keine Invalidierung angegeben.";
            if (plan != null && "pending".equals(plan.optString("status")))
                note = "Das Szenario ist noch nicht bestätigt. " + plan.optString("note");
        }
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
        JSONArray m15 = candles == null ? null : candles.optJSONArray("m15");
        return m15 != null && m15.length() > 1 ? 0 : 1;
    }

    private int timeframeIndex(String timeframe) {
        for (int i = 0; i < TIMEFRAMES.length; i++) if (TIMEFRAMES[i].equals(timeframe)) return i;
        return 1;
    }

    private String timeframeLabel(String timeframe) {
        int index = timeframeIndex(timeframe);
        return TIMEFRAME_LABELS[index];
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

    private static String directionLabel(String direction) { return "long".equals(direction) ? "AUFWÄRTS" : "short".equals(direction) ? "ABWÄRTS" : "UNGEKLÄRT"; }
    private static int directionColor(String direction) { return "long".equals(direction) ? GREEN : "short".equals(direction) ? RED : AMBER; }
    static String formatPrice(double value) {
        if (!Double.isFinite(value)) return "—";
        NumberFormat format = NumberFormat.getNumberInstance(Locale.GERMANY);
        format.setMinimumFractionDigits(value < 1000 ? 2 : 0); format.setMaximumFractionDigits(value < 1000 ? 2 : 0);
        return format.format(value);
    }

    private TextView livePriceLabel(JSONObject market, int size) {
        TextView label = text("Analyse: " + formatPrice(market.optDouble("currentPrice")) + " USDT", size, MUTED, false);
        label.setTag("live:" + market.optString("symbol"));
        updateLiveLabels(label);
        return label;
    }

    private void updateLiveLabels(View view) {
        Object tag = view.getTag();
        if (view instanceof TextView && tag instanceof String && ((String) tag).startsWith("live:")) {
            JSONObject quote = liveQuotes.optJSONObject(((String) tag).substring(5));
            if (quote != null) {
                TextView label = (TextView) view;
                long tradedAt = 0;
                try { tradedAt = java.time.Instant.parse(quote.optString("tradedAt")).toEpochMilli(); } catch (Exception ignored) {}
                long age = System.currentTimeMillis() - tradedAt;
                boolean fresh = liveAvailable && age >= -2000 && age <= 15000;
                NumberFormat format = NumberFormat.getNumberInstance(Locale.GERMANY);
                format.setMinimumFractionDigits(2); format.setMaximumFractionDigits(2);
                label.setText(format.format(quote.optDouble("price")) + " USDT · " + (fresh ? "Live" : "Letzter Kurs") + "\n"
                        + new SimpleDateFormat("HH:mm:ss", Locale.GERMANY).format(new Date(tradedAt))
                        + (liveAvailable ? "" : " · Verbindung unterbrochen"));
                label.setTextColor(fresh ? GREEN : AMBER);
            }
        }
        if (view instanceof ViewGroup) for (int i = 0; i < ((ViewGroup) view).getChildCount(); i++) updateLiveLabels(((ViewGroup) view).getChildAt(i));
    }

    private View createPersonalAlarmForm() {
        LinearLayout box = vertical();
        box.setPadding(dp(16), dp(18), dp(16), dp(18));
        box.setBackground(rounded(PANEL, BORDER, 18));
        box.addView(text("Eigenen Preisalarm anlegen", 19, TEXT, true));
        box.addView(text("Auf diesem Gerät gespeichert und mit Live-Kursen verglichen. Die laufende Überwachung erscheint als Android-Benachrichtigung.", 13, MUTED, false));
        Spinner coin = alarmSpinner(new String[]{"BTC / USDT", "ETH / USDT", "SOL / USDT"});
        coin.setSelection("ETHUSDT".equals(alarmSymbol) ? 1 : "SOLUSDT".equals(alarmSymbol) ? 2 : 0);
        coin.setContentDescription("Coin für Preisalarm");
        box.addView(coin, new LinearLayout.LayoutParams(-1, dp(52)));
        TextView live = text("Live-Kurs wird geladen…", 15, GREEN, true);
        live.setTag("live:" + alarmSymbol);
        updateLiveLabels(live);
        box.addView(live, matchWrap());
        coin.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener() {
            @Override public void onItemSelected(android.widget.AdapterView<?> parent, View view, int position, long id) {
                alarmSymbol = new String[]{"BTCUSDT", "ETHUSDT", "SOLUSDT"}[position];
                live.setTag("live:" + alarmSymbol); live.setText("Live-Kurs wird geladen…"); updateLiveLabels(live);
            }
            @Override public void onNothingSelected(android.widget.AdapterView<?> parent) {}
        });
        Spinner crossing = alarmSpinner(new String[]{"Kurs erreicht oder übersteigt", "Kurs erreicht oder unterschreitet"});
        crossing.setContentDescription("Alarmrichtung");
        box.addView(crossing, new LinearLayout.LayoutParams(-1, dp(52)));
        EditText amount = new EditText(this);
        amount.setTextColor(TEXT); amount.setHintTextColor(MUTED);
        amount.setHint("Alarmkurs in USDT, z. B. 80000,00");
        amount.setContentDescription("Alarmkurs in USDT");
        amount.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_FLAG_DECIMAL);
        amount.setSingleLine(true);
        box.addView(amount, new LinearLayout.LayoutParams(-1, dp(56)));
        Button save = timeButton("Alarm speichern");
        save.setOnClickListener(view -> {
            double value = LocalAlarmRules.parsePrice(amount.getText().toString());
            if (!Double.isFinite(value)) { amount.setError("Positiven Kurs ohne Tausendertrennzeichen eingeben"); return; }
            if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1001);
                return;
            }
            final String symbol = new String[]{"BTCUSDT", "ETHUSDT", "SOLUSDT"}[coin.getSelectedItemPosition()];
            final String relation = crossing.getSelectedItemPosition() == 0 ? "above" : "below";
            try {
                LocalPriceAlarms.add(this, symbol, relation, value);
                personalAlerts = LocalPriceAlarms.items(this); amount.setText(""); renderPersonalAlerts();
                LocalAlarmService.openUi(this);
                Toast.makeText(this, "Preisalarm auf diesem Gerät gespeichert", Toast.LENGTH_SHORT).show();
            } catch (Exception error) { Toast.makeText(this, error.getMessage(), Toast.LENGTH_LONG).show(); }
        });
        box.addView(save, new LinearLayout.LayoutParams(-1, dp(50)));
        box.addView(text("Ist die Bedingung schon erfüllt, kann der nächste Live-Kurs sofort auslösen.", 12, AMBER, false));
        personalAlertsBox = vertical();
        box.addView(personalAlertsBox, matchWrap());
        renderPersonalAlerts();
        return box;
    }

    private Spinner alarmSpinner(String[] values) {
        Spinner spinner = new Spinner(this);
        ArrayAdapter<String> adapter = new ArrayAdapter<String>(this, android.R.layout.simple_spinner_item, values) {
            @Override public View getView(int position, View convertView, ViewGroup parent) {
                TextView view = (TextView) super.getView(position, convertView, parent); view.setTextColor(TEXT); view.setTextSize(15); return view;
            }
            @Override public View getDropDownView(int position, View convertView, ViewGroup parent) {
                TextView view = (TextView) super.getDropDownView(position, convertView, parent); view.setTextColor(TEXT); view.setBackgroundColor(PANEL_2); view.setPadding(dp(12), dp(14), dp(12), dp(14)); return view;
            }
        };
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item); spinner.setAdapter(adapter); return spinner;
    }

    private void renderPersonalAlerts() {
        if (personalAlertsBox == null || !"alarms".equals(activeScreen)) return;
        personalAlertsBox.removeAllViews();
        for (int i = 0; i < personalAlerts.length(); i++) {
            JSONObject item = personalAlerts.optJSONObject(i);
            if (item == null || "cancelled".equals(item.optString("status"))) continue;
            LinearLayout row = horizontal(); row.setGravity(Gravity.CENTER_VERTICAL);
            String status = "triggered".equals(item.optString("status")) ? "Ausgelöst" : "Aktiv";
            row.addView(text(item.optString("symbol").replace("USDT", "") + " · " + ("above".equals(item.optString("crossing")) ? "Ab " : "Bis ")
                    + formatAlarmPrice(item.optDouble("price")) + " USDT\n" + status, 14, TEXT, false), new LinearLayout.LayoutParams(0, -2, 1));
            if ("active".equals(item.optString("status"))) {
                Button cancel = timeButton("Deaktivieren");
                cancel.setOnClickListener(view -> {
                    try {
                        LocalPriceAlarms.cancel(this, item.getString("id")); personalAlerts = LocalPriceAlarms.items(this); renderPersonalAlerts();
                    } catch (Exception error) { Toast.makeText(this, error.getMessage(), Toast.LENGTH_LONG).show(); }
                });
                row.addView(cancel);
            }
            personalAlertsBox.addView(row, matchWrap());
        }
    }

    @Override protected void onStart() { super.onStart(); foreground = true; LocalAlarmService.openUi(this); mainHandler.post(liveRefresh); }
    @Override protected void onStop() { foreground = false; mainHandler.removeCallbacks(liveRefresh); LocalAlarmService.closeUi(); super.onStop(); }

    private String formatAlarmPrice(double value) {
        NumberFormat format = NumberFormat.getNumberInstance(Locale.GERMANY);
        format.setMinimumFractionDigits(2); format.setMaximumFractionDigits(8);
        return format.format(value);
    }

    @Override public void onBackPressed() {
        if (selectedMarket != null || !"markets".equals(activeScreen)) showHome(); else super.onBackPressed();
    }
    @Override protected void onDestroy() { mainHandler.removeCallbacks(liveRefresh); executor.shutdownNow(); super.onDestroy(); }
}
