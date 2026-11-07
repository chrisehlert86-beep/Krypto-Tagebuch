package de.kryptotagebuch.charts;
import android.content.*;
public final class LocalAlarmBootReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        if (!(Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction()) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(intent.getAction()))) return;
        if (LocalPriceAlarms.needsMonitoring(context)) context.startForegroundService(new Intent(context, LocalAlarmService.class));
    }
}
