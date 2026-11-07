package de.kryptotagebuch.charts;

import org.json.JSONArray;
import org.json.JSONObject;

final class LocalAlarmRules {
    private LocalAlarmRules() {}
    static boolean supported(String symbol) { return "BTCUSDT".equals(symbol) || "ETHUSDT".equals(symbol) || "SOLUSDT".equals(symbol); }
    static double parsePrice(String text) {
        String value = text.trim().replaceAll("\\s", "");
        if (!value.matches("[0-9]+([.,][0-9]{1,8})?")) return Double.NaN;
        try { double number = Double.parseDouble(value.replace(',', '.')); return Double.isFinite(number) && number > 0 && number < 1e12 ? number : Double.NaN; }
        catch (NumberFormatException error) { return Double.NaN; }
    }

    static boolean evaluate(JSONArray alarms, String symbol, double price, long tradedAt, long now) throws Exception {
        if (!supported(symbol) || !Double.isFinite(price) || price <= 0 || now - tradedAt > 15000 || tradedAt > now + 2000) return false;
        boolean changed = false;
        for (int i = 0; i < alarms.length(); i++) {
            JSONObject alarm = alarms.optJSONObject(i);
            if (alarm == null || !"active".equals(alarm.optString("status")) || !symbol.equals(alarm.optString("symbol"))
                    || tradedAt <= alarm.optLong("createdAt")) continue;
            String direction = alarm.optString("crossing");
            double target = alarm.optDouble("price", Double.NaN);
            if (!Double.isFinite(target) || target <= 0) continue;
            boolean matches = "above".equals(direction) ? price >= target : "below".equals(direction) && price <= target;
            if (matches) {
                alarm.put("status", "triggered").put("triggeredAt", tradedAt).put("triggeredPrice", price).put("notified", false);
                changed = true;
            }
        }
        return changed;
    }
}
