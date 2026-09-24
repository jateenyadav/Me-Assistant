package com.lifeos.lifeos_mobile

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PaymentParserTest {
    @Test fun parsesPaidRupeesAndCounterparty() {
        val result = PaymentParser.parse("Payment successful: ₹1,234.50 paid to Shop@UPI")
        assertEquals(123450L, result?.amountMinor)
        assertEquals("expense", result?.type)
        assertEquals("shop@upi", result?.upiId)
    }

    @Test fun parsesIncomingPaise() {
        val result = PaymentParser.parse("INR 0.50 received from Alice@Bank")
        assertEquals(50L, result?.amountMinor)
        assertEquals("income", result?.type)
        assertEquals("alice@bank", result?.upiId)
    }

    @Test fun ignoresAmbiguousOrUnconfirmedNotifications() {
        for (text in listOf(
            "OTP 123456: ₹300 paid",
            "Payment request of ₹100 from user@upi",
            "₹100 paid but failed",
            "₹100 credited and debited",
            "₹100 sale today",
            "₹9999999999 paid to shop@upi",
            "₹100 and ₹200 paid",
        )) assertNull(text, PaymentParser.parse(text))
    }
}
