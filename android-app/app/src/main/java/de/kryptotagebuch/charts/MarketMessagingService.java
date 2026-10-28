package de.kryptotagebuch.charts;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.net.Uri;
import android.provider.Settings;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

public final class MarketMessagingService extends FirebaseMessagingService {
    static final String CHANNEL_ALARM = "market_alarm_v1";
    static final String CHANNEL_QUIET = "market_quiet_v1";

    @Override public void onCreate() {
        super.onCreate();
        createChannels(this);
    }

    @Override public void onMessageReceived(RemoteMessage message) {
        Map<String, String> data = message.getData();
        if (data.isEmpty()) return;
        boolean quiet = NotificationPreferences.isQuietNow(this);
        SignalStore.add(this, data, quiet);
        showNotification(data, quiet);
    }

    private void showNotification(Map<String, String> data, boolean quiet) {
        String symbol = clean(data.get("symbol"), "Markt");
        String timeframe = timeframeLabel(clean(data.get("timeframe"), ""));
        String wave = clean(data.get("waveLabel"), "Laufende Welle");
        String ratio = clean(data.get("ratio"), "");
        String price = clean(data.get("price"), "");
        String direction = clean(data.get("direction"), "").toUpperCase();
        String title = symbol.replace("USDT", "") + (timeframe.isEmpty() ? "" : " · " + timeframe) + " · " + direction;
        String body = wave + (ratio.isEmpty() ? "" : " · Fib " + ratio) + (price.isEmpty() ? "" : " bei " + price + " USDT");

        Intent open = quiet ? new Intent(this, MainActivity.class).putExtra("screen", "alarms")
                : new Intent(this, AlarmActivity.class).putExtra("title", title).putExtra("body", body);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int id = (int) (System.currentTimeMillis() & 0x7fffffff);
        PendingIntent pending = PendingIntent.getActivity(this, id, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification.Builder builder = new Notification.Builder(this, quiet ? CHANNEL_QUIET : CHANNEL_ALARM)
                .setSmallIcon(R.drawable.notification_icon)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new Notification.BigTextStyle().bigText(body))
                .setContentIntent(pending)
                .setAutoCancel(quiet)
                .setCategory(quiet ? Notification.CATEGORY_MESSAGE : Notification.CATEGORY_ALARM)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setColor(Color.rgb(56, 189, 248));
        if (!quiet) {
            builder.setOngoing(true).setFullScreenIntent(pending, true).setPriority(Notification.PRIORITY_MAX);
        }
        ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).notify(id, builder.build());
    }

    static void createChannels(Context context) {
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        Uri alarmSound = Settings.System.DEFAULT_ALARM_ALERT_URI;
        AudioAttributes alarmAttributes = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build();
        NotificationChannel alarm = new NotificationChannel(CHANNEL_ALARM, "Preisalarme", NotificationManager.IMPORTANCE_HIGH);
        alarm.setDescription("Hörbare Fibonacci-Preisalarme außerhalb der Ruhezeit");
        alarm.setSound(alarmSound, alarmAttributes);
        alarm.enableVibration(true);
        alarm.setVibrationPattern(new long[]{0, 500, 250, 500, 250, 900});
        alarm.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        manager.createNotificationChannel(alarm);

        NotificationChannel quiet = new NotificationChannel(CHANNEL_QUIET, "Stille Nachtmeldungen", NotificationManager.IMPORTANCE_DEFAULT);
        quiet.setDescription("Stille Meldungen innerhalb der eingestellten Ruhezeit");
        quiet.setSound(null, null);
        quiet.enableVibration(false);
        quiet.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        manager.createNotificationChannel(quiet);
    }

    private static String clean(String value, String fallback) { return value == null || value.isBlank() ? fallback : value; }
    private static String timeframeLabel(String value) {
        if ("m30".equalsIgnoreCase(value)) return "30M";
        if ("daily".equalsIgnoreCase(value)) return "1D";
        if ("weekly".equalsIgnoreCase(value)) return "1W";
        if ("monthly".equalsIgnoreCase(value)) return "1M";
        return value.toUpperCase(java.util.Locale.GERMANY);
    }
}
