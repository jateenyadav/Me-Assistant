package com.lifeos.lifeos_mobile

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

object PaymentQueue {
    private val lock = Any()

    private fun prefs(context: Context) = context.getSharedPreferences("payment_capture", Context.MODE_PRIVATE)

    fun isCapturing(context: Context): Boolean = synchronized(lock) {
        prefs(context).getBoolean("active", false)
    }

    fun isActive(context: Context, userId: String?): Boolean = synchronized(lock) {
        userId != null && prefs(context).getString("userId", null) == userId && prefs(context).getBoolean("active", false)
    }

    fun activate(context: Context, userId: String): Boolean = synchronized(lock) {
        val preferences = prefs(context)
        val editor = preferences.edit()
        if (preferences.getString("userId", null) != userId) {
            editor.clear().putString("userId", userId).putString("events", "[]")
        }
        editor.putBoolean("active", true).commit()
    }

    fun deactivate(context: Context): Boolean = synchronized(lock) {
        prefs(context).edit().clear().commit()
    }

    fun add(context: Context, event: JSONObject): Boolean = synchronized(lock) {
        val preferences = prefs(context)
        if (!preferences.getBoolean("active", false)) return@synchronized false
        val events = JSONArray(preferences.getString("events", "[]"))
        if ((0 until events.length()).any { events.getJSONObject(it).getString("eventId") == event.getString("eventId") }) return@synchronized false
        val retained = JSONArray()
        for (index in 0 until events.length()) retained.put(events.getJSONObject(index))
        retained.put(event)
        preferences.edit().putString("events", retained.toString()).commit()
    }

    fun pending(context: Context): List<Map<String, Any>> = synchronized(lock) {
        val events = JSONArray(prefs(context).getString("events", "[]"))
        (0 until events.length()).map { index ->
            val event = events.getJSONObject(index)
            buildMap<String, Any> {
                put("eventId", event.getString("eventId"))
                put("amountMinor", event.getLong("amountMinor"))
                put("type", event.getString("type"))
                put("occurredAt", event.getString("occurredAt"))
                if (event.has("upiId")) put("upiId", event.getString("upiId"))
            }
        }
    }

    fun ack(context: Context, eventId: String): Boolean = synchronized(lock) {
        val preferences = prefs(context)
        val events = JSONArray(preferences.getString("events", "[]"))
        val retained = JSONArray()
        for (index in 0 until events.length()) {
            val event = events.getJSONObject(index)
            if (event.getString("eventId") != eventId) retained.put(event)
        }
        preferences.edit().putString("events", retained.toString()).commit()
    }
}
