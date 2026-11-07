package de.kryptotagebuch.charts;
import org.junit.Test;
import static org.junit.Assert.*;
import org.json.JSONArray;
import org.json.JSONObject;

public class PriceAlertClientTest {
    @Test public void decimalCommaAndPoint() {
        assertEquals(80000.25, LocalAlarmRules.parsePrice("80000,25"), 0.00001);
        assertEquals(90.25, LocalAlarmRules.parsePrice("90.25"), 0.00001);
    }
    @Test public void rejectsAmbiguousOrUnsafePrices() {
        for (String value : new String[]{"", "80.000,25", "80,000.25", "-1", "0", "1e5", "Infinity", "1000000000000"})
            assertTrue(value, Double.isNaN(LocalAlarmRules.parsePrice(value)));
    }
    private JSONArray alarm(String direction) throws Exception {
        return new JSONArray().put(new JSONObject().put("id", "local-test").put("symbol", "BTCUSDT").put("crossing", direction)
                .put("price", 100).put("status", "active").put("createdAt", 1000));
    }
    @Test public void comparesLocalThresholdIncludingEquality() throws Exception {
        for (String direction : new String[]{"above", "below"}) {
            JSONArray values = alarm(direction);
            assertTrue(LocalAlarmRules.evaluate(values, "BTCUSDT", 100, 2000, 2000));
            assertEquals("triggered", values.getJSONObject(0).getString("status"));
        }
    }
    @Test public void persistsOneShotAfterRestartAndBounce() throws Exception {
        JSONArray values = alarm("above");
        assertTrue(LocalAlarmRules.evaluate(values, "BTCUSDT", 101, 2000, 2000));
        JSONArray restored = new JSONArray(values.toString());
        assertFalse(LocalAlarmRules.evaluate(restored, "BTCUSDT", 99, 3000, 3000));
        assertFalse(LocalAlarmRules.evaluate(restored, "BTCUSDT", 101, 4000, 4000));
        assertFalse(restored.getJSONObject(0).getBoolean("notified"));
    }
    @Test public void staleWrongCoinAndCancelledNeverTrigger() throws Exception {
        JSONArray values = alarm("above");
        assertFalse(LocalAlarmRules.evaluate(values, "BTCUSDT", 101, 2000, 18001));
        assertFalse(LocalAlarmRules.evaluate(values, "BTCUSDT", 101, 1000, 2000));
        assertFalse(LocalAlarmRules.evaluate(values, "SOLUSDT", 101, 2000, 2000));
        assertFalse(LocalAlarmRules.evaluate(values, "BTCUSDT", Double.NaN, 2000, 2000));
        values.getJSONObject(0).put("status", "cancelled");
        assertFalse(LocalAlarmRules.evaluate(values, "BTCUSDT", 101, 2000, 2000));
    }
}
