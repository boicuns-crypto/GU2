package com.carlife.bridge.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import com.carlife.bridge.transport.UsbTxTransportEngine

class BridgeForegroundService : Service() {

    private var wakeLock: PowerManager.WakeLock? = null
    private val txEngine = UsbTxTransportEngine { null }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        val notification = buildNotification("CarLife Bridge готов к подключению USB AOA")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "CarLifeBridge::UsbAoaWakeLock").apply {
            acquire(60 * 60 * 1000L)
        }
        txEngine.start()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY
    }

    override fun onDestroy() {
        txEngine.stop()
        wakeLock?.let {
            if (it.isHeld) it.release()
        }
        wakeLock = null
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "CarLife Bridge USB AOA",
                NotificationManager.IMPORTANCE_LOW
            )
            val nm = getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(text: String): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("CarLife Bridge")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
            .setOngoing(true)
            .build()
    }

    companion object {
        private const val CHANNEL_ID = "carlife_bridge_channel"
        private const val NOTIFICATION_ID = 101
    }
}
