package app.rise.habits;

import com.getcapacitor.BridgeActivity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.os.Build;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            NotificationChannel audible = new NotificationChannel("rise-prayer-sound-v1", "RISE prayer alerts", NotificationManager.IMPORTANCE_HIGH);
            audible.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
                new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).build());
            audible.enableVibration(true);
            audible.setLockscreenVisibility(android.app.Notification.VISIBILITY_PRIVATE);
            NotificationChannel quiet = new NotificationChannel("rise-prayer-quiet-v1", "RISE quiet prayer alerts", NotificationManager.IMPORTANCE_DEFAULT);
            quiet.setSound(null, null);
            quiet.enableVibration(false);
            quiet.setLockscreenVisibility(android.app.Notification.VISIBILITY_PRIVATE);
            // Creating an existing channel preserves the user's system-level choices.
            manager.createNotificationChannel(audible);
            manager.createNotificationChannel(quiet);
        }
    }
}
