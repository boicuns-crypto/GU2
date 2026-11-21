package com.carlife.bridge

import android.Manifest
import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.pm.PackageManager
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.view.WindowManager
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Apps
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.carlife.bridge.model.AppMode
import com.carlife.bridge.model.BridgeSettings
import com.carlife.bridge.service.BridgeForegroundService
import com.carlife.bridge.shizuku.ShizukuBridgeManager
import com.carlife.bridge.touch.CarLifeAccessibilityService
import com.carlife.bridge.ui.UnifiedSettingsScreen
import rikka.shizuku.Shizuku

class MainActivity : ComponentActivity() {

    private lateinit var shizukuManager: ShizukuBridgeManager
    private var mediaProjectionGranted by mutableStateOf(false)

    private val mediaProjectionLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        mediaProjectionGranted = result.resultCode == RESULT_OK && result.data != null
        Toast.makeText(
            this,
            if (mediaProjectionGranted) "MediaProjection («Весь экран») выдан"
            else "MediaProjection отклонён",
            Toast.LENGTH_SHORT
        ).show()
    }

    private val audioPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        Toast.makeText(
            this,
            if (granted) "Разрешение RECORD_AUDIO выдано" else "Нет разрешения RECORD_AUDIO",
            Toast.LENGTH_SHORT
        ).show()
    }

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
            var selectedTab by remember { mutableIntStateOf(2) }
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

            Scaffold(
                containerColor = Color(0xFF0B0E14),
                bottomBar = {
                    NavigationBar(containerColor = Color(0xFF151A24)) {
                        NavigationBarItem(
                            selected = selectedTab == 0,
                            onClick = { selectedTab = 0 },
                            icon = { Icon(Icons.Default.Apps, contentDescription = "Лаунчер") },
                            label = { Text("Лаунчер") }
                        )
                        NavigationBarItem(
                            selected = selectedTab == 1,
                            onClick = {
                                accessibilityEnabled = CarLifeAccessibilityService.isEnabled(this@MainActivity)
                                shizukuManager.refreshStatus()
                                selectedTab = 1
                            },
                            icon = { Icon(Icons.Default.CheckCircle, contentDescription = "Подключение") },
                            label = { Text("Чек-лист") }
                        )
                        NavigationBarItem(
                            selected = selectedTab == 2,
                            onClick = {
                                accessibilityEnabled = CarLifeAccessibilityService.isEnabled(this@MainActivity)
                                shizukuManager.refreshStatus()
                                selectedTab = 2
                            },
                            icon = { Icon(Icons.Default.Settings, contentDescription = "Настройки") },
                            label = { Text("Настройки") }
                        )
                    }
                }
            ) { innerPadding ->
                Box(modifier = Modifier.fillMaxSize().padding(innerPadding)) {
                    when (selectedTab) {
                        0 -> CockpitLauncherTab(
                            apps = defaultApps.filter {
                                settings.launcherVisiblePackages.isEmpty() || it.first in settings.launcherVisiblePackages
                            },
                            showNavButtons = settings.appMode != AppMode.SHIZUKU_COCKPIT || settings.shizukuVdNavButtonsEnabled,
                            onLaunchApp = { pkg, label ->
                                if (settings.appMode == AppMode.SHIZUKU_COCKPIT && shizukuManager.userService != null) {
                                    shizukuManager.userService?.launchAppOnDisplay(pkg, "", 2)
                                    Toast.makeText(this@MainActivity, "Shizuku VD: $label", Toast.LENGTH_SHORT).show()
                                } else {
                                    val intent = packageManager.getLaunchIntentForPackage(pkg)
                                    if (intent != null) {
                                        startActivity(intent)
                                    } else {
                                        Toast.makeText(this@MainActivity, "$label не установлен ($pkg)", Toast.LENGTH_SHORT).show()
                                    }
                                }
                            },
                            onHome = {
                                if (settings.appMode == AppMode.SHIZUKU_COCKPIT) {
                                    shizukuManager.userService?.sendKeyEvent(3, 2)
                                } else {
                                    CarLifeAccessibilityService.instance?.performHome()
                                }
                            },
                            onBack = {
                                if (settings.appMode == AppMode.SHIZUKU_COCKPIT) {
                                    shizukuManager.userService?.sendKeyEvent(4, 2)
                                } else {
                                    CarLifeAccessibilityService.instance?.performBack()
                                }
                            }
                        )

                        1 -> OnboardingChecklistTab(
                            batteryIgnored = isIgnoringBatteryOptimizations(),
                            overlayGranted = Settings.canDrawOverlays(this@MainActivity),
                            a11yEnabled = accessibilityEnabled,
                            audioGranted = ContextCompat.checkSelfPermission(
                                this@MainActivity,
                                Manifest.permission.RECORD_AUDIO
                            ) == PackageManager.PERMISSION_GRANTED,
                            mediaProjectionGranted = mediaProjectionGranted,
                            shizukuBadge = shizukuStatus.badgeText,
                            onBatterySettings = {
                                val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
                                startActivity(intent)
                            },
                            onOverlaySettings = {
                                val intent = Intent(
                                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                                    Uri.parse("package:$packageName")
                                )
                                startActivity(intent)
                            },
                            onA11ySettings = {
                                startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
                            },
                            onRequestAudio = {
                                audioPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                            },
                            onRequestMediaProjection = {
                                val mpm = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
                                mediaProjectionLauncher.launch(mpm.createScreenCaptureIntent())
                            },
                            onRequestShizuku = {
                                shizukuManager.requestPermission()
                            },
                            onStartUsbService = {
                                startBridgeService()
                            }
                        )

                        else -> UnifiedSettingsScreen(
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
                                accessibilityEnabled = CarLifeAccessibilityService.isEnabled(this@MainActivity)
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
                                    this@MainActivity,
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
                                        this@MainActivity,
                                        "Сначала выдайте права Shizuku",
                                        Toast.LENGTH_SHORT
                                    ).show()
                                }
                            },
                            onScanUsbAoa = {
                                startBridgeService()
                            }
                        )
                    }
                }
            }
        }
    }

    private fun startBridgeService() {
        val intent = Intent(this, BridgeForegroundService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
        Toast.makeText(this, "Сервис USB AOA запущен", Toast.LENGTH_SHORT).show()
    }

    private fun isIgnoringBatteryOptimizations(): Boolean {
        val pm = getSystemService(POWER_SERVICE) as PowerManager
        return pm.isIgnoringBatteryOptimizations(packageName)
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

@Composable
private fun CockpitLauncherTab(
    apps: List<Pair<String, String>>,
    showNavButtons: Boolean,
    onLaunchApp: (pkg: String, label: String) -> Unit,
    onHome: () -> Unit,
    onBack: () -> Unit
) {
    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text("Лаунчер ГУ (Кокпит)", color = Color(0xFFF1F5F9), fontSize = 18.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        if (showNavButtons) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                OutlinedButton(onClick = onHome, modifier = Modifier.weight(1f)) { Text("Домой") }
                OutlinedButton(onClick = onBack, modifier = Modifier.weight(1f)) { Text("Назад") }
            }
            Spacer(Modifier.height(10.dp))
        }
        LazyVerticalGrid(
            columns = GridCells.Adaptive(minSize = 110.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxSize()
        ) {
            items(apps) { (pkg, label) ->
                Card(
                    onClick = { onLaunchApp(pkg, label) },
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF151A24)),
                    border = BorderStroke(1.dp, Color(0xFF222938)),
                    shape = RoundedCornerShape(14.dp)
                ) {
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(14.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(label, color = Color(0xFFF1F5F9), fontSize = 13.sp, fontWeight = FontWeight.Medium)
                    }
                }
            }
        }
    }
}

