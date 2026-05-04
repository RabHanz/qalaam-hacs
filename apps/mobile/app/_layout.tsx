/**
 * Root layout — tab navigator across the four primary mobile flows.
 * Per Phase 12 / ADR-0013.
 */
import { Stack } from 'expo-router';
import type { ReactNode } from 'react';

export default function RootLayout(): ReactNode {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#1b4d5a' },
        headerTintColor: '#ffffff',
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Qalaam' }} />
      <Stack.Screen name="read/[surah]" options={{ title: 'Read' }} />
      <Stack.Screen name="study/[verseKey]" options={{ title: 'Deep study' }} />
      <Stack.Screen name="hifdh" options={{ title: 'Hifdh' }} />
    </Stack>
  );
}
