# Нативный пакет Android (Kotlin / AIDL / Gradle) — CarLife Bridge

Все подготовленные файлы в папке `android-export/` предназначены для переноса в ваш Android Studio / Gradle-проект (базовый пакет `com.carlife.bridge`) и последующей сборки `.apk`.

## Состав пакета
1. `app/build.gradle.kts` — зависимости `dev.rikka.shizuku:api:13.1.5`, `dev.rikka.shizuku:provider:13.1.5`, Jetpack Compose и включённый `aidl = true`.
2. `app/src/main/AndroidManifest.xml` — `rikka.shizuku.ShizukuProvider`, `CarLifeAccessibilityService`, `BridgeForegroundService` (`mediaProjection|connectedDevice`), разрешения и фильтр `USB_ACCESSORY_ATTACHED`.
3. `app/src/main/aidl/com/carlife/bridge/ICarLifeShizukuService.aidl` — AIDL-интерфейс для запуска приложений и ввода на втором `VirtualDisplay`.
4. `model/AppMode.kt` — enum `AppMode` (`COCKPIT`, `MIRRORING`, `SHIZUKU_COCKPIT`), `ShizukuStatus`, `BridgeSettings`.
5. `video/MediaCodecEncoderConfig.kt` — настройка H.264 `MediaCodec` по `MediaFormatUtils.smali` (`1280×720`, `25/30 fps`, `2_000_000`, `BITRATE_MODE_VBR`, `AVCProfileBaseline`, `AVCLevel3`, `KEY_REPEAT_PREVIOUS_FRAME_AFTER = 100_000L`, `KEY_PRIORITY = 0`, `video-qp-p-max = 36`, `densityDpi = 160..200`).
6. `transport/UsbTxTransportEngine.kt` — приоритетный поток отправки USB AOA на `LinkedBlockingQueue` (`THREAD_PRIORITY_URGENT_AUDIO`, приоритет `0x0003` над `0x0002`, сброс устаревших P-кадров при очереди > 5).
7. `audio/UsbAudio0x0003Capture.kt` — захват `AudioPlaybackCapture` (`48 кГц Stereo PCM`, 4096B) с сохранением/глушением и восстановлением `STREAM_MUSIC`.
8. `touch/CarLifeTouchRouter.kt` — строгая маршрутизация `0x0006` по режимам (`decorView.dispatchTouchEvent` / `CarLifeAccessibilityService.dispatchGesture` / `ICarLifeShizukuService.injectTouch`).
9. `shizuku/CarLifeShizukuService.kt` и `shizuku/ShizukuBridgeManager.kt` — реализация AIDL `UserService`, привязка Shizuku и переходы в Shizuku / «Параметры разработчика».
10. `ui/UnifiedSettingsScreen.kt` — реорганизованный Compose-экран «Настройки» с 4 блоками и сворачиваемой инструкцией Shizuku.

## Сборка APK в Android Studio / терминале
Скопируйте файлы в ваш Android-проект (заменив пакет `com.carlife.bridge` на ваш, если он отличается) и выполните:
```bash
./gradlew assembleDebug
```
Готовый APK появится в `app/build/outputs/apk/debug/app-debug.apk`.
