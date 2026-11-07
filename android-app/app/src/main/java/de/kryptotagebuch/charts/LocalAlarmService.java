package de.kryptotagebuch.charts;

import android.app.*;
import android.content.*;
import android.content.pm.ServiceInfo;
import android.os.*;
import org.json.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import okhttp3.*;

public final class LocalAlarmService extends Service {
    static final String STREAM = "wss://data-stream.binance.vision/stream?streams=btcusdt@aggTrade/ethusdt@aggTrade/solusdt@aggTrade";
    private static final String CHANNEL = "local_price_monitor_v1";
    private static final int NOTIFICATION = 41001;
    private static final Map<String, JSONObject> QUOTES = new HashMap<>();
    private static volatile boolean uiVisible;
    private static volatile String status = "Überwachung ist nicht verbunden";
    private static volatile LocalAlarmService instance;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Map<String, Long> sequences = new ConcurrentHashMap<>();
    private final OkHttpClient client = new OkHttpClient.Builder().pingInterval(20, TimeUnit.SECONDS)
            .connectTimeout(10, TimeUnit.SECONDS).readTimeout(0, TimeUnit.SECONDS).build();
    private volatile WebSocket socket;
    private volatile boolean destroyed;
    private int retrySeconds = 1;
    private volatile long lastReceived;
    private PowerManager.WakeLock wakeLock;
    private String lastNotification = "";

    static void openUi(Context context) {
        uiVisible = true;
        context.startForegroundService(new Intent(context, LocalAlarmService.class));
    }
    static void closeUi() {
        uiVisible = false;
        LocalAlarmService value = instance;
        if (value != null) value.handler.post(value::checkIdle);
    }
    static synchronized JSONObject snapshot() {
        JSONObject result = new JSONObject();
        try {
            JSONArray values = new JSONArray();
            synchronized (QUOTES) { for (JSONObject quote : QUOTES.values()) values.put(new JSONObject(quote.toString())); }
            result.put("quotes", values).put("connected", "Live verbunden".equals(status)).put("status", status);
        } catch (Exception ignored) {}
        return result;
    }

    @Override public void onCreate() {
        super.onCreate(); instance = this;
        NotificationChannel channel = new NotificationChannel(CHANNEL, "Lokale Kursüberwachung", NotificationManager.IMPORTANCE_LOW);
        channel.setSound(null, null); getSystemService(NotificationManager.class).createNotificationChannel(channel);
        Notification notification = monitoringNotification("Live-Kurse werden verbunden");
        if (Build.VERSION.SDK_INT >= 34) startForeground(NOTIFICATION, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        else startForeground(NOTIFICATION, notification);
        wakeLock = getSystemService(PowerManager.class).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "KryptoCharts:LocalPriceAlarms");
        connect(); handler.post(heartbeat);
    }
    @Override public int onStartCommand(Intent intent, int flags, int startId) { checkIdle(); return START_STICKY; }
    @Override public IBinder onBind(Intent intent) { return null; }

