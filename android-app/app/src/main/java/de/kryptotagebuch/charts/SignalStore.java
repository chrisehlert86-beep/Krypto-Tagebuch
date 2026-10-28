package de.kryptotagebuch.charts;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Map;

final class SignalStore {
    private static final String STORE = "signal_history";
    private static final String KEY = "items";
    private static final int LIMIT = 100;

    private SignalStore() {}

    static synchronized void add(Context context, Map<String, String> data, boolean quiet) {
        try {
            JSONArray oldItems = items(context);
            JSONArray next = new JSONArray();
            JSONObject item = new JSONObject();
            for (Map.Entry<String, String> entry : data.entrySet()) item.put(entry.getKey(), entry.getValue());
            item.put("receivedAt", System.currentTimeMillis());
            item.put("quiet", quiet);
            item.put("unread", true);
            next.put(item);
            for (int i = 0; i < oldItems.length() && next.length() < LIMIT; i++) next.put(oldItems.get(i));
            save(context, next);
        } catch (Exception ignored) {}
    }

    static JSONArray items(Context context) {
        try {
            return new JSONArray(context.getSharedPreferences(STORE, Context.MODE_PRIVATE).getString(KEY, "[]"));
        } catch (Exception ignored) {
            return new JSONArray();
        }
    }

    static int unreadCount(Context context) {
        JSONArray items = items(context);
        int count = 0;
        for (int i = 0; i < items.length(); i++) if (items.optJSONObject(i) != null && items.optJSONObject(i).optBoolean("unread")) count++;
        return count;
    }

    static void markAllRead(Context context) {
        JSONArray items = items(context);
        for (int i = 0; i < items.length(); i++) {
            JSONObject item = items.optJSONObject(i);
            if (item != null) try { item.put("unread", false); } catch (Exception ignored) {}
        }
        save(context, items);
    }

    static void clear(Context context) {
        save(context, new JSONArray());
    }

    private static void save(Context context, JSONArray items) {
        context.getSharedPreferences(STORE, Context.MODE_PRIVATE).edit().putString(KEY, items.toString()).apply();
    }
}
