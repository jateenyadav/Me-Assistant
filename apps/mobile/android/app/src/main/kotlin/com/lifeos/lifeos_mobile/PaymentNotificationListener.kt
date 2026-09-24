package com.lifeos.lifeos_mobile

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import java.security.MessageDigest
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import org.json.JSONObject

class PaymentNotificationListener : NotificationListenerService() {
    override fun onNotificationPosted(sbn: StatusBarNotification) {
        if (!PaymentQueue.isCapturing(this)) return
        if (sbn.packageName !in setOf("com.google.android.apps.nbu.paisa.user", "com.phonepe.app", "net.one97.paytm", "in.org.npci.upiapp")) return
        val notification = sbn.notification
        val title = notification.extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
        val body = (notification.extras.getCharSequence(Notification.EXTRA_BIG_TEXT)
            ?: notification.extras.getCharSequence(Notification.EXTRA_TEXT))?.toString().orEmpty()
        val parsed = PaymentParser.parse("$title $body") ?: return
        val eventId = MessageDigest.getInstance("SHA-256")
            .digest("${sbn.packageName}:${sbn.key}:${sbn.postTime}".toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
        val event = JSONObject().put("eventId", eventId)
            .put("amountMinor", parsed.amountMinor)
            .put("type", parsed.type)
            .put("occurredAt", SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
                timeZone = TimeZone.getTimeZone("UTC")
            }.format(Date(sbn.postTime)))
        if (parsed.upiId != null) event.put("upiId", parsed.upiId)
        if (PaymentQueue.add(this, event)) showReviewAlert(eventId)
    }

    private fun showReviewAlert(eventId: String) {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        val manager = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= 26) {
            manager.createNotificationChannel(NotificationChannel("finance_review", "Payment review", NotificationManager.IMPORTANCE_DEFAULT))
        }
        val intent = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, "finance_review") else Notification.Builder(this)
        val alert = builder
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Review a payment in LifeOS")
            .setContentText("Open LifeOS to sync and review if needed.")
            .setContentIntent(intent).setAutoCancel(true).build()
        manager.notify(eventId.take(8).toLong(16).toInt(), alert)
    }
}
