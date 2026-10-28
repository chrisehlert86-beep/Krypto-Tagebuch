package de.kryptotagebuch.charts;

import android.content.Context;
import android.content.SharedPreferences;

import java.time.LocalTime;

final class NotificationPreferences {
    static final String STORE = "notification_preferences";
    static final String QUIET_START = "quiet_start";
    static final String QUIET_END = "quiet_end";
    static final int DEFAULT_START = 21 * 60;
    static final int DEFAULT_END = 7 * 60;

    private NotificationPreferences() {}

    static SharedPreferences store(Context context) {
        return context.getSharedPreferences(STORE, Context.MODE_PRIVATE);
    }

    static int quietStart(Context context) {
        return store(context).getInt(QUIET_START, DEFAULT_START);
    }

    static int quietEnd(Context context) {
        return store(context).getInt(QUIET_END, DEFAULT_END);
    }

    static boolean isQuietNow(Context context) {
        int now = LocalTime.now().getHour() * 60 + LocalTime.now().getMinute();
        int start = quietStart(context);
        int end = quietEnd(context);
        if (start == end) return false;
        return start < end ? now >= start && now < end : now >= start || now < end;
    }

    static String format(int minutes) {
        return String.format(java.util.Locale.GERMANY, "%02d:%02d", minutes / 60, minutes % 60);
    }
}
