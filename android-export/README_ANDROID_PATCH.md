# CarLife Bridge — Самостоятельный Android-проект (Kotlin + Compose + Shizuku)

Каталог `android-export/` (и архив `carlife-bridge-android-kotlin-patch.zip`) содержит полный Gradle-проект, готовый к облачной сборке APK через GitHub Actions или в Android Studio.

## Структура проекта
- `.github/workflows/build-apk.yml` — автосборка `app-debug.apk` в GitHub Actions (JDK 17 + Android SDK + Gradle 8.10.2).
- `settings.gradle.kts`, `build.gradle.kts`, `gradle.properties`, `gradle/wrapper/gradle-wrapper.properties` — корневая конфигурация Gradle.
- `app/build.gradle.kts` — зависимости Jetpack Compose, `dev.rikka.shizuku:api:13.1.5`, `dev.rikka.shizuku:provider:13.1.5` и включённый `aidl = true`.
- `app/src/main/AndroidManifest.xml` — `ShizukuProvider`, `MainActivity`, `BridgeForegroundService` (`mediaProjection|connectedDevice`), `CarLifeAccessibilityService`, фильтр `USB_ACCESSORY_ATTACHED`.
- `app/src/main/res/` — `accessory_filter.xml`, `carlife_accessibility_config.xml`, `strings.xml`.
- `app/src/main/aidl/com/carlife/bridge/ICarLifeShizukuService.aidl` — AIDL-интерфейс для запуска приложений и ввода на втором экране.
- `app/src/main/java/com/carlife/bridge/`:
  - `MainActivity.kt` — экран настроек, привязка Shizuku, управление `FLAG_KEEP_SCREEN_ON` и альбомной ориентацией.
  - `model/AppMode.kt` — режимы (`COCKPIT`, `MIRRORING`, `SHIZUKU_COCKPIT`), статусы Shizuku и `BridgeSettings`.
  - `video/MediaCodecEncoderConfig.kt` — профиль H.264 VBR Baseline L3 (`MediaFormatUtils.smali`) и создание `VirtualDisplay`.
  - `transport/UsbTxTransportEngine.kt` — приоритетный TX-поток на `LinkedBlockingQueue` (`URGENT_AUDIO`, сброс устаревших P-кадров > 5).
  - `audio/UsbAudio0x0003Capture.kt` — `AudioPlaybackCapture` (`48 кГц Stereo PCM`) + сохранение и глушение `STREAM_MUSIC`.
  - `touch/CarLifeTouchRouter.kt` и `touch/CarLifeAccessibilityService.kt` — строгая маршрутизация тача `0x0006` по режимам.
  - `shizuku/CarLifeShizukuService.kt` и `shizuku/ShizukuBridgeManager.kt` — AIDL `UserService` и переходы в Shizuku / «Параметры разработчика».
  - `service/BridgeForegroundService.kt` — фоновый сервис с `WakeLock` и приоритетной очередью USB.
  - `ui/UnifiedSettingsScreen.kt` — экран «Настройки» с 4 блоками и сворачиваемой инструкцией Shizuku.

## Как собрать APK через GitHub Actions (без Android Studio)
1. Распакуйте `carlife-bridge-android-kotlin-patch.zip` в новый (или пустой) репозиторий GitHub — обязательно вместе со скрытой папкой `.github/`.
2. Откройте репозиторий на GitHub → вкладка **Actions** → **Build Android APK** → нажмите **Run workflow** (или просто сделайте `git push` в `main`/`master`).
3. После завершения сборки скачайте готовый файл внизу страницы в разделе **Artifacts → carlife-bridge-debug-apk** (`app-debug.apk`).