    private void connect() {
        if (destroyed) return;
        lastReceived = 0;
        status = "Live-Verbindung wird aufgebaut";
        socket = client.newWebSocket(new Request.Builder().url(STREAM).build(), new WebSocketListener() {
            @Override public void onOpen(WebSocket value, Response response) {
                if (value != socket) return;
                lastReceived = SystemClock.elapsedRealtime(); retrySeconds = 1;
            }
            @Override public void onMessage(WebSocket value, String text) {
                if (value != socket || destroyed) return;
                try {
                    JSONObject wrapper = new JSONObject(text);
                    JSONObject tick = wrapper.optJSONObject("data"); if (tick == null) tick = wrapper;
                    if ("serverShutdown".equals(tick.optString("e"))) { reconnect(value); return; }
                    if (!"aggTrade".equals(tick.optString("e"))) return;
                    String symbol = tick.getString("s"); double price = Double.parseDouble(tick.getString("p"));
                    long tradedAt = tick.getLong("T"), sequence = tick.getLong("a"), now = System.currentTimeMillis();
                    if (!LocalAlarmRules.supported(symbol) || !Double.isFinite(price) || price <= 0 || now - tradedAt > 15000 || tradedAt > now + 2000) return;
                    if (sequence <= sequences.getOrDefault(symbol, -1L)) return;
                    sequences.put(symbol, sequence); lastReceived = SystemClock.elapsedRealtime(); status = "Live verbunden";
                    JSONObject quote = new JSONObject().put("symbol", symbol).put("price", price)
                            .put("tradedAt", Instant.ofEpochMilli(tradedAt).toString()).put("receivedAt", Instant.ofEpochMilli(now).toString());
                    synchronized (QUOTES) { QUOTES.put(symbol, quote); }
                    LocalPriceAlarms.evaluate(LocalAlarmService.this, symbol, price, tradedAt, now);
                    deliverPending();
                } catch (Exception error) { status = "Lokaler Alarm konnte nicht verarbeitet werden"; }
            }
            @Override public void onClosing(WebSocket value, int code, String reason) { reconnect(value); }
            @Override public void onClosed(WebSocket value, int code, String reason) { reconnect(value); }
            @Override public void onFailure(WebSocket value, Throwable error, Response response) { reconnect(value); }
        });
    }
    private void reconnect(WebSocket value) {
        handler.post(() -> {
            if (destroyed || socket != value) return;
            socket = null; value.cancel(); status = "Keine Live-Verbindung · Neuer Versuch folgt";
            handler.postDelayed(this::connect, retrySeconds * 1000L); retrySeconds = Math.min(30, retrySeconds * 2);
        });
    }
    private synchronized void deliverPending() throws Exception {
        JSONArray values = LocalPriceAlarms.items(this);
        for (int i = 0; i < values.length(); i++) {
            JSONObject alarm = values.getJSONObject(i);
            if (!"triggered".equals(alarm.optString("status")) || alarm.optBoolean("notified")) continue;
            String identity = "local:" + alarm.getString("id");
            if (!SignalStore.hasEvent(this, identity)) {
                Map<String, String> data = new HashMap<>();
                data.put("eventId", identity); data.put("kind", "local_price"); data.put("symbol", alarm.getString("symbol"));
                data.put("direction", alarm.getString("crossing")); data.put("price", String.valueOf(alarm.getDouble("price")));
                data.put("title", alarm.getString("symbol").replace("USDT", "") + " · PREISALARM");
                data.put("body", alarm.getDouble("price") + " USDT " + ("above".equals(alarm.getString("crossing")) ? "erreicht oder überschritten" : "erreicht oder unterschritten")
                        + ". Live-Kurs: " + alarm.getDouble("triggeredPrice") + " USDT.");
                data.put("sentAt", String.valueOf(alarm.getLong("triggeredAt")));
                boolean quiet = NotificationPreferences.isQuietNow(this) || System.currentTimeMillis() - alarm.getLong("triggeredAt") > 600000;
                if (!AlarmNotifier.show(this, data, quiet)) continue;
                SignalStore.add(this, data, quiet);
            }
            LocalPriceAlarms.markNotified(this, alarm.getString("id"));
        }
    }
    private final Runnable heartbeat = new Runnable() {
        @Override public void run() {
            if (destroyed) return;
            try {
                deliverPending();
                boolean needed = LocalPriceAlarms.needsMonitoring(LocalAlarmService.this);
                if (needed && !wakeLock.isHeld()) wakeLock.acquire(10 * 60 * 1000L);
                if (!needed && wakeLock.isHeld()) wakeLock.release();
                if (socket != null && lastReceived > 0 && SystemClock.elapsedRealtime() - lastReceived > 30000) reconnect(socket);
                int count = 0; JSONArray alarms = LocalPriceAlarms.items(LocalAlarmService.this);
                for (int i = 0; i < alarms.length(); i++) if ("active".equals(alarms.getJSONObject(i).optString("status"))) count++;
                String text = count + " lokale Alarme · " + status;
                if (!text.equals(lastNotification)) { getSystemService(NotificationManager.class).notify(NOTIFICATION, monitoringNotification(text)); lastNotification = text; }
                checkIdle();
            } catch (Exception error) { status = "Lokale Überwachung benötigt Aufmerksamkeit"; }
            handler.postDelayed(this, 2000);
        }
    };
    private Notification monitoringNotification(String text) {
        PendingIntent open = PendingIntent.getActivity(this, 41001, new Intent(this, MainActivity.class).putExtra("screen", "alarms"), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new Notification.Builder(this, CHANNEL).setSmallIcon(R.drawable.notification_icon).setContentTitle("Lokale Preisalarme")
                .setContentText(text).setContentIntent(open).setOngoing(true).setOnlyAlertOnce(true).build();
    }
    private void checkIdle() { if (!uiVisible && !LocalPriceAlarms.needsMonitoring(this)) stopSelf(); }
    @Override public void onDestroy() {
        destroyed = true; handler.removeCallbacksAndMessages(null); instance = null; status = "Überwachung ist nicht verbunden";
        WebSocket value = socket; socket = null; if (value != null) value.cancel();
        client.dispatcher().executorService().shutdown(); client.connectionPool().evictAll();
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        super.onDestroy();
    }
}
