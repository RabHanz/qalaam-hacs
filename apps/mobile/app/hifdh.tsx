/**
 * Hifdh dashboard — streak + portions due + mutashabihat watch.
 * Per Phase 12. Hits /v1/hifdh/state.
 */
import Constants from 'expo-constants';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface HifdhState {
  user_id: string;
  streak_days: number;
  grace_days_remaining: number;
  current_sabqi: string | null;
  manzil_cycle_position: string | null;
  weakest_pages: string[];
  mutashabihat_watchlist: string[];
  today_session_count: number;
}

const API_BASE: string =
  (Constants.expoConfig?.extra as { apiBase?: string } | undefined)?.apiBase ??
  'http://10.0.2.2:4111';

export default function HifdhScreen(): ReactNode {
  const [state, setState] = useState<HifdhState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const res = await fetch(`${API_BASE}/v1/hifdh/state?user_id=demo-user`);
        if (res.ok && !cancelled) setState((await res.json()) as HifdhState);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator size="large" color="#b6862c" />
      </SafeAreaView>
    );
  }

  if (!state) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.empty}>Backend unreachable.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.streakCard}>
          <Text style={styles.streakLabel}>Streak</Text>
          <Text style={styles.streakDays}>{state.streak_days.toString()} days</Text>
          <Text style={styles.graceText}>
            {state.grace_days_remaining.toString()} grace days remaining this month
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Today</Text>
          <Text style={styles.cardBody}>{state.today_session_count.toString()} portions due</Text>
          {state.current_sabqi ? (
            <Text style={styles.cardBody}>Current sabqi: {state.current_sabqi}</Text>
          ) : null}
          {state.manzil_cycle_position ? (
            <Text style={styles.cardBody}>Manzil cycle: {state.manzil_cycle_position}</Text>
          ) : null}
        </View>

        {state.weakest_pages.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Weakest pages</Text>
            <Text style={styles.cardBody}>{state.weakest_pages.join(' · ')}</Text>
          </View>
        ) : null}

        {state.mutashabihat_watchlist.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Mutashabihat watch</Text>
            <Text style={styles.cardBody}>{state.mutashabihat_watchlist.join(' · ')}</Text>
          </View>
        ) : null}

        <Text style={styles.disclaimer}>
          Family-private. Daily summary only — never real-time alerts.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fafafa' },
  content: { padding: 16, gap: 14 },
  streakCard: {
    backgroundColor: '#1b4d5a',
    padding: 18,
    borderRadius: 14,
  },
  streakLabel: { color: '#cce4ec', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  streakDays: { color: '#ffffff', fontSize: 36, fontWeight: '700', marginTop: 4 },
  graceText: { color: '#cce4ec', fontSize: 13, marginTop: 6 },
  card: { backgroundColor: '#ffffff', padding: 14, borderRadius: 12 },
  cardTitle: {
    fontSize: 13,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  cardBody: { fontSize: 16, color: '#1b4d5a', marginTop: 2 },
  disclaimer: { fontSize: 12, color: '#999', textAlign: 'center', marginTop: 6 },
  empty: { padding: 24, fontSize: 14, color: '#999', textAlign: 'center' },
});
