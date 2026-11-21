package com.carlife.bridge.touch

import android.accessibilityservice.AccessibilityService
import android.content.ComponentName
import android.content.Context
import android.provider.Settings
import android.view.accessibility.AccessibilityEvent

class CarLifeAccessibilityService : AccessibilityService() {

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // Обработка касаний выполняется через dispatchGesture в CarLifeTouchRouter
    }

    override fun onInterrupt() {
        // Нет активных очередей
    }

    override fun onDestroy() {
        if (instance === this) {
            instance = null
        }
        super.onDestroy()
    }

    fun performHome() {
        performGlobalAction(GLOBAL_ACTION_HOME)
    }

    fun performBack() {
        performGlobalAction(GLOBAL_ACTION_BACK)
    }

    companion object {
        @Volatile
        var instance: CarLifeAccessibilityService? = null
            private set

        fun isEnabled(context: Context): Boolean {
            if (instance != null) return true
            val expected = ComponentName(context, CarLifeAccessibilityService::class.java).flattenToString()
            val enabledServices = Settings.Secure.getString(
                context.contentResolver,
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            ) ?: return false
            return enabledServices.split(':').any { it.equals(expected, ignoreCase = true) }
        }
    }
}
