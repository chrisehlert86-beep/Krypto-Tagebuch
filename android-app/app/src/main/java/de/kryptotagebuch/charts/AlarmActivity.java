package de.kryptotagebuch.charts;

import android.app.Activity;
import android.app.NotificationManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.media.AudioAttributes;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.os.Bundle;
import android.os.Build;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

public final class AlarmActivity extends Activity {
    private Ringtone ringtone;

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON | WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        LinearLayout page = new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setGravity(Gravity.CENTER);
        page.setPadding(dp(28), dp(40), dp(28), dp(40));
        page.setBackgroundColor(Color.rgb(2, 6, 23));
        TextView label = text("PREISALARM", 16, Color.rgb(251, 191, 36), true);
        label.setGravity(Gravity.CENTER);
        page.addView(label);
        TextView title = text(getIntent().getStringExtra("title"), 30, Color.WHITE, true);
        title.setGravity(Gravity.CENTER);
        title.setPadding(0, dp(22), 0, dp(12));
        page.addView(title);
        TextView body = text(getIntent().getStringExtra("body"), 20, Color.rgb(203, 213, 225), false);
        body.setGravity(Gravity.CENTER);
        page.addView(body);
        Button stop = new Button(this);
        stop.setText("Alarm stoppen");
        stop.setTextSize(18);
        stop.setOnClickListener(view -> stopAndClose());
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(62));
        params.topMargin = dp(42);
        page.addView(stop, params);
        setContentView(page);
        startAlarmSound();
    }

    private void startAlarmSound() {
        try {
            ringtone = RingtoneManager.getRingtone(this, RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM));
            ringtone.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
            if (Build.VERSION.SDK_INT >= 28) ringtone.setLooping(true);
            ringtone.play();
        } catch (Exception ignored) {}
    }

    private void stopAndClose() {
        if (ringtone != null && ringtone.isPlaying()) ringtone.stop();
        ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).cancelAll();
        finish();
    }

    private TextView text(String value, int size, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value == null ? "" : value); view.setTextSize(size); view.setTextColor(color);
        view.setTypeface(Typeface.create("sans", bold ? Typeface.BOLD : Typeface.NORMAL));
        return view;
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    @Override public void onBackPressed() { stopAndClose(); }
    @Override protected void onDestroy() { if (ringtone != null && ringtone.isPlaying()) ringtone.stop(); super.onDestroy(); }
}
