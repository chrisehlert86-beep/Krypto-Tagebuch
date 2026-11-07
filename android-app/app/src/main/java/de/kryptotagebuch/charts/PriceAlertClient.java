package de.kryptotagebuch.charts;

import android.content.Context;
import org.json.JSONObject;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;

final class PriceAlertClient {
    private static final String BASE = "https://krypto-tagebuch.vercel.app/api/mobile/";
    private static final String STORE = "personal_price_alarms";
    private PriceAlertClient() {}

    static synchronized String secret(Context context) {
        String value = context.getSharedPreferences(STORE, Context.MODE_PRIVATE).getString("secret", "");
        if (value.length() != 64) {
            byte[] bytes = new byte[32]; new SecureRandom().nextBytes(bytes);
            StringBuilder result = new StringBuilder();
            for (byte b : bytes) result.append(String.format(java.util.Locale.ROOT, "%02x", b & 255));
            value = result.toString();
            context.getSharedPreferences(STORE, Context.MODE_PRIVATE).edit().putString("secret", value).commit();
        }
        return value;
    }

    static String pushToken(Context context) {
        return context.getSharedPreferences(STORE, Context.MODE_PRIVATE).getString("push_token", "");
    }
    static void savePushToken(Context context, String token) {
        context.getSharedPreferences(STORE, Context.MODE_PRIVATE).edit().putString("push_token", token).apply();
    }

    static JSONObject request(Context context, String resource, String method, JSONObject body) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(BASE + resource).openConnection();
        try {
            connection.setRequestMethod(method);
            connection.setConnectTimeout(5000); connection.setReadTimeout(5000);
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("Cache-Control", "no-cache");
            if ("price-alerts".equals(resource)) connection.setRequestProperty("Authorization", "Bearer " + secret(context));
            if (body != null) {
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json");
                try (java.io.OutputStream output = connection.getOutputStream()) { output.write(body.toString().getBytes(StandardCharsets.UTF_8)); }
            }
            int status = connection.getResponseCode();
            java.io.InputStream stream = status < 400 ? connection.getInputStream() : connection.getErrorStream();
            if (stream == null) throw new IllegalStateException("Dienst momentan nicht erreichbar.");
            String text;
            try (java.io.BufferedReader input = new java.io.BufferedReader(new java.io.InputStreamReader(stream, StandardCharsets.UTF_8))) {
                StringBuilder result = new StringBuilder(); String line;
                while ((line = input.readLine()) != null) result.append(line);
                text = result.toString();
            }
            JSONObject result = new JSONObject(text);
            if (status >= 400) throw new IllegalStateException(result.optString("error", "Anfrage fehlgeschlagen."));
            return result;
        } finally { connection.disconnect(); }
    }

    static double parsePrice(String text) {
        String value = text.trim().replaceAll("\\s", "");
        if (!value.matches("[0-9]+([.,][0-9]{1,8})?")) return Double.NaN;
        try { double number = Double.parseDouble(value.replace(',', '.')); return Double.isFinite(number) && number > 0 && number < 1e12 ? number : Double.NaN; }
        catch (NumberFormatException error) { return Double.NaN; }
    }
}
