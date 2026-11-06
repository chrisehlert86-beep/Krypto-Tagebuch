package de.kryptotagebuch.charts;

import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

/** Missing analysis never becomes a zero-price anchor. */
final class ChartData {
    final List<JSONObject> candles = new ArrayList<>();
    final List<JSONObject> points = new ArrayList<>();
    final List<JSONObject> levels = new ArrayList<>();
    double invalidation = Double.NaN;
    static boolean positive(double value) { return Double.isFinite(value) && value > 0; }
    static long time(JSONObject row) {
        long value = row.optLong("time");
        return value > 0 && value < 100_000_000_000L ? value * 1000 : value;
    }
    ChartData(JSONObject market, String frame, JSONObject plan) {
        JSONObject sets = market.optJSONObject("candles");
        JSONArray rows = sets == null ? null : sets.optJSONArray(frame);
        if (rows != null) for (int i = 0; i < rows.length(); i++) {
            JSONObject row = rows.optJSONObject(i);
            if (row == null) continue;
            double low = row.optDouble("low"), high = row.optDouble("high");
            double open = row.optDouble("open"), close = row.optDouble("close");
            if (positive(low) && positive(high) && positive(open) && positive(close)
                    && high >= Math.max(open, close) && low <= Math.min(open, close) && time(row) > 0) candles.add(row);
        }
        candles.sort((a, b) -> Long.compare(time(a), time(b)));
        JSONObject source = plan;
        if (source == null && "daily".equals(frame)) source = market.optJSONObject("activeCase");
        if (source == null) return;
        JSONArray waves = source.optJSONArray("wavePoints");
        // Older daily payloads carry their verified anchors on activeCase only.
        if (waves == null && plan != null && "daily".equals(frame) && "active".equals(plan.optString("status"))) {
            JSONObject active = market.optJSONObject("activeCase");
            if (active != null && source.optString("waveLabel").equals(active.optString("waveLabel"))) waves = active.optJSONArray("wavePoints");
        }
        if (waves != null) for (int i = 0; i < waves.length(); i++) {
            JSONObject point = waves.optJSONObject(i);
            if (point != null && positive(point.optDouble("price")) && time(point) > 0 && !point.optString("label").isEmpty()) points.add(point);
        }
        points.sort((a, b) -> Long.compare(time(a), time(b)));
        JSONArray fibs = source.optJSONArray(plan == null ? "fibonacciLevels" : "levels");
        if (fibs != null) for (int i = 0; i < fibs.length(); i++) {
            JSONObject level = fibs.optJSONObject(i);
            if (level != null && positive(level.optDouble("price"))) levels.add(level);
        }
        JSONObject invalid = plan == null ? market.optJSONObject("invalidation") : source.optJSONObject("invalidation");
        double value = invalid == null ? Double.NaN : invalid.optDouble("price");
        if (positive(value)) invalidation = value;
    }
    double[] range(int start, int end) {
        double min = Double.POSITIVE_INFINITY, max = Double.NEGATIVE_INFINITY;
        for (int i = start; i < end; i++) {
            min = Math.min(min, candles.get(i).optDouble("low"));
            max = Math.max(max, candles.get(i).optDouble("high"));
        }
        if (!positive(min) || !positive(max)) return new double[]{1, 2};
        double margin = Math.max((max - min) * .12, max * .0005);
        return new double[]{Math.max(min * .01, min - margin), max + margin};
    }
}
