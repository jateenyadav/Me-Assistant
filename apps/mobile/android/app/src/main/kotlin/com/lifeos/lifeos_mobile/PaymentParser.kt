package com.lifeos.lifeos_mobile

data class ParsedPayment(val amountMinor: Long, val type: String, val upiId: String?)

object PaymentParser {
    private val amount = Regex("(?i)(?:₹|(?:rs|inr)\\.?\\s*)(?:\\s*)([0-9][0-9,]*(?:\\.[0-9]{1,2})?)")
    private val expense = Regex("(?i)\\b(?:paid|debited|sent|payment successful)\\b")
    private val income = Regex("(?i)\\b(?:received|credited)\\b")
    private val excluded = Regex("(?i)\\b(?:otp|one.time password|request|pending|failed|declined|reversed|refund|collect)\\b")
    private val recipient = Regex("(?i)\\bto\\s+(?:vpa\\s+|upi id\\s+)?([a-z0-9._-]{2,}@[a-z0-9.-]{2,})\\b")
    private val sender = Regex("(?i)\\bfrom\\s+([a-z0-9._-]{2,}@[a-z0-9.-]{2,})\\b")

    fun parse(text: String): ParsedPayment? {
        if (excluded.containsMatchIn(text)) return null
        val isExpense = expense.containsMatchIn(text)
        val isIncome = income.containsMatchIn(text)
        if (isExpense == isIncome) return null
        val amountText = amount.findAll(text).map { it.groupValues[1] }.distinct().singleOrNull() ?: return null
        val parts = amountText.replace(",", "").split(".")
        val rupees = parts[0].toLongOrNull() ?: return null
        val paise = parts.getOrNull(1)?.padEnd(2, '0')?.toLongOrNull() ?: 0
        if (rupees > 999_999_999 || (rupees == 0L && paise == 0L)) return null
        val upiId = (if (isExpense) recipient else sender).find(text)?.groupValues?.get(1)?.lowercase()
        return ParsedPayment(rupees * 100 + paise, if (isExpense) "expense" else "income", upiId)
    }
}
