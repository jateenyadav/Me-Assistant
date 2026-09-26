import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lifeos_mobile/main.dart';

void main() {
  testWidgets('starts signed out without requesting capture', (tester) async {
    await tester.pumpWidget(const LifeOsApp());
    expect(find.text('Sign in'), findsOneWidget);
    expect(find.byType(TextField), findsNWidgets(2));
    if (Platform.isAndroid) {
      expect(find.textContaining('forward-only'), findsOneWidget);
    } else {
      expect(find.textContaining('payment emails'), findsOneWidget);
    }
  });
}
