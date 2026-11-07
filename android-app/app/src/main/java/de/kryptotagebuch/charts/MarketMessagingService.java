package de.kryptotagebuch.charts;
import android.content.Context;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.HashMap;
import java.util.Map;

/** Legacy market messages are informational. Only locally matched alarms ring. */
public final class MarketMessagingService extends FirebaseMessagingService {
    static void createChannels(Context context) { AlarmNotifier.channels(context); }
    @Override public void onMessageReceived(RemoteMessage message) {
        Map<String,String> data = new HashMap<>(message.getData());
        if (data.isEmpty() || SignalStore.hasEvent(this, data.get("eventId"))) return;
        data.putIfAbsent("title", "Marktinformation");
        data.putIfAbsent("body", data.getOrDefault("symbol", "Markt") + " · neue Marktinformation");
        SignalStore.add(this, data, true);
        AlarmNotifier.show(this, data, true);
    }
}
