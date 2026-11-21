package com.carlife.bridge.shizuku

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.content.pm.PackageManager
import android.net.Uri
import android.os.IBinder
import android.provider.Settings
import com.carlife.bridge.ICarLifeShizukuService
import com.carlife.bridge.model.ShizukuStatus
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import rikka.shizuku.Shizuku

class ShizukuBridgeManager(private val context: Context) {

    private val _status = MutableStateFlow(computeStatus())
    val status: StateFlow<ShizukuStatus> = _status.asStateFlow()

    @Volatile
    var userService: ICarLifeShizukuService? = null
        private set

    private val userServiceArgs by lazy {
        Shizuku.UserServiceArgs(ComponentName(context, CarLifeShizukuService::class.java))
            .daemon(false)
            .processNameSuffix("shizuku_service")
            .debuggable(false)
            .version(1)
    }

    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
            userService = if (binder != null && binder.pingBinder()) {
                ICarLifeShizukuService.Stub.asInterface(binder)
            } else {
                null
            }
            refreshStatus()
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            userService = null
            refreshStatus()
        }
    }

    fun computeStatus(): ShizukuStatus {
        val alive = runCatching { Shizuku.pingBinder() }.getOrDefault(false)
        if (!alive) return ShizukuStatus.NOT_RUNNING
        val granted = runCatching {
            Shizuku.checkSelfPermission() == PackageManager.PERMISSION_GRANTED
        }.getOrDefault(false)
        return if (granted) ShizukuStatus.RUNNING_GRANTED else ShizukuStatus.NO_PERMISSION
    }

    fun refreshStatus() {
        _status.value = computeStatus()
    }

    fun requestPermission() {
        if (!Shizuku.pingBinder()) {
            refreshStatus()
            return
        }
        if (Shizuku.checkSelfPermission() != PackageManager.PERMISSION_GRANTED) {
            Shizuku.requestPermission(SHIZUKU_REQ_CODE)
        } else {
            bindService()
        }
    }

    fun bindService() {
        if (computeStatus() == ShizukuStatus.RUNNING_GRANTED && userService == null) {
            runCatching { Shizuku.bindUserService(userServiceArgs, serviceConnection) }
        }
    }

    fun unbindService() {
        runCatching { Shizuku.unbindUserService(userServiceArgs, serviceConnection, true) }
        userService = null
    }

    fun openShizukuApp() {
        val launchIntent = context.packageManager.getLaunchIntentForPackage(SHIZUKU_PACKAGE)
        if (launchIntent != null) {
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(launchIntent)
        } else {
            val marketIntent = Intent(
                Intent.ACTION_VIEW,
                Uri.parse("market://details?id=$SHIZUKU_PACKAGE")
            ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            runCatching { context.startActivity(marketIntent) }
        }
    }

    fun openDeveloperSettings() {
        val devIntent = Intent(Settings.ACTION_APPLICATION_DEVELOPMENT_SETTINGS)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        val started = runCatching { context.startActivity(devIntent) }.isSuccess
        if (!started) {
            val fallback = Intent(Settings.ACTION_DEVICE_INFO_SETTINGS)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            runCatching { context.startActivity(fallback) }
        }
    }

    companion object {
        const val SHIZUKU_REQ_CODE = 1001
        const val SHIZUKU_PACKAGE = "moe.shizuku.privileged.api"
    }
}
