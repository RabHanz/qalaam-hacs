/**
 * Home — surah picker + quick-jump cards.
 * Per Phase 12. Surahs come from the live Fastify backend (/v1/metadata/surahs).
 */
import Constants from 'expo-constants';
import { Link } from 'expo-router';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Surah {
  surah: number;
  nameArabic: string;
  nameEnglish: string;
  verseCount: number;
  revelationPlace: 'makkah' | 'madinah';
}

const API_BASE: string =
  (Constants.expoConfig?.extra as { apiBase?: string } | undefined)?.apiBase ??
  'http://10.0.2.2:4111'; // Android emulator → host loopback; replace at run time on iOS sim with localhost.

export default function HomeScreen(): ReactNode {
  const [surahs, setSurahs] = useState<readonly Surah[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const res = await fetch(`${API_BASE}/v1/metadata/surahs`);
        if (!res.ok) throw new Error(`HTTP ${res.status.toString()}`);
        const body = (await res.json()) as { data: Surah[] };
        if (!cancelled) setSurahs(body.data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.title}>Qalaam</Text>
      <Text style={styles.subtitle}>Read · Study · Memorize · Listen</Text>

      <View style={styles.quickRow}>
        <Link href="/hifdh" asChild>
          <Pressable style={styles.quickCard}>
            <Text style={styles.quickLabel}>Hifdh</Text>
          </Pressable>
        </Link>
        <Link href="/study/1:1" asChild>
          <Pressable style={styles.quickCard}>
            <Text style={styles.quickLabel}>Deep study</Text>
          </Pressable>
        </Link>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#b6862c" style={styles.spinner} />
      ) : error ? (
        <View style={styles.error}>
          <Text style={styles.errorText}>Backend unreachable: {error}</Text>
          <Text style={styles.errorHint}>
            Set API_BASE in app/index.tsx to your dev machine&apos;s LAN IP, e.g.
            http://192.168.1.10:4111.
          </Text>
        </View>
      ) : (
        <FlatList
          data={surahs}
          keyExtractor={(s) => s.surah.toString()}
          renderItem={({ item }) => (
            <Link href={`/read/${item.surah.toString()}`} asChild>
              <Pressable style={styles.surahRow}>
                <View style={styles.surahHeader}>
                  <Text style={styles.surahArabic}>{item.nameArabic}</Text>
                  <Text style={styles.surahNumber}>{item.surah}</Text>
                </View>
                <Text style={styles.surahEnglish}>
                  {item.nameEnglish} · {item.verseCount.toString()} verses · {item.revelationPlace}
                </Text>
              </Pressable>
            </Link>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fafafa', paddingHorizontal: 16, paddingTop: 8 },
  title: { fontSize: 32, fontWeight: '700', color: '#1b4d5a', marginTop: 8 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 16 },
  quickRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  quickCard: {
    flex: 1,
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  quickLabel: { fontSize: 16, fontWeight: '600', color: '#1b4d5a' },
  spinner: { marginTop: 32 },
  error: { padding: 16, backgroundColor: '#fee', borderRadius: 8 },
  errorText: { color: '#c00', fontSize: 14, fontWeight: '600' },
  errorHint: { color: '#900', fontSize: 12, marginTop: 8 },
  surahRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    marginBottom: 8,
  },
  surahHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  surahArabic: { fontSize: 20, color: '#1b4d5a' },
  surahNumber: { fontSize: 12, color: '#999', fontVariant: ['tabular-nums'] },
  surahEnglish: { fontSize: 13, color: '#555', marginTop: 4 },
});
