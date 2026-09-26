import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

const capture = MethodChannel('lifeos/notifications');
const configuredApi = String.fromEnvironment('API_BASE_URL');
final apiBase = configuredApi.isNotEmpty
    ? configuredApi
    : kDebugMode
    ? Platform.isIOS
          ? 'http://localhost:4000'
          : 'http://10.0.2.2:4000'
    : '';
const categories = [
  'food',
  'shopping',
  'transport',
  'bills',
  'health',
  'other',
];

void main() => runApp(const LifeOsApp());

class LifeOsApp extends StatelessWidget {
  const LifeOsApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'LifeOS',
    theme: ThemeData(colorSchemeSeed: Colors.teal, useMaterial3: true),
    home: const FinanceHome(),
  );
}

class FinanceHome extends StatefulWidget {
  const FinanceHome({super.key});

  @override
  State<FinanceHome> createState() => _FinanceHomeState();
}

class _FinanceHomeState extends State<FinanceHome> with WidgetsBindingObserver {
  final email = TextEditingController();
  final password = TextEditingController();
  final paymentEmail = TextEditingController();
  String emailCategory = categories.first;
  DateTime? paymentOccurredAt;
  Map<String, dynamic>? preview;
  String? accessToken;
  String? refreshToken;
  String? userId;
  String? error;
  bool busy = false;
  bool hasAccess = false;
  bool enabled = false;
  bool showDisclosure = true;
  bool alertPermissionAsked = false;
  List<Map<String, dynamic>> pending = [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && userId != null) sync();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    email.dispose();
    password.dispose();
    paymentEmail.dispose();
    super.dispose();
  }

  Future<Map<String, dynamic>> request(
    String method,
    String path, [
    Map<String, dynamic>? body,
    bool retry = true,
  ]) async {
    if (apiBase.isEmpty || (!kDebugMode && !apiBase.startsWith('https://'))) {
      throw Exception('Set an HTTPS API_BASE_URL for release builds.');
    }
    final client = HttpClient();
    try {
      final outgoing = await client.openUrl(method, Uri.parse('$apiBase$path'));
      outgoing.headers.contentType = ContentType.json;
      if (accessToken != null) {
        outgoing.headers.set('Authorization', 'Bearer $accessToken');
      }
      if (body != null) outgoing.write(jsonEncode(body));
      final response = await outgoing.close();
      final text = await utf8.decoder.bind(response).join();
      if (response.statusCode == 401 && retry && refreshToken != null) {
        final renewed = await request('POST', '/auth/refresh', {
          'refreshToken': refreshToken,
        }, false);
        accessToken = renewed['accessToken'] as String;
        refreshToken = renewed['refreshToken'] as String;
        return request(method, path, body, false);
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw Exception(
          'API returned ${response.statusCode}. ${response.statusCode == 401 ? 'Sign in again.' : 'Please retry.'}',
        );
      }
      return text.isEmpty ? {} : jsonDecode(text) as Map<String, dynamic>;
    } finally {
      client.close();
    }
  }

  Future<void> signIn() async {
    if (busy) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final session = await request('POST', '/auth/login', {
        'email': email.text.trim(),
        'password': password.text,
      });
      accessToken = session['accessToken'] as String;
      refreshToken = session['refreshToken'] as String;
      userId = (session['user'] as Map<String, dynamic>)['id'] as String;
      password.clear();
      enabled = Platform.isAndroid
          ? await capture.invokeMethod<bool>('isActive', {'userId': userId}) ??
                false
          : false;
      if (!mounted) return;
      setState(() {
        busy = false;
      });
      await sync();
    } catch (failure) {
      if (mounted) {
        setState(() {
          busy = false;
          error = '$failure';
        });
      }
    }
  }

  Future<void> enableCapture() async {
    if (!Platform.isAndroid || userId == null) return;
    try {
      await capture.invokeMethod<void>('activate', {'userId': userId});
      enabled = true;
      hasAccess = await capture.invokeMethod<bool>('hasAccess') ?? false;
      if (hasAccess) {
        await sync();
      } else {
        await capture.invokeMethod<void>('openSettings');
      }
      if (mounted) setState(() {});
    } catch (failure) {
      if (mounted) {
        setState(() {
          error = '$failure';
        });
      }
    }
  }

  Future<void> sync() async {
    if (busy || userId == null) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      if (Platform.isAndroid) {
        hasAccess = await capture.invokeMethod<bool>('hasAccess') ?? false;
        if (hasAccess && !alertPermissionAsked) {
          alertPermissionAsked = true;
          await capture.invokeMethod<void>('requestAlertPermission');
        }
        final queued =
            await capture.invokeMethod<List<dynamic>>('pending') ?? [];
        for (final entry in queued) {
          final event = Map<String, dynamic>.from(entry as Map);
          await request('POST', '/transactions/notifications', event);
          await capture.invokeMethod<void>('ack', {
            'eventId': event['eventId'],
          });
        }
      }
      await loadPending();
    } catch (failure) {
      if (mounted) {
        setState(() {
          error = '$failure';
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          busy = false;
        });
      }
    }
  }

  Future<void> loadPending() async {
    final result = await request('GET', '/transactions/notifications/pending');
    if (mounted) {
      setState(() {
        pending = (result['notifications'] as List<dynamic>)
            .map((entry) => Map<String, dynamic>.from(entry as Map))
            .toList();
      });
    }
  }

  Future<void> categorize(String id, String category) async {
    if (busy) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await request('PATCH', '/transactions/notifications/$id/category', {
        'category': category,
      });
      await loadPending();
    } catch (failure) {
      if (mounted) {
        setState(() {
          error = '$failure';
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          busy = false;
        });
      }
    }
  }

  Future<void> signOut() async {
    final queued = Platform.isAndroid
        ? await capture.invokeMethod<List<dynamic>>('pending') ?? []
        : <dynamic>[];
    if (queued.isNotEmpty) {
      if (!mounted) return;
      final discard = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Discard unsynced payments?'),
          content: Text(
            '${queued.length} payment(s) are still on this phone and will be deleted when you sign out.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Keep capture on'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Discard and sign out'),
            ),
          ],
        ),
      );
      if (discard != true) return;
    }
    final token = refreshToken;
    if (Platform.isAndroid) await capture.invokeMethod<void>('deactivate');
    accessToken = null;
    refreshToken = null;
    userId = null;
    if (mounted) {
      setState(() {
        pending = [];
        enabled = false;
        showDisclosure = true;
        alertPermissionAsked = false;
        preview = null;
        paymentOccurredAt = null;
        error = null;
      });
    }
    paymentEmail.clear();
    if (token != null) {
      try {
        await request('POST', '/auth/logout', {'refreshToken': token});
      } catch (_) {
        if (mounted) {
          setState(() {
            error = 'Signed out locally; server logout could not be confirmed.';
          });
        }
      }
    }
  }

  Future<void> previewPayment() async {
    if (busy) return;
    setState(() {
      busy = true;
      error = null;
      preview = null;
    });
    try {
      final result = await request('POST', '/transactions/emails/preview', {
        'text': paymentEmail.text.trim(),
      });
      if (mounted) {
        setState(() {
          preview = Map<String, dynamic>.from(result['payment'] as Map);
        });
      }
    } catch (failure) {
      if (mounted) {
        setState(() {
          error = '$failure';
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          busy = false;
        });
      }
    }
  }

  Future<void> choosePaymentTime() async {
    final date = await showDatePicker(
      context: context,
      initialDate: paymentOccurredAt ?? DateTime.now(),
      firstDate: DateTime(2000),
      lastDate: DateTime.now(),
    );
    if (!mounted || date == null) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(paymentOccurredAt ?? DateTime.now()),
    );
    if (!mounted || time == null) return;
    setState(() {
      paymentOccurredAt = DateTime(
        date.year,
        date.month,
        date.day,
        time.hour,
        time.minute,
      );
    });
  }

  Future<void> importPayment() async {
    if (busy || preview == null || paymentOccurredAt == null) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await request('POST', '/transactions/emails', {
        'text': paymentEmail.text.trim(),
        'category': emailCategory,
        'occurredAt': paymentOccurredAt!.toUtc().toIso8601String(),
      });
      if (!mounted) return;
      paymentEmail.clear();
      setState(() {
        preview = null;
        paymentOccurredAt = null;
      });
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Payment saved.')));
    } catch (failure) {
      if (mounted) {
        setState(() {
          error = '$failure';
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          busy = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('LifeOS · Payments')),
    body: ListView(
      padding: const EdgeInsets.all(20),
      children: [
        if (error != null)
          Text(
            error!,
            style: TextStyle(color: Theme.of(context).colorScheme.error),
          ),
        if (userId == null) ...[
          Text(
            Platform.isAndroid
                ? 'Sign in to enable forward-only payment notification capture.'
                : 'Sign in to review and import payment emails.',
          ),
          const SizedBox(height: 12),
          TextField(
            controller: email,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(labelText: 'Email'),
          ),
          TextField(
            controller: password,
            obscureText: true,
            decoration: const InputDecoration(labelText: 'Password'),
          ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: busy ? null : signIn,
            child: const Text('Sign in'),
          ),
        ] else ...[
          if (Platform.isAndroid && !enabled && showDisclosure) ...[
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Payment notification access',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const Text(
                      'LifeOS reads NEW notifications from supported payment apps in the background, even when closed. It extracts amount, direction, time and an optional UPI ID, stores these locally, then uploads the parsed fields when you open the app to record and categorize payments. Full messages are never saved or uploaded. You can stop capture by signing out or revoking access in Android settings.',
                    ),
                    FilledButton(
                      onPressed: enableCapture,
                      child: const Text('I agree · Enable capture'),
                    ),
                    TextButton(
                      onPressed: () => setState(() {
                        showDisclosure = false;
                      }),
                      child: const Text('Not now'),
                    ),
                  ],
                ),
              ),
            ),
          ] else if (Platform.isAndroid && !enabled) ...[
            const Text(
              'Notification capture is off. You can keep using LifeOS without granting access.',
            ),
            TextButton(
              onPressed: () => setState(() {
                showDisclosure = true;
              }),
              child: const Text('Enable capture later'),
            ),
          ] else if (Platform.isAndroid) ...[
            if (!hasAccess)
              FilledButton(
                onPressed: () => capture.invokeMethod<void>('openSettings'),
                child: const Text('Grant notification access'),
              ),
            OutlinedButton(
              onPressed: busy ? null : sync,
              child: const Text('Sync new payments'),
            ),
          ],
          TextButton(
            onPressed: busy ? null : signOut,
            child: Text(
              Platform.isAndroid ? 'Sign out and stop capture' : 'Sign out',
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'Import a payment email',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const Text(
            'Paste a completed payment email. Review the detected amount and direction, choose the actual payment time and a category, then confirm. No inbox access is requested; email text is not stored.',
          ),
          TextField(
            controller: paymentEmail,
            minLines: 3,
            maxLines: 8,
            onChanged: (_) => setState(() {
              preview = null;
            }),
            decoration: const InputDecoration(labelText: 'Payment email text'),
          ),
          OutlinedButton(
            onPressed: busy ? null : previewPayment,
            child: const Text('Preview payment'),
          ),
          if (preview != null) ...[
            Text(
              '${preview!['type'] == 'income' ? 'Received' : 'Spent'} ₹${((preview!['amountMinor'] as num) / 100).toStringAsFixed(2)}',
            ),
            DropdownButton<String>(
              value: emailCategory,
              items: [
                for (final category in categories)
                  DropdownMenuItem(value: category, child: Text(category)),
              ],
              onChanged: (value) => setState(() {
                emailCategory = value ?? emailCategory;
              }),
            ),
            OutlinedButton(
              onPressed: choosePaymentTime,
              child: Text(
                paymentOccurredAt == null
                    ? 'Choose actual payment date and time'
                    : 'Payment time: ${paymentOccurredAt!.toLocal()}',
              ),
            ),
            FilledButton(
              onPressed: busy || paymentOccurredAt == null
                  ? null
                  : importPayment,
              child: const Text('Confirm and save payment'),
            ),
          ],
          const SizedBox(height: 16),
          Text(
            'Needs a category (${pending.length})',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          if (pending.isEmpty)
            const Text(
              'No uncategorized payments. Matched UPI IDs are filed automatically.',
            ),
          for (final item in pending)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${item['type'] == 'income' ? 'Received' : 'Spent'} ₹${((item['amountMinor'] as num) / 100).toStringAsFixed(2)}',
                    ),
                    Text(
                      (item['occurredAt'] as String)
                          .replaceFirst('T', ' ')
                          .split('.')
                          .first,
                    ),
                    Wrap(
                      spacing: 6,
                      children: [
                        for (final category in categories)
                          ActionChip(
                            label: Text(category),
                            onPressed: busy
                                ? null
                                : () => categorize(
                                    item['id'] as String,
                                    category,
                                  ),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
        ],
        if (busy) const Center(child: CircularProgressIndicator()),
      ],
    ),
  );
}
