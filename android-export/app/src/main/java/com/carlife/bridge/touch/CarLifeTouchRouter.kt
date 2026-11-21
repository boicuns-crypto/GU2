package com.carlife.bridge.touch

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.app.Presentation
import android.graphics.Path
import android.os.SystemClock
import android.view.MotionEvent
import android.view.WindowManager
import com.carlife.bridge.ICarLifeShizukuService
import com.carlife.bridge.model.AppMode

/**
 * Раздельная маршрутизация канала тача (0x0006) по выбранному AppMode:
 * - COCKPIT: строго presentation.window.decorView.dispatchTouchEvent с сохранением lastDownTime.
 * - MIRRORING: строго CarLifeAccessibilityService.dispatchGesture в bounds экрана смартфона.
 * - SHIZUKU_COCKPIT: строго ICarLifeShizukuService.injectTouch(..., displayId).
 */
class CarLifeTouchRouter(
    private val windowManager: WindowManager,
    private val presentationProvider: () -> Presentation?,
    private val accessibilityServiceProvider: () -> AccessibilityService?,
    private val shizukuServiceProvider: () -> ICarLifeShizukuService?,
    private val shizukuDisplayIdProvider: () -> Int
) {
    private var lastDownTimeMs: Long = 0L

    fun dispatchTouchFromHeadUnit(
        mode: AppMode,
        action: Int,
        rawX: Float,
        rawY: Float,
        huWidth: Int = 1280,
        huHeight: Int = 720
    ) {
        val now = SystemClock.uptimeMillis()
        if (action == MotionEvent.ACTION_DOWN || lastDownTimeMs == 0L) {
            lastDownTimeMs = now
        }
        val downTime = lastDownTimeMs
        if (action == MotionEvent.ACTION_UP || action == MotionEvent.ACTION_CANCEL) {
            lastDownTimeMs = 0L
        }

        val normX = (rawX / huWidth.coerceAtLeast(1)).coerceIn(0f, 1f)
        val normY = (rawY / huHeight.coerceAtLeast(1)).coerceIn(0f, 1f)

        when (mode) {
            AppMode.COCKPIT -> {
                val decor = presentationProvider()?.window?.decorView ?: return
                val targetX = normX * 1280f
                val targetY = normY * 720f
                val ev = MotionEvent.obtain(downTime, now, action, targetX, targetY, 0)
                decor.post {
                    decor.dispatchTouchEvent(ev)
                    ev.recycle()
                }
            }

            AppMode.MIRRORING -> {
                val service = accessibilityServiceProvider() ?: return
                val bounds = windowManager.currentWindowMetrics.bounds
                val phoneX = (normX * bounds.width()).coerceIn(0f, bounds.width().toFloat() - 1f)
                val phoneY = (normY * bounds.height()).coerceIn(0f, bounds.height().toFloat() - 1f)
                val path = Path().apply { moveTo(phoneX, phoneY) }
                val stroke = GestureDescription.StrokeDescription(path, 0L, 45L)
                val gesture = GestureDescription.Builder().addStroke(stroke).build()
                service.dispatchGesture(gesture, null, null)
            }

            AppMode.SHIZUKU_COCKPIT -> {
                val shizuku = shizukuServiceProvider() ?: return
                val displayId = shizukuDisplayIdProvider()
                val targetX = normX * 1280f
                val targetY = normY * 720f
                runCatching {
                    shizuku.injectTouch(action, targetX, targetY, downTime, now, displayId)
                }
            }
        }
    }
}
