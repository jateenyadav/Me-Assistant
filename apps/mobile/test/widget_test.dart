import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lifeos_mobile/main.dart';

void main() {
  testWidgets('starts signed out with explicit capture consent', (tester) async {
    await tester.pumpWidget(const LifeOsApp());
    expect(find.text('Sign in'), findsOneWidget);
    expect(find.byType(TextField), findsNWidgets(2));
    expect(find.textContaining('forward-only'), findsOneWidget);
  });
}
