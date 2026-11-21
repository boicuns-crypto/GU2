package com.carlife.bridge.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.carlife.bridge.model.AppMode
import com.carlife.bridge.model.BridgeSettings
import com.carlife.bridge.model.ShizukuStatus
import com.carlife.bridge.model.ShizukuVdNavLayout

private val BgDark = Color(0xFF0B0E14)
private val CardDark = Color(0xFF151A24)
private val BorderDark = Color(0xFF222938)
private val AccentCyan = Color(0xFF00B4D8)
private val AccentGreen = Color(0xFF10B981)
private val TextPrimary = Color(0xFFF1F5F9)
private val TextSecondary = Color(0xFF94A3B8)

@Composable
fun UnifiedSettingsScreen(
    settings: BridgeSettings,
    accessibilityEnabled: Boolean,
    shizukuStatus: ShizukuStatus,
    availableApps: List<Pair<String, String>>,
    channelPacketCounts: Map<Int, Long>,
    onUpdateSettings: (BridgeSettings) -> Unit,
    onOpenAccessibilitySettings: () -> Unit,
    onRequestShizukuPermission: () -> Unit,
    onOpenShizukuApp: () -> Unit,
    onOpenDeveloperSettings: () -> Unit,
    onTestPresentationTouch: (x: Float, y: Float) -> Unit,
    onTestShizukuKeyEvent: (keyCode: Int) -> Unit,
    onScanUsbAoa: () -> Unit
) {
    var shizukuGuideExpanded by remember { mutableStateOf(false) }
    var diagnosticsExpanded by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // 1. Блок «Режим работы» (всегда сверху)
        SettingsCard(borderColor = AccentCyan.copy(alpha = 0.7f)) {
            Text("Режим работы", color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(8.dp))
            AppMode.entries.forEach { mode ->
                val selected = settings.appMode == mode
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp),
                    onClick = { onUpdateSettings(settings.copy(appMode = mode)) },
                    colors = CardDefaults.cardColors(
                        containerColor = if (selected) AccentCyan.copy(alpha = 0.12f) else BgDark
                    ),
                    border = BorderStroke(1.dp, if (selected) AccentCyan else BorderDark),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        RadioButton(
                            selected = selected,
                            onClick = { onUpdateSettings(settings.copy(appMode = mode)) }
                        )
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = mode.title,
                                color = if (selected) AccentCyan else TextPrimary,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                            Text(text = mode.subtitle, color = TextSecondary, fontSize = 11.sp)
                        }
                    }
                }
            }
        }

        // 2. Контекстный блок «Настройки выбранного режима»
        SettingsCard {
            Text(
                text = "Настройки выбранного режима",
                color = TextPrimary,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold
            )
            Text(
                text = "${settings.appMode.title} — ${settings.width}×${settings.height} • ${settings.densityDpi} dpi",
                color = AccentCyan,
                fontSize = 11.sp
            )
            Spacer(Modifier.height(10.dp))

            when (settings.appMode) {
                AppMode.COCKPIT -> {
                    ResolutionAndDpiSelectors(settings, onUpdateSettings, include180 = true)
                    Spacer(Modifier.height(10.dp))
                    Text("Сетка приложений лаунчера", color = TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                    availableApps.forEach { (pkg, label) ->
                        val checked = settings.launcherVisiblePackages.isEmpty() || pkg in settings.launcherVisiblePackages
                        SwitchRow(
                            title = label,
                            subtitle = pkg,
                            checked = checked,
                            onCheckedChange = { next ->
                                val base = if (settings.launcherVisiblePackages.isEmpty()) {
                                    availableApps.map { it.first }.toSet()
                                } else {
                                    settings.launcherVisiblePackages
                                }
                                val updated = if (next) base + pkg else (base - pkg).ifEmpty { base }
                                onUpdateSettings(settings.copy(launcherVisiblePackages = updated))
                            }
                        )
                    }
                    Spacer(Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                        OutlinedButton(
                            onClick = { onTestPresentationTouch(120f, 180f) },
                            modifier = Modifier.weight(1f)
                        ) { Text("Тест Док") }
                        OutlinedButton(
                            onClick = { onTestPresentationTouch(680f, 360f) },
                            modifier = Modifier.weight(1f)
                        ) { Text("Тест Сетка") }
                    }
                }

                AppMode.MIRRORING -> {
                    Text(
                        text = "Служба тача (Спец. возможности): ${if (accessibilityEnabled) "Вкл" else "Выкл"}",
                        color = if (accessibilityEnabled) AccentGreen else Color(0xFFF59E0B),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                    Spacer(Modifier.height(6.dp))
                    Button(
                        onClick = onOpenAccessibilitySettings,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = AccentCyan)
                    ) {
                        Text(
                            if (accessibilityEnabled) "Служба тача активна (Настройки)"
                            else "Включить службу тача (Спец. возможности)",
                            color = Color(0xFF001D24)
                        )
                    }
                    Spacer(Modifier.height(10.dp))
                    ResolutionAndDpiSelectors(settings, onUpdateSettings, include180 = false)
                    FpsAndVbrSelectors(settings, onUpdateSettings)
                    Spacer(Modifier.height(8.dp))
                    SwitchRow(
                        title = "Не выключать экран телефона",
                        subtitle = "FLAG_KEEP_SCREEN_ON во время зеркалирования",
                        checked = settings.keepPhoneScreenOn,
                        onCheckedChange = { onUpdateSettings(settings.copy(keepPhoneScreenOn = it)) }
                    )
                    SwitchRow(
                        title = "Принудительная альбомная ориентация",
                        subtitle = "Фиксация горизонтального экрана (если поддерживается)",
                        checked = settings.forceLandscapeMirroring,
                        onCheckedChange = { onUpdateSettings(settings.copy(forceLandscapeMirroring = it)) }
                    )
                }

                AppMode.SHIZUKU_COCKPIT -> {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Статус Shizuku:", color = TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                        Text(
                            text = shizukuStatus.badgeText,
                            color = when (shizukuStatus) {
                                ShizukuStatus.RUNNING_GRANTED -> AccentGreen
                                ShizukuStatus.NO_PERMISSION -> Color(0xFFF59E0B)
                                ShizukuStatus.NOT_RUNNING -> Color(0xFFEF4444)
                            },
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    Spacer(Modifier.height(8.dp))
                    Button(
                        onClick = onRequestShizukuPermission,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = AccentCyan)
                    ) {
                        Text("Запросить права Shizuku", color = Color(0xFF001D24))
                    }
                    Spacer(Modifier.height(8.dp))

                    // Сворачиваемая инструкция настройки Shizuku
                    Card(
                        onClick = { shizukuGuideExpanded = !shizukuGuideExpanded },
                        colors = CardDefaults.cardColors(containerColor = BgDark),
                        border = BorderStroke(1.dp, BorderDark)
                    ) {
                        Column(modifier = Modifier.fillMaxWidth().padding(12.dp)) {
                            Text(
                                text = if (shizukuGuideExpanded) "▲ Как настроить Shizuku (инструкция)"
                                else "▼ Как настроить Shizuku (инструкция)",
                                color = AccentCyan,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                            AnimatedVisibility(visible = shizukuGuideExpanded) {
                                Column(verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(top = 8.dp)) {
                                    Text("1. Установите Shizuku (Google Play / GitHub) и подключите телефон к Wi-Fi (только на время запуска).", color = TextSecondary, fontSize = 11.sp)
                                    Text("2. Включите «Отладку по Wi-Fi» в Параметрах разработчика → выберите «Подключить устройство с помощью кода сопряжения».", color = TextSecondary, fontSize = 11.sp)
                                    Text("3. В Shizuku нажмите «Сопряжение», введите 6-значный код в уведомлении, затем нажмите «Запуск» («Shizuku работает»).", color = TextSecondary, fontSize = 11.sp)
                                    Text("4. Вернитесь сюда и нажмите «Запросить права Shizuku» → «Разрешить всегда». После этого Wi-Fi можно отключить.", color = TextSecondary, fontSize = 11.sp)
                                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                                        OutlinedButton(onClick = onOpenShizukuApp, modifier = Modifier.weight(1f)) {
                                            Text("Открыть Shizuku", fontSize = 11.sp)
                                        }
                                        OutlinedButton(onClick = onOpenDeveloperSettings, modifier = Modifier.weight(1f)) {
                                            Text("Параметры разраб.", fontSize = 11.sp)
                                        }
                                    }
                                    Button(
                                        onClick = onRequestShizukuPermission,
                                        modifier = Modifier.fillMaxWidth(),
                                        colors = ButtonDefaults.buttonColors(containerColor = AccentCyan)
                                    ) {
                                        Text("Запросить права Shizuku", color = Color(0xFF001D24), fontSize = 12.sp)
                                    }
                                }
                            }
                        }
                    }

                    Spacer(Modifier.height(10.dp))
                    ResolutionAndDpiSelectors(settings, onUpdateSettings, include180 = true)
                    FpsAndVbrSelectors(settings, onUpdateSettings)
                    Spacer(Modifier.height(8.dp))
                    SwitchRow(
                        title = "Кнопки «Домой» / «Назад» для VirtualDisplay",
                        subtitle = "Отправка KEYCODE_HOME (3) и KEYCODE_BACK (4) на второй экран",
                        checked = settings.shizukuVdNavButtonsEnabled,
                        onCheckedChange = { onUpdateSettings(settings.copy(shizukuVdNavButtonsEnabled = it)) }
                    )
                    if (settings.shizukuVdNavButtonsEnabled) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                            OutlinedButton(
                                onClick = { onUpdateSettings(settings.copy(shizukuVdNavButtonsLayout = ShizukuVdNavLayout.DOCK)) },
                                modifier = Modifier.weight(1f)
                            ) { Text("Боковой док") }
                            OutlinedButton(
                                onClick = { onUpdateSettings(settings.copy(shizukuVdNavButtonsLayout = ShizukuVdNavLayout.FLOATING)) },
                                modifier = Modifier.weight(1f)
                            ) { Text("Плавающая панель") }
                        }
                        Spacer(Modifier.height(6.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                            OutlinedButton(onClick = { onTestShizukuKeyEvent(3) }, modifier = Modifier.weight(1f)) {
                                Text("Домой (VD)")
                            }
                            OutlinedButton(onClick = { onTestShizukuKeyEvent(4) }, modifier = Modifier.weight(1f)) {
                                Text("Назад (VD)")
                            }
                        }
                    }
                }
            }
        }

        // 3. Блок «Общие настройки (Звук и USB)»
        SettingsCard {
            Text("Общие настройки (Звук и USB)", color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(8.dp))
            SwitchRow(
                title = "Передавать звук по USB (канал 0x0003)",
                subtitle = "AudioPlaybackCapture 48 кГц Stereo PCM",
                checked = settings.transmitAudioOverUsb,
                onCheckedChange = { onUpdateSettings(settings.copy(transmitAudioOverUsb = it)) }
            )
            SwitchRow(
                title = "Глушить динамик телефона при USB-звуке",
                subtitle = "Обнуляет STREAM_MUSIC на время трансляции и восстанавливает при отключении",
                checked = settings.mutePhoneSpeakerDuringUsbAudio,
                onCheckedChange = { onUpdateSettings(settings.copy(mutePhoneSpeakerDuringUsbAudio = it)) }
            )
            Text(
                text = "• Звонки (HFP) работают через штатный Bluetooth ГУ",
                color = AccentCyan,
                fontSize = 12.sp,
                modifier = Modifier.padding(vertical = 6.dp)
            )
            SwitchRow(
                title = "Автозапуск при подключении кабеля USB",
                subtitle = "Стартует сервис AOA при USB_ACCESSORY_ATTACHED",
                checked = settings.autoStartOnUsbAttach,
                onCheckedChange = { onUpdateSettings(settings.copy(autoStartOnUsbAttach = it)) }
            )
        }

        // 4. Сворачиваемый блок «Инженерная диагностика (AOA & Protocol Lab)»
        SettingsCard {
            Card(
                onClick = { diagnosticsExpanded = !diagnosticsExpanded },
                colors = CardDefaults.cardColors(containerColor = CardDark)
            ) {
                Text(
                    text = if (diagnosticsExpanded) "▲ Инженерная диагностика (AOA & Protocol Lab)"
                    else "▼ Инженерная диагностика (AOA & Protocol Lab)",
                    color = TextPrimary,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)
                )
            }
            AnimatedVisibility(visible = diagnosticsExpanded) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
                    SwitchRow(
                        title = "Логировать пакеты в UI",
                        subtitle = "Выкл по умолчанию для плавности интерфейса",
                        checked = settings.logPacketsInUi,
                        onCheckedChange = { onUpdateSettings(settings.copy(logPacketsInUi = it)) }
                    )
                    SwitchRow(
                        title = "Тест-карта (Canvas)",
                        subtitle = "Отладка видеоканала 0x0002",
                        checked = settings.canvasTestCardEnabled,
                        onCheckedChange = { onUpdateSettings(settings.copy(canvasTestCardEnabled = it)) }
                    )
                    (0x0001..0x0006).forEach { ch ->
                        Text(
                            text = "Канал 0x000${ch}: ${channelPacketCounts[ch] ?: 0L} пакетов",
                            color = TextSecondary,
                            fontSize = 12.sp
                        )
                    }
                    Button(
                        onClick = onScanUsbAoa,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = AccentCyan)
                    ) {
                        Text("Scan & Attach USB AOA", color = Color(0xFF001D24))
                    }
                }
            }
        }
    }
}

