package de.kryptotagebuch.charts;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.view.View;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

public final class ChartView extends View {
    private static final int GREEN = Color.rgb(52, 211, 153);
    private static final int RED = Color.rgb(251, 113, 133);
    private static final int BLUE = Color.rgb(56, 189, 248);
    private static final int AMBER = Color.rgb(251, 191, 36);
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final List<Candle> candles = new ArrayList<>();
    private final List<Level> levels = new ArrayList<>();
    private double invalidation = Double.NaN;

    public ChartView(Context context) {
        super(context);
        setBackgroundColor(Color.rgb(2, 6, 23));
    }

    public void setMarketData(JSONObject market, String timeframe, JSONObject plan) {
        candles.clear();
        levels.clear();
        JSONObject candleSets = market.optJSONObject("candles");
        JSONArray rows = candleSets == null ? null : candleSets.optJSONArray(timeframe);
        if (rows != null) {
            int start = Math.max(0, rows.length() - ("m30".equals(timeframe) ? 160 : 120));
            for (int index = start; index < rows.length(); index++) {
                JSONObject row = rows.optJSONObject(index);
                if (row != null) candles.add(new Candle(row.optDouble("open"), row.optDouble("high"), row.optDouble("low"), row.optDouble("close")));
            }
        }
        JSONArray fibs;
        JSONObject invalid;
        if (plan != null) {
            fibs = plan.optJSONArray("levels");
            invalid = plan.optJSONObject("invalidation");
        } else {
            JSONObject active = market.optJSONObject("activeCase");
            fibs = active == null ? null : active.optJSONArray("fibonacciLevels");
            invalid = market.optJSONObject("invalidation");
        }
        if (fibs != null) {
            for (int index = 0; index < fibs.length(); index++) {
                JSONObject item = fibs.optJSONObject(index);
                if (item != null) levels.add(new Level(item.optString("ratio"), item.optDouble("price")));
            }
        }
        invalidation = invalid == null ? Double.NaN : invalid.optDouble("price", Double.NaN);
        invalidate();
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        float density = getResources().getDisplayMetrics().density;
        float left = 12 * density;
        float top = 16 * density;
        float right = getWidth() - 76 * density;
        float bottom = getHeight() - 24 * density;
        if (candles.size() < 2) {
            paint.setColor(Color.rgb(148, 163, 184));
            paint.setTextSize(15 * density);
            canvas.drawText("Keine Chartdaten verfügbar", 24 * density, getHeight() / 2f, paint);
            return;
        }

        double min = Double.POSITIVE_INFINITY;
        double max = Double.NEGATIVE_INFINITY;
        for (Candle candle : candles) { min = Math.min(min, candle.low); max = Math.max(max, candle.high); }
        for (Level level : levels) { min = Math.min(min, level.price); max = Math.max(max, level.price); }
        if (Double.isFinite(invalidation)) { min = Math.min(min, invalidation); max = Math.max(max, invalidation); }
        double margin = Math.max((max - min) * 0.08, max * 0.005);
        min -= margin;
        max += margin;
        final double chartMin = min;
        final double chartMax = max;

        paint.setStrokeWidth(1);
        paint.setTextSize(10 * density);
        for (int index = 0; index < 5; index++) {
            float y = top + (bottom - top) * index / 4f;
            paint.setColor(Color.rgb(30, 41, 59));
            canvas.drawLine(left, y, right, y, paint);
            double value = chartMax - (chartMax - chartMin) * index / 4d;
            paint.setColor(Color.rgb(148, 163, 184));
            canvas.drawText(MainActivity.formatPrice(value), right + 6 * density, y + 4 * density, paint);
        }

        float step = (right - left) / candles.size();
        float bodyWidth = Math.max(1.4f * density, Math.min(5 * density, step * 0.62f));
        for (int index = 0; index < candles.size(); index++) {
            Candle candle = candles.get(index);
            float x = left + step * index + step / 2f;
            paint.setColor(candle.close >= candle.open ? GREEN : RED);
            paint.setStrokeWidth(Math.max(1, density));
            canvas.drawLine(x, y(candle.high, chartMin, chartMax, top, bottom), x, y(candle.low, chartMin, chartMax, top, bottom), paint);
            float bodyTop = y(Math.max(candle.open, candle.close), chartMin, chartMax, top, bottom);
            float bodyBottom = y(Math.min(candle.open, candle.close), chartMin, chartMax, top, bottom);
            canvas.drawRect(new RectF(x - bodyWidth / 2f, bodyTop, x + bodyWidth / 2f, Math.max(bodyTop + density, bodyBottom)), paint);
        }

        paint.setTextSize(10 * density);
        for (Level level : levels) {
            float y = y(level.price, chartMin, chartMax, top, bottom);
            paint.setColor(BLUE);
            paint.setStrokeWidth(1.2f * density);
            canvas.drawLine(left, y, right, y, paint);
            canvas.drawText("Fib " + level.ratio, left + 5 * density, y - 4 * density, paint);
        }
        if (Double.isFinite(invalidation)) {
            float y = y(invalidation, chartMin, chartMax, top, bottom);
            paint.setColor(RED);
            paint.setStrokeWidth(1.5f * density);
            canvas.drawLine(left, y, right, y, paint);
            canvas.drawText("INVALID", left + 5 * density, y - 4 * density, paint);
        }
        if (!levels.isEmpty()) {
            paint.setColor(AMBER);
            paint.setTextSize(11 * density);
            canvas.drawText("Fibonacci", left + 5 * density, top + 13 * density, paint);
        }
    }

    private float y(double value, double min, double max, float top, float bottom) {
        return top + (float) ((max - value) / (max - min)) * (bottom - top);
    }

    private static final class Candle {
        final double open, high, low, close;
        Candle(double open, double high, double low, double close) { this.open = open; this.high = high; this.low = low; this.close = close; }
    }

    private static final class Level {
        final String ratio;
        final double price;
        Level(String ratio, double price) { this.ratio = ratio; this.price = price; }
    }
}
