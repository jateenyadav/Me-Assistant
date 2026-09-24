# LifeOS mobile — Android payment capture (Phase 1)

Flutter shell + native Android `NotificationListenerService`. Log in with your LifeOS
email/password, explicitly enable capture in the app, and grant Android notification
listener access. Only **new** notifications from the four supported UPI app package
IDs are parsed; the listener never queries existing/active notifications. Ambiguous
messages, OTPs, failed or requested payments are discarded. The private, no-backup
queue contains only parsed amount/direction/time/event fingerprint/optional UPI ID,
not the original notification. Sign-out clears the queue and disables capture.

Opening the app syncs queued events to authenticated, idempotent API endpoints.
Unknown UPI IDs appear as category choices; a previously categorized ID is filed
automatically. No background server sync: the app must open for upload. Mobile
sessions are memory-only for now, so a process restart requires sign-in again.
Access-token refresh works while the app is open.

Run the API and then `flutter run` from this directory on an Android emulator
(default API URL `http://10.0.2.2:4000` in debug) or pass
`--dart-define=API_BASE_URL=https://your-api.example` on a physical phone.
Only HTTPS API URLs are accepted in release. The Android debug manifest permits
cleartext for local emulator testing; the release manifest does not. Run
`flutter analyze`, `flutter test`, and `flutter build apk --debug` here. To test
the native parser, from `android/` run `JAVA_HOME=<Android Studio JDK path>
./gradlew :app:testDebugUnitTest`.

The Gradle wrapper files are versioned so a fresh clone can run the native tests.
No physical-device notification capture has been verified yet. Parser fixtures,
vendor-specific message tuning, bank-app support, Android store disclosure/privacy
review, and the iOS/email path remain open. This Android-only scaffold intentionally
does not imply an iOS app has been built.
