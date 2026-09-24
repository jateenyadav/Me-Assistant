package com.lifeos.lifeos_mobile

import android.Manifest
import android.app.NotificationManager
import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "lifeos/notifications").setMethodCallHandler { call, result ->
            when (call.method) {
                "hasAccess" -> result.success(if (Build.VERSION.SDK_INT >= 27) {
                    getSystemService(NotificationManager::class.java)
                        .isNotificationListenerAccessGranted(ComponentName(this, PaymentNotificationListener::class.java))
                } else {
                    Settings.Secure.getString(contentResolver, "enabled_notification_listeners")
                        ?.split(':')?.contains("$packageName/$packageName.PaymentNotificationListener") == true
                })
                "isActive" -> result.success(PaymentQueue.isActive(this, call.argument<String>("userId")))
                "openSettings" -> {
                    startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
                    result.success(null)
                }
                "requestAlertPermission" -> {
                    if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                        requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 10)
                    }
                    result.success(null)
                }
                "activate" -> {
                    val userId = call.argument<String>("userId")
                    if (userId == null) result.error("INVALID_USER", "A user ID is required", null)
                    else {
                        if (PaymentQueue.activate(this, userId)) result.success(null)
                        else result.error("STORAGE_ERROR", "Could not enable capture", null)
                    }
                }
                "deactivate" -> {
                    if (PaymentQueue.deactivate(this)) result.success(null)
                    else result.error("STORAGE_ERROR", "Could not disable capture", null)
                }
                "pending" -> result.success(PaymentQueue.pending(this))
                "ack" -> {
                    val eventId = call.argument<String>("eventId")
                    if (eventId == null) result.error("INVALID_EVENT", "An event ID is required", null)
                    else {
                        if (PaymentQueue.ack(this, eventId)) result.success(null)
                        else result.error("STORAGE_ERROR", "Could not acknowledge payment", null)
                    }
                }
                else -> result.notImplemented()
            }
        }
    }
}
