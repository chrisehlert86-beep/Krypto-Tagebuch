package de.kryptotagebuch.charts;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

public class ChartDataTest {
    private JSONObject market() throws Exception {
        JSONArray candles = new JSONArray();
        for (int i=0;i<100;i++) candles.put(new JSONObject().put("time",1700000000000L+i*1800000L)
                .put("open",89).put("high",91+i*.01).put("low",88).put("close",90));
        return new JSONObject().put("candles",new JSONObject().put("daily",candles).put("m15",candles));
    }
    @Test public void zeroInvalidationCannotFlattenSolChart() throws Exception {
        JSONObject plan = new JSONObject().put("invalidation",new JSONObject().put("price",0));
        ChartData data = new ChartData(market(),"daily",plan);
        assertTrue(Double.isNaN(data.invalidation));
        assertTrue(data.range(36,100)[0]>80);
        assertTrue(data.range(36,100)[1]<100);
    }
    @Test public void distantTargetsDoNotFlattenCandles() throws Exception {
        JSONObject plan = new JSONObject().put("levels",new JSONArray().put(new JSONObject().put("price",10000)))
                .put("invalidation",new JSONObject().put("price",1));
        ChartData data = new ChartData(market(),"daily",plan);
        assertEquals(1,data.levels.size());
        assertEquals(1,data.invalidation,0);
        assertTrue(data.range(36,100)[0]>80);
        assertTrue(data.range(36,100)[1]<100);
    }
    @Test public void wavesUseOwnTimeframeAndKeepLabels() throws Exception {
        JSONObject point = new JSONObject().put("time",1700000000L).put("price",90).put("label","(1)");
        JSONObject m = market().put("activeCase",new JSONObject().put("wavePoints",new JSONArray().put(point)));
        assertEquals(0,new ChartData(m,"m15",null).points.size());
        ChartData daily = new ChartData(m,"daily",null);
        assertEquals("(1)",daily.points.get(0).optString("label"));
        assertEquals(1700000000000L,ChartData.time(daily.points.get(0)));
    }
    @Test public void corruptPricesAreRejectedAndRangeRemainsPositive() throws Exception {
        JSONObject m=market();
        m.getJSONObject("candles").getJSONArray("daily").put(new JSONObject().put("open",1).put("high",2).put("low",-10).put("close",1));
        JSONObject plan=new JSONObject().put("levels",new JSONArray().put(new JSONObject().put("price",0)).put(new JSONObject().put("price",-1)));
        ChartData data=new ChartData(m,"daily",plan);
        assertEquals(100,data.candles.size());assertTrue(data.levels.isEmpty());
        assertTrue(data.range(0,100)[0]>0);
    }
}
