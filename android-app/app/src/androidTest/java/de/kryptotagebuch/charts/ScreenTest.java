package de.kryptotagebuch.charts;

import android.app.Instrumentation;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import static org.junit.Assert.*;
import android.view.View;
import java.io.File;
import java.io.FileOutputStream;
import org.json.JSONArray;
import org.json.JSONObject;

/** Device tests exercise real Android 15 insets and Canvas rendering. */
public class ScreenTest {
    @Test public void testLocalAlarmPersistsAndMonitorsWithClosedActivity() throws Exception {
        Instrumentation inst = InstrumentationRegistry.getInstrumentation();
        android.content.Context context = inst.getTargetContext();
        inst.getUiAutomation().executeShellCommand("pm grant de.kryptotagebuch.charts android.permission.POST_NOTIFICATIONS").close();
        context.getSharedPreferences("local_price_alarms_v1", 0).edit().clear().commit();
        LocalPriceAlarms.add(context, "BTCUSDT", "below", 0.00000001);
        String identity = LocalPriceAlarms.items(context).getJSONObject(0).getString("id");
        MainActivity activity = (MainActivity) inst.startActivitySync(new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        inst.waitForIdleSync();
        inst.runOnMainSync(activity::finish);
        android.os.SystemClock.sleep(2500);
        java.lang.reflect.Field field = LocalAlarmService.class.getDeclaredField("instance"); field.setAccessible(true);
        Object monitor = field.get(null);
        assertNotNull("Local foreground service continues after Activity closes", monitor);
        assertEquals(identity, LocalPriceAlarms.items(context).getJSONObject(0).getString("id"));
        assertEquals("active", LocalPriceAlarms.items(context).getJSONObject(0).getString("status"));
        // A synthetic fresh trade tests only the emulator's local comparison.
        // It is never sent to an exchange, server or external notification target.
        android.content.SharedPreferences quiet = NotificationPreferences.store(context);
        int oldStart = NotificationPreferences.quietStart(context), oldEnd = NotificationPreferences.quietEnd(context);
        quiet.edit().putInt(NotificationPreferences.QUIET_START, 0).putInt(NotificationPreferences.QUIET_END, 1440).commit();
        try {
            long tradedAt = System.currentTimeMillis() + 100;
            LocalPriceAlarms.evaluate(context, "BTCUSDT", 0.00000001, tradedAt, tradedAt);
            assertEquals("triggered", LocalPriceAlarms.items(context).getJSONObject(0).getString("status"));
            java.lang.reflect.Method deliver = LocalAlarmService.class.getDeclaredMethod("deliverPending"); deliver.setAccessible(true);
            deliver.invoke(monitor);
            assertTrue(LocalPriceAlarms.items(context).getJSONObject(0).getBoolean("notified"));
            assertTrue(SignalStore.hasEvent(context, "local:" + identity));
            long matching = java.util.Arrays.stream(context.getSystemService(android.app.NotificationManager.class).getActiveNotifications())
                    .filter(n -> n.getId() == (("local:" + identity).hashCode() & 0x7fffffff)).count();
            assertEquals("Local Android notification exists", 1L, matching);
        } finally {
            quiet.edit().putInt(NotificationPreferences.QUIET_START, oldStart).putInt(NotificationPreferences.QUIET_END, oldEnd).commit();
            context.getSystemService(android.app.NotificationManager.class).cancel(("local:" + identity).hashCode() & 0x7fffffff);
            context.getSharedPreferences("local_price_alarms_v1", 0).edit().clear().commit();
            context.stopService(new Intent(context, LocalAlarmService.class));
        }
    }

    @Test public void testPersonalPriceAlarmForm() throws Exception {
        Instrumentation inst = InstrumentationRegistry.getInstrumentation();
        inst.getUiAutomation().executeShellCommand("pm grant de.kryptotagebuch.charts android.permission.POST_NOTIFICATIONS").close();
        MainActivity activity = (MainActivity) inst.startActivitySync(new Intent(inst.getTargetContext(), MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        inst.runOnMainSync(() -> {
            try {
                java.lang.reflect.Method show = MainActivity.class.getDeclaredMethod("showAlarms");
                show.setAccessible(true); show.invoke(activity);
            } catch (Exception error) { throw new AssertionError(error); }
            assertNotNull(findDescription(activity.findViewById(R.id.app_root), "Alarmkurs in USDT"));
            assertNotNull(findDescription(activity.findViewById(R.id.app_root), "Alarmrichtung"));
            assertNotNull(findDescription(activity.findViewById(R.id.app_root), "Coin für Preisalarm"));
            android.widget.EditText amount = (android.widget.EditText) findDescription(activity.findViewById(R.id.app_root), "Alarmkurs in USDT");
            amount.setText("80000,25");
            assertEquals(80000.25, LocalAlarmRules.parsePrice(amount.getText().toString()), 0.00001);
            try {
                java.lang.reflect.Method refresh = MainActivity.class.getDeclaredMethod("renderUpdatedMarkets");
                refresh.setAccessible(true); refresh.invoke(activity);
            } catch (Exception error) { throw new AssertionError(error); }
            assertSame("Refreshing analysis must preserve the editable form", amount,
                    findDescription(activity.findViewById(R.id.app_root), "Alarmkurs in USDT"));
            assertEquals("80000,25", amount.getText().toString());
        });
        inst.waitForIdleSync(); android.os.SystemClock.sleep(700);
        File dir = new File(inst.getTargetContext().getExternalFilesDir(null), "qa"); dir.mkdirs();
        save(inst.getUiAutomation().takeScreenshot(), new File(dir, "personal-price-alarm.png"));
        inst.runOnMainSync(activity::finish);
    }

    private View findDescription(View root, String description) {
        if (description.contentEquals(root.getContentDescription() == null ? "" : root.getContentDescription())) return root;
        if (root instanceof android.view.ViewGroup) {
            android.view.ViewGroup group = (android.view.ViewGroup) root;
            for (int i = 0; i < group.getChildCount(); i++) { View found = findDescription(group.getChildAt(i), description); if (found != null) return found; }
        }
        return null;
    }

    @Test public void testSystemBarsAndCharts() throws Exception {
        Instrumentation inst=InstrumentationRegistry.getInstrumentation();
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
                .putString("last_payload",new JSONObject().put("markets",new JSONArray()
                        .put(new JSONObject(market.toString()).put("symbol","BTCUSDT").put("currentPrice",76088))
                        .put(new JSONObject(market.toString()).put("symbol","ETHUSDT").put("currentPrice",2238))
                        .put(market)).toString()).commit();
        MainActivity activity=(MainActivity)inst.startActivitySync(new Intent(inst.getTargetContext(),MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        inst.waitForIdleSync();
        android.os.SystemClock.sleep(700); // Allow SurfaceFlinger to present the first Activity frame.
        final View root=activity.findViewById(R.id.app_root);
        inst.runOnMainSync(()-> {
            android.graphics.Insets bars=root.getRootWindowInsets().getInsets(android.view.WindowInsets.Type.systemBars());
            assertTrue("Status bar must have space",root.getPaddingTop()>=bars.top);
            assertTrue("Navigation bar must have space",root.getPaddingBottom()>=bars.bottom);
        });
        File dir=new File(inst.getTargetContext().getExternalFilesDir(null),"qa");dir.mkdirs();
        save(inst.getUiAutomation().takeScreenshot(),new File(dir,"homescreen.png"));
        inst.runOnMainSync(()-> {
            try {
                java.lang.reflect.Method show=MainActivity.class.getDeclaredMethod("showDetail",JSONObject.class,int.class);
                show.setAccessible(true);show.invoke(activity,market,1);
            } catch(Exception error) {throw new AssertionError(error);}
        });
        inst.waitForIdleSync();
        android.os.SystemClock.sleep(700);
        save(inst.getUiAutomation().takeScreenshot(),new File(dir,"detail-no-analysis.png"));
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
