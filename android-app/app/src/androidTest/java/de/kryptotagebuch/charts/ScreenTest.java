package de.kryptotagebuch.charts;

import android.app.Instrumentation;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.test.InstrumentationTestCase;
import android.view.View;
import java.io.File;
import java.io.FileOutputStream;
import org.json.JSONArray;
import org.json.JSONObject;

/** Device tests exercise real Android 15 insets and Canvas rendering. */
public class ScreenTest extends InstrumentationTestCase {
    public void testSystemBarsAndCharts() throws Exception {
        Instrumentation inst=getInstrumentation();
        inst.getUiAutomation().executeShellCommand("pm grant de.kryptotagebuch.charts android.permission.POST_NOTIFICATIONS").close();
        JSONArray rows=new JSONArray();
        for(int i=0;i<100;i++) {
            double close=90+Math.sin(i*.18)*4+i*.03;
            rows.put(new JSONObject().put("time",1700000000000L+i*1800000L).put("open",close-.3)
                    .put("close",close).put("low",close-.8).put("high",close+.8));
        }
        JSONObject plan=new JSONObject().put("timeframe","daily").put("direction","wait")
                .put("waveLabel","Wellenzählung offen").put("invalidation",new JSONObject().put("price",0));
        JSONObject market=new JSONObject().put("symbol","SOLUSDT").put("currentPrice",93)
                .put("candles",new JSONObject().put("daily",rows)).put("signalPlans",new JSONArray().put(plan));
        inst.getTargetContext().getSharedPreferences("market_cache",0).edit()
                .putString("last_payload",new JSONObject().put("markets",new JSONArray().put(market)).toString()).commit();
        MainActivity activity=(MainActivity)inst.startActivitySync(new Intent(inst.getTargetContext(),MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        inst.waitForIdleSync();
        final View root=activity.findViewById(R.id.app_root);
        inst.runOnMainSync(()-> {
            android.graphics.Insets bars=root.getRootWindowInsets().getInsets(android.view.WindowInsets.Type.systemBars());
            assertTrue("Status bar must have space",root.getPaddingTop()>=bars.top);
            assertTrue("Navigation bar must have space",root.getPaddingBottom()>=bars.bottom);
        });
        File dir=new File(inst.getTargetContext().getExternalFilesDir(null),"qa");dir.mkdirs();
        save(inst.getUiAutomation().takeScreenshot(),new File(dir,"homescreen.png"));
        final Bitmap[] chartImage=new Bitmap[1];
        inst.runOnMainSync(()-> {
            ChartView chart=new ChartView(activity);chart.setMarketData(market,"daily",plan);
            chart.layout(0,0,1080,1080);chartImage[0]=Bitmap.createBitmap(1080,1080,Bitmap.Config.ARGB_8888);
            chart.draw(new Canvas(chartImage[0]));
        });
        save(chartImage[0],new File(dir,"zero-invalidation-regression.png"));
        JSONArray points=new JSONArray();
        for(int i=0;i<6;i++) {
            JSONObject row=rows.getJSONObject(40+i*10);
            points.put(new JSONObject().put("time",row.getLong("time")).put("price",row.getDouble("close")).put("label",String.valueOf(i)));
        }
        plan.put("wavePoints",points).put("direction","long").put("waveLabel","TESTDATEN · Welle 5");
        inst.runOnMainSync(()-> {
            ChartView chart=new ChartView(activity);chart.setMarketData(market,"daily",plan);
            chart.layout(0,0,1080,1080);chart.draw(new Canvas(chartImage[0]));
        });
        save(chartImage[0],new File(dir,"wave-labels-fixture.png"));
        inst.runOnMainSync(activity::finish);
    }
    private void save(Bitmap bitmap,File file) throws Exception {
        assertNotNull(bitmap);
        try(FileOutputStream stream=new FileOutputStream(file)) {bitmap.compress(Bitmap.CompressFormat.PNG,100,stream);}
    }
}