@Composable
private fun SettingsCard(
    borderColor: Color = BorderDark,
    content: @Composable () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = CardDark),
        border = BorderStroke(1.dp, borderColor),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) { content() }
    }
}

@Composable
private fun SwitchRow(
    title: String,
    subtitle: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f).padding(end = 8.dp)) {
            Text(title, color = TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Medium)
            Text(subtitle, color = TextSecondary, fontSize = 11.sp)
        }
        Switch(checked = checked, onCheckedChange = onCheckedChange)
    }
}

@Composable
private fun ResolutionAndDpiSelectors(
    settings: BridgeSettings,
    onUpdateSettings: (BridgeSettings) -> Unit,
    include180: Boolean
) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
        listOf(800 to 480, 1024 to 600, 1280 to 720).forEach { (w, h) ->
            OutlinedButton(
                onClick = { onUpdateSettings(settings.copy(width = w, height = h)) },
                modifier = Modifier.weight(1f)
            ) {
                Text("${w}×${h}", fontSize = 11.sp, color = if (settings.width == w) AccentCyan else TextPrimary)
            }
        }
    }
    Spacer(Modifier.height(6.dp))
    val dpis = if (include180) listOf(160, 180, 200) else listOf(160, 200)
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
        dpis.forEach { dpi ->
            OutlinedButton(
                onClick = { onUpdateSettings(settings.copy(densityDpi = dpi)) },
                modifier = Modifier.weight(1f)
            ) {
                Text("$dpi dpi", fontSize = 11.sp, color = if (settings.densityDpi == dpi) AccentCyan else TextPrimary)
            }
        }
    }
}

@Composable
private fun FpsAndVbrSelectors(
    settings: BridgeSettings,
    onUpdateSettings: (BridgeSettings) -> Unit
) {
    Spacer(Modifier.height(6.dp))
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
        listOf(25, 30).forEach { fps ->
            OutlinedButton(
                onClick = { onUpdateSettings(settings.copy(fps = fps)) },
                modifier = Modifier.weight(1f)
            ) {
                Text("$fps fps VBR", fontSize = 11.sp, color = if (settings.fps == fps) AccentCyan else TextPrimary)
            }
        }
    }
}
