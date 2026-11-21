package com.carlife.bridge.shizuku

import android.annotation.SuppressLint
import android.content.Context
import android.hardware.input.InputManager
import android.os.Build
import android.view.InputDevice
import android.view.InputEvent
import android.view.MotionEvent
import com.carlife.bridge.ICarLifeShizukuService
import kotlin.system.exitProcess

/**
 * Фоновый Shizuku UserService, работающий с привилегиями ADB/root через AIDL.
 */
class CarLifeShizukuService : ICarLifeShizukuService.Stub() {

    private val inputManager: InputManager? by lazy {
        runCatching {
            val activityThread = Class.forName("android.app.ActivityThread")
            val currentApp = activityThread.getMethod("currentApplication").invoke(null) as? Context
            currentApp?.getSystemService(Context.INPUT_SERVICE) as? InputManager
        }.getOrNull()
    }

    override fun launchAppOnDisplay(packageName: String, activityName: String, displayId: Int) {
        val cmd = if (activityName.isNotBlank()) {
            arrayOf("sh", "-c", "am start --display $displayId -n $packageName/$activityName")
        } else {
            arrayOf(
                "sh",
                "-c",
                "am start --display $displayId -a android.intent.action.MAIN -c android.intent.category.LAUNCHER $packageName"
            )
        }
        runCatching { ProcessBuilder(*cmd).start() }
    }

    @SuppressLint("PrivateApi")
    override fun injectTouch(
        action: Int,
        x: Float,
        y: Float,
        downTime: Long,
        eventTime: Long,
        displayId: Int
    ) {
        val im = inputManager ?: return
        val event = MotionEvent.obtain(downTime, eventTime, action, x, y, 0).apply {
            source = InputDevice.SOURCE_TOUCHSCREEN
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val setDisplayId = MotionEvent::class.java.getMethod(
                    "setDisplayId",
                    Int::class.javaPrimitiveType
                )
                setDisplayId.invoke(event, displayId)
            }
            val injectInputEvent = InputManager::class.java.getMethod(
                "injectInputEvent",
                InputEvent::class.java,
                Int::class.javaPrimitiveType
            )
            // INJECT_INPUT_EVENT_MODE_ASYNC = 0
            injectInputEvent.invoke(im, event, 0)
        } catch (_: Throwable) {
            // Запасной ввод через input tap на указанном displayId при тапе ACTION_DOWN
            if (action == MotionEvent.ACTION_DOWN) {
                runCatching {
                    ProcessBuilder("input", "-d", displayId.toString(), "tap", x.toInt().toString(), y.toInt().toString()).start()
                }
            }
        } finally {
            event.recycle()
        }
    }

    override fun sendKeyEvent(keyCode: Int, displayId: Int) {
        runCatching {
            ProcessBuilder("input", "-d", displayId.toString(), "keyevent", keyCode.toString()).start()
        }
    }

    override fun destroy() {
        exitProcess(0)
    }
}
