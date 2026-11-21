package com.carlife.bridge

import android.content.Intent
import android.content.pm.ActivityInfo
import android.os.Bundle
import android.provider.Settings
import android.view.WindowManager
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import com.carlife.bridge.model.AppMode
import com.carlife.bridge.model.BridgeSettings
import com.carlife.bridge.service.BridgeForegroundService
import com.carlife.bridge.shizuku.ShizukuBridgeManager
import com.carlife.bridge.touch.CarLifeAccessibilityService
import com.carlife.bridge.ui.UnifiedSettingsScreen
import rikka.shizuku.Shizuku

class MainActivity : ComponentActivity() {

    private lateinit var shizukuManager: ShizukuBridgeManager

    private val shizukuPermissionListener =
        Shizuku.OnRequestPermissionResultListener { requestCode, _ ->
            if (requestCode == ShizukuBridgeManager.SHIZUKU_REQ_CODE) {
                shizukuManager.refreshStatus()
                shizukuManager.bindService()
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        shizukuManager = ShizukuBridgeManager(this)
        Shizuku.addRequestPermissionResultListener(shizukuPermissionListener)

        val defaultApps = listOf(
            "ru.yandex.yandexnavi" to "Яндекс Навигатор",
            "ru.yandex.yandexmaps" to "Яндекс Карты",
            "ru.dublgis.dgismobile" to "2ГИС",
            "ru.yandex.music" to "Яндекс Музыка",
            "com.spotify.music" to "Spotify",
            "com.google.android.youtube" to "YouTube"
        )

        setContent {
            var settings by remember { mutableStateOf(BridgeSettings()) }
            var accessibilityEnabled by remember {
                mutableStateOf(CarLifeAccessibilityService.isEnabled(this))
            }
            val shizukuStatus by shizukuManager.status.collectAsState()

            LaunchedEffect(settings.appMode, settings.keepPhoneScreenOn, settings.forceLandscapeMirroring) {
                if (settings.appMode == AppMode.MIRRORING && settings.keepPhoneScreenOn) {
                    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                } else {
                    window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                }
                requestedOrientation =
                    if (settings.appMode == AppMode.MIRRORING && settings.forceLandscapeMirroring) {
                        ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
                    } else {
                        ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
                    }
            }

            Surface(
                modifier = Modifier.fillMaxSize(),
                color = Color(0xFF0B0E14)
            ) {
                UnifiedSettingsScreen(
                    settings = settings,
                    accessibilityEnabled = accessibilityEnabled,
                    shizukuStatus = shizukuStatus,
                    availableApps = defaultApps,
                    channelPacketCounts = mapOf(
                        0x0001 to 0L,
                        0x0002 to 0L,
                        0x0003 to 0L,
                        0x0004 to 0L,
                        0x0005 to 0L,
                        0x0006 to 0L
                    ),
                    onUpdateSettings = { updated ->
                        settings = updated
                        if (updated.appMode == AppMode.SHIZUKU_COCKPIT) {
                            shizukuManager.refreshStatus()
                            shizukuManager.bindService()
                        }
                    },
                    onOpenAccessibilitySettings = {
                        startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
                        accessibilityEnabled = CarLifeAccessibilityService.isEnabled(this)
                    },
                    onRequestShizukuPermission = {
                        shizukuManager.requestPermission()
                    },
                    onOpenShizukuApp = {
                        shizukuManager.openShizukuApp()
                    },
                    onOpenDeveloperSettings = {
                        shizukuManager.openDeveloperSettings()
                    },
                    onTestPresentationTouch = { x, y ->
                        Toast.makeText(
                            this,
                            "Presentation decorView tap: (${x.toInt()}, ${y.toInt()})",
                            Toast.LENGTH_SHORT
                        ).show()
                    },
                    onTestShizukuKeyEvent = { keyCode ->
                        val svc = shizukuManager.userService
                        if (svc != null) {
                            svc.sendKeyEvent(keyCode, 2)
                        } else {
                            Toast.makeText(
                                this,
                                "Сначала выдайте права Shizuku",
                                Toast.LENGTH_SHORT
                            ).show()
                        }
                    },
                    onScanUsbAoa = {
                        val intent = Intent(this, BridgeForegroundService::class.java)
                        startForegroundService(intent)
                        Toast.makeText(
                            this,
                            "Сервис USB AOA запущен",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                )
            }
        }
    }

    override fun onResume() {
        super.onResume()
        shizukuManager.refreshStatus()
    }

    override fun onDestroy() {
        Shizuku.removeRequestPermissionResultListener(shizukuPermissionListener)
        shizukuManager.unbindService()
        super.onDestroy()
    }
}