@Composable
private fun OnboardingChecklistTab(
    batteryIgnored: Boolean,
    overlayGranted: Boolean,
    a11yEnabled: Boolean,
    audioGranted: Boolean,
    mediaProjectionGranted: Boolean,
    shizukuBadge: String,
    onBatterySettings: () -> Unit,
    onOverlaySettings: () -> Unit,
    onA11ySettings: () -> Unit,
    onRequestAudio: () -> Unit,
    onRequestMediaProjection: () -> Unit,
    onRequestShizuku: () -> Unit,
    onStartUsbService: () -> Unit
) {
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Text("Подключение и разрешения", color = Color(0xFFF1F5F9), fontSize = 18.sp, fontWeight = FontWeight.Bold)
        ChecklistRow("1. Работа в фоне (Без ограничений)", batteryIgnored, "Настроить", onBatterySettings)
        ChecklistRow("2. Поверх других окон (Overlay)", overlayGranted, "Выдать", onOverlaySettings)
        ChecklistRow("3. Служба тача (Спец. возможности)", a11yEnabled, "Открыть", onA11ySettings)
        ChecklistRow("4. Доступ к звуку (RECORD_AUDIO)", audioGranted, "Разрешить", onRequestAudio)
        ChecklistRow("5. Захват экрана (MediaProjection)", mediaProjectionGranted, "Запросить", onRequestMediaProjection)
        ChecklistRow("6. Shizuku (второй экран): $shizukuBadge", shizukuBadge == "Активен и разрешён", "Права Shizuku", onRequestShizuku)
        Spacer(Modifier.height(6.dp))
        Button(
            onClick = onStartUsbService,
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF00B4D8))
        ) {
            Text("Запустить сервис USB AOA", color = Color(0xFF001D24), fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun ChecklistRow(
    title: String,
    done: Boolean,
    actionLabel: String,
    onClick: () -> Unit
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0xFF151A24)),
        border = BorderStroke(1.dp, if (done) Color(0xFF10B981) else Color(0xFF222938)),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = title,
                color = if (done) Color(0xFF10B981) else Color(0xFFF1F5F9),
                fontSize = 13.sp,
                modifier = Modifier.weight(1f).padding(end = 8.dp)
            )
            OutlinedButton(onClick = onClick) { Text(actionLabel, fontSize = 11.sp) }
        }
    }
}
