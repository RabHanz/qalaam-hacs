/**
 * Surah reader — verses with tap-to-deep-study.
 * Hits /v1/chapters/:id/verses against the live backend.
 */
import Constants from 'expo-constants';
import { Link, useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Verse {
  verseKey: string;
  surah: number;
  ayah: number;
  textUthmani: string;
}

const API_BASE: string =
  (Constants.expoConfig?.extra as { apiBase?: string } | undefined)?.apiBase ??
  'http://10.0.2.2:4111';

export default function ReadSurahScreen(): ReactNode {
  const { surah } = useLocalSearchParams<{ surah: string }>();
  const [verses, setVerses] = useState<readonly Verse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const res = await fetch(`${API_BASE}/v1/chapters/${surah}/verses`);
        if (!res.ok) throw new Error(`HTTP ${res.status.toString()}`);
        const body = (await res.json()) as { verses: Verse[] };
        if (!cancelled) setVerses(body.verses);
      } catch {
        if (!cancelled) setVerses([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [surah]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator size="large" color="#b6862c" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.title}>Surah {surah}</Text>
      <FlatList
        data={verses}
        keyExtractor={(v) => v.verseKey}
        renderItem={({ item }) => (
          <Link href={`/study/${item.verseKey}`} asChild>
            <Pressable style={styles.row}>
              <View style={styles.ayahNumberCircle}>
                <Text style={styles.ayahNumber}>{item.ayah.toString()}</Text>
              </View>
              <Text style={styles.arabic}>{item.textUthmani}</Text>
            </Pressable>
          </Link>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fafafa', padding: 16 },
  title: { fontSize: 24, fontWeight: '600', color: '#1b4d5a', marginBottom: 12 },
  row: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  ayahNumberCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#b6862c20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ayahNumber: { fontSize: 12, color: '#b6862c', fontVariant: ['tabular-nums'], fontWeight: '600' },
  arabic: { flex: 1, fontSize: 24, lineHeight: 44, color: '#1b4d5a', textAlign: 'right' },
});
