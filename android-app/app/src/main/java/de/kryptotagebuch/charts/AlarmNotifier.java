package de.kryptotagebuch.charts;

import android.app.*;
import android.content.*;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.provider.Settings;
import java.util.Map;

final class AlarmNotifier {
    static final String ALARM = "market_alarm_v1", QUIET = "market_quiet_v1";
    private AlarmNotifier() {}
    static void channels(Context context) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        NotificationChannel alarm = new NotificationChannel(ALARM, "Preisalarme", NotificationManager.IMPORTANCE_HIGH);
        alarm.setSound(Settings.System.DEFAULT_ALARM_ALERT_URI, new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build());
        alarm.enableVibration(true); alarm.setVibrationPattern(new long[]{0,500,250,500,250,900});
        manager.createNotificationChannel(alarm);
        NotificationChannel quiet = new NotificationChannel(QUIET, "Stille Nachtmeldungen", NotificationManager.IMPORTANCE_DEFAULT);
        quiet.setSound(null, null); quiet.enableVibration(false); manager.createNotificationChannel(quiet);
    }
    static boolean show(Context context, Map<String,String> data, boolean quiet) {
        if (android.os.Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) return false;
        channels(context);
        String title = data.getOrDefault("title", "Preisalarm"), body = data.getOrDefault("body", "");
        int id = data.getOrDefault("eventId", title + body).hashCode() & 0x7fffffff;
        Intent open = quiet ? new Intent(context, MainActivity.class).putExtra("screen", "alarms")
                : new Intent(context, AlarmActivity.class).putExtra("title", title).putExtra("body", body);
        open.putExtra("notificationId", id);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pending = PendingIntent.getActivity(context, id, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder notification = new Notification.Builder(context, quiet ? QUIET : ALARM).setSmallIcon(R.drawable.notification_icon)
                .setContentTitle(title).setContentText(body).setStyle(new Notification.BigTextStyle().bigText(body))
                .setContentIntent(pending).setAutoCancel(quiet).setCategory(quiet ? Notification.CATEGORY_MESSAGE : Notification.CATEGORY_ALARM)
                .setVisibility(Notification.VISIBILITY_PUBLIC).setColor(Color.rgb(56,189,248)).setOnlyAlertOnce(true);
        if (!quiet) notification.setOngoing(true).setFullScreenIntent(pending, true);
        context.getSystemService(NotificationManager.class).notify(id, notification.build());
        return true;
    }
}
