# LifeOS mobile — Android capture and iOS email fallback

Flutter shell + native Android `NotificationListenerService`. Log in with your LifeOS
email/password, explicitly enable capture in the app, and grant Android notification
listener access. Only **new** notifications from the four supported UPI app package
IDs are parsed; the listener never queries existing/active notifications. Ambiguous
messages, OTPs, failed or requested payments are discarded. The private, no-backup
queue contains only parsed amount/direction/time/event fingerprint/optional UPI ID,
not the original notification. Sign-out clears the queue and disables capture.

The iOS Flutter runner is present. iOS never invokes the Android notification
channel; instead, signed-in users can paste a completed payment email, preview
the parsed amount and direction, select the actual payment timestamp and category,
and explicitly confirm import. This is **not** connected mailbox sync or automated
deduplication. The raw text is sent to the API for parsing but is not stored.

Opening the app syncs queued events to authenticated, idempotent API endpoints.
Unknown UPI IDs appear as category choices; a previously categorized ID is filed
automatically. No background server sync: the app must open for upload. Mobile
sessions are memory-only for now, so a process restart requires sign-in again.
Access-token refresh works while the app is open.

Run the API and then `flutter run` from this directory on an Android emulator
(default API URL `http://10.0.2.2:4000` in debug) or pass
`--dart-define=API_BASE_URL=https://your-api.example` on a physical phone.
For an iOS simulator in debug mode the default is `http://localhost:4000` and
local networking is enabled; an Android emulator uses `http://10.0.2.2:4000`.
Only HTTPS API URLs are accepted in release. The Android debug manifest permits
cleartext for local emulator testing; the release manifest does not. Run
`flutter analyze`, `flutter test`, and `flutter build apk --debug` here. To test
the native parser, from `android/` run `JAVA_HOME=<Android Studio JDK path>
./gradlew :app:testDebugUnitTest`. Run `flutter build ios --simulator` on macOS
with Xcode to build the iOS runner. The iOS sign-in screen was launched on an
iPhone 17 Pro simulator; signed-in iOS/Android device flows remain unverified.

The Gradle wrapper files are versioned so a fresh clone can run the native tests.
No physical-device notification capture has been verified yet. Parser fixtures,
vendor-specific message tuning, bank-app support, Android store disclosure/privacy
review, consented mailbox access, and release/store checks remain open. Mobile
sessions are still memory-only, and the other LifeOS modules are web-only so far.
