/**
 * Deep study — Arabic + word-by-word + mutashabihat watchlist.
 *
 * Per Phase 12. Mirrors apps/web /study/[surah]/[ayah] but in RN-friendly shapes.
 */
import Constants from 'expo-constants';
import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';

interface Verse {
  verseKey: string;
  textUthmani: string;
}

interface Word {
  verseKey: string;
  wordIndex: number;
  textArabic: string;
  translation: string;
  languageCode: string;
}

interface MutashabihatPair {
  leftVerseKey: string;
  rightVerseKey: string;
  score: number;
  note: string | null;
}

const API_BASE: string =
  (Constants.expoConfig?.extra as { apiBase?: string } | undefined)?.apiBase ??
  'http://10.0.2.2:4111';

export default function StudyScreen(): ReactNode {
  const { verseKey } = useLocalSearchParams<{ verseKey: string }>();
  const [verse, setVerse] = useState<Verse | null>(null);
  const [words, setWords] = useState<readonly Word[]>([]);
  const [pairs, setPairs] = useState<readonly MutashabihatPair[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const [vRes, wRes, pRes] = await Promise.all([
          fetch(`${API_BASE}/v1/verses/by_key/${verseKey}`),
          fetch(`${API_BASE}/v1/wbw/${verseKey}?lang=en`),
          fetch(`${API_BASE}/v1/mutashabihat/watchlist/${verseKey}?limit=3`),
        ]);
        if (!cancelled) {
          if (vRes.ok) {
            setVerse((await vRes.json()) as Verse);
          }
          if (wRes.ok) {
            const body = (await wRes.json()) as { data: { words: Word[] } };
            setWords(body.data.words);
          }
          if (pRes.ok) {
            const body = (await pRes.json()) as { data: MutashabihatPair[] };
            setPairs(body.data);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [verseKey]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator size="large" color="#b6862c" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>Verse {verseKey}</Text>
        {verse ? <Text style={styles.arabic}>{verse.textUthmani}</Text> : null}

        {words.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Word by word</Text>
            <FlatList
              data={[...words]}
              horizontal
              keyExtractor={(w) => `${w.verseKey}-${w.wordIndex.toString()}`}
              renderItem={({ item }) => (
                <View style={styles.wordCard}>
                  <Text style={styles.wordArabic}>{item.textArabic}</Text>
                  <Text style={styles.wordTranslation}>{item.translation}</Text>
                </View>
              )}
              contentContainerStyle={{ gap: 12 }}
              inverted
            />
          </View>
        ) : null}

        {pairs.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Watch out for</Text>
            {pairs.map((p) => {
              const other = p.leftVerseKey === verseKey ? p.rightVerseKey : p.leftVerseKey;
              return (
                <Link key={`${p.leftVerseKey}-${p.rightVerseKey}`} href={`/study/${other}`} asChild>
                  <Pressable style={styles.pairRow}>
                    <Text style={styles.pairKey}>{other}</Text>
                    <Text style={styles.pairScore}>
                      {(p.score * 100).toFixed(0)}% similar
                      {p.note ? ` · ${p.note}` : ''}
                    </Text>
                  </Pressable>
                </Link>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fafafa' },
  content: { padding: 16, gap: 16 },
  label: { fontSize: 14, color: '#666' },
  arabic: {
    fontSize: 28,
    lineHeight: 50,
    color: '#1b4d5a',
    textAlign: 'right',
    backgroundColor: '#ffffff',
    padding: 18,
    borderRadius: 12,
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1b4d5a',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  wordCard: {
    minWidth: 100,
    padding: 10,
    backgroundColor: '#fafafa',
    borderRadius: 8,
    alignItems: 'center',
  },
  wordArabic: { fontSize: 22, color: '#1b4d5a', textAlign: 'center' },
  wordTranslation: { fontSize: 12, color: '#555', marginTop: 4, textAlign: 'center' },
  pairRow: {
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  pairKey: { fontSize: 16, color: '#1b4d5a', fontWeight: '600' },
  pairScore: { fontSize: 12, color: '#777' },
});
