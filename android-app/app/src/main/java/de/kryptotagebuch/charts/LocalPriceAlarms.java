package de.kryptotagebuch.charts;

import android.content.Context;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.UUID;

final class LocalPriceAlarms {
    private static final String STORE = "local_price_alarms_v1";
    private LocalPriceAlarms() {}
    static synchronized JSONArray items(Context context) {
        try { return new JSONArray(context.getSharedPreferences(STORE, 0).getString("items", "[]")); }
        catch (Exception error) { throw new IllegalStateException("Lokale Alarme konnten nicht gelesen werden.", error); }
    }
    private static void save(Context context, JSONArray values) {
        if (!context.getSharedPreferences(STORE, 0).edit().putString("items", values.toString()).commit())
            throw new IllegalStateException("Alarm konnte auf diesem Gerät nicht gespeichert werden.");
    }
    static synchronized void add(Context context, String symbol, String crossing, double price) throws Exception {
        if (!LocalAlarmRules.supported(symbol) || !("above".equals(crossing) || "below".equals(crossing))
                || !Double.isFinite(price) || price <= 0 || price >= 1e12) throw new IllegalArgumentException("Ungültiger Alarm.");
        JSONArray values = items(context);
        int active = 0;
        for (int i = 0; i < values.length(); i++) if ("active".equals(values.getJSONObject(i).optString("status"))) active++;
        if (active >= 20) throw new IllegalStateException("Maximal 20 aktive Alarme auf diesem Gerät.");
        JSONArray next = new JSONArray().put(new JSONObject().put("id", UUID.randomUUID().toString()).put("symbol", symbol)
                .put("crossing", crossing).put("price", price).put("status", "active").put("createdAt", System.currentTimeMillis()));
        int history = 0;
        for (int i = 0; i < values.length(); i++) {
            JSONObject item = values.getJSONObject(i);
            if ("active".equals(item.optString("status")) || ("triggered".equals(item.optString("status")) && !item.optBoolean("notified")) || history++ < 100) next.put(item);
        }
        save(context, next);
    }
    static synchronized void cancel(Context context, String identity) throws Exception {
        JSONArray values = items(context);
        for (int i = 0; i < values.length(); i++) {
            JSONObject item = values.getJSONObject(i);
            if (identity.equals(item.optString("id")) && "active".equals(item.optString("status"))) item.put("status", "cancelled");
        }
        save(context, values);
    }
    static synchronized void evaluate(Context context, String symbol, double price, long tradedAt, long now) throws Exception {
        JSONArray values = items(context);
        if (LocalAlarmRules.evaluate(values, symbol, price, tradedAt, now)) save(context, values);
    }
    static synchronized void markNotified(Context context, String identity) throws Exception {
        JSONArray values = items(context);
        for (int i = 0; i < values.length(); i++) if (identity.equals(values.getJSONObject(i).optString("id"))) values.getJSONObject(i).put("notified", true);
        save(context, values);
    }
    static boolean needsMonitoring(Context context) {
        JSONArray values = items(context);
        for (int i = 0; i < values.length(); i++) {
            JSONObject item = values.optJSONObject(i);
            if (item != null && ("active".equals(item.optString("status")) || ("triggered".equals(item.optString("status")) && !item.optBoolean("notified")))) return true;
        }
        return false;
    }
}
