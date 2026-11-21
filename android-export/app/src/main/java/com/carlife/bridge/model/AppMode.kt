package com.carlife.bridge.model

enum class AppMode(val title: String, val subtitle: String) {
    COCKPIT(
        title = "Кокпит",
        subtitle = "Встроенный лаунчер на VirtualDisplay"
    ),
    MIRRORING(
        title = "Зеркалирование",
        subtitle = "Захват экрана телефона через MediaProjection"
    ),
    SHIZUKU_COCKPIT(
        title = "Кокпит + Shizuku",
        subtitle = "Независимый второй экран для любых приложений"
    )
}

enum class ShizukuStatus(val badgeText: String) {
    RUNNING_GRANTED("Активен и разрешён"),
    NO_PERMISSION("Нет прав"),
    NOT_RUNNING("Не запущен")
}

enum class ShizukuVdNavLayout {
    DOCK,
    FLOATING
}

data class BridgeSettings(
    val appMode: AppMode = AppMode.MIRRORING,
    val width: Int = 1280,
    val height: Int = 720,
    val fps: Int = 30,
    val bitrateBps: Int = 2_000_000,
    val densityDpi: Int = 160,
    // Режим «Кокпит»
    val launcherVisiblePackages: Set<String> = emptySet(),
    // Режим «Зеркалирование»
    val keepPhoneScreenOn: Boolean = true,
    val forceLandscapeMirroring: Boolean = false,
    // Режим «Кокпит + Shizuku»
    val shizukuVdNavButtonsEnabled: Boolean = true,
    val shizukuVdNavButtonsLayout: ShizukuVdNavLayout = ShizukuVdNavLayout.DOCK,
    // Общие настройки (Звук и USB)
    val transmitAudioOverUsb: Boolean = true,
    val mutePhoneSpeakerDuringUsbAudio: Boolean = true,
    val autoStartOnUsbAttach: Boolean = true,
    // Инженерная диагностика
    val logPacketsInUi: Boolean = false,
    val canvasTestCardEnabled: Boolean = false,
    val useNestedVideoMsgHeaderAoA20B: Boolean = true
)
