package de.kryptotagebuch.charts;
import org.junit.Test;
import static org.junit.Assert.*;

public class PriceAlertClientTest {
    @Test public void decimalCommaAndPoint() {
        assertEquals(80000.25, PriceAlertClient.parsePrice("80000,25"), 0.00001);
        assertEquals(90.25, PriceAlertClient.parsePrice("90.25"), 0.00001);
    }
    @Test public void rejectsAmbiguousOrUnsafePrices() {
        for (String value : new String[]{"", "80.000,25", "80,000.25", "-1", "0", "1e5", "Infinity", "1000000000000"})
            assertTrue(value, Double.isNaN(PriceAlertClient.parsePrice(value)));
    }
}
