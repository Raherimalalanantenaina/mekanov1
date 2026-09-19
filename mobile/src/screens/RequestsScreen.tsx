import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  fetchMyAppointments,
  fetchMyQuotes,
  fetchQuoteMessages,
  sendQuoteMessage,
} from '../api/client';
import { ChatThread } from '../components/ChatThread';
import { BouncyPressable } from '../components/Pressable';
import { useI18n } from '../i18n';
import { useTheme } from '../context/ThemeContext';
import { font, radii, type ThemeColors } from '../theme';
import type { Appointment, Quote, QuoteMessage } from '../types';

type Tab = 'quotes' | 'bookings';

export function RequestsScreen() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('quotes');
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [openQuote, setOpenQuote] = useState<Quote | null>(null);
  const [messages, setMessages] = useState<QuoteMessage[]>([]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [q, a] = await Promise.all([
        fetchMyQuotes(),
        fetchMyAppointments(),
      ]);
      setQuotes(q);
      setAppts(a);
    } catch {
      /* garde la dernière liste affichée si le réseau échoue */
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  // Recharge le fil quand on revient sur l'écran avec un chat ouvert
  useFocusEffect(
    useCallback(() => {
      if (!openQuote) return;
      let cancelled = false;
      fetchQuoteMessages(openQuote.id)
        .then((m) => {
          if (!cancelled) setMessages(m);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [openQuote])
  );

  const openChat = async (q: Quote) => {
    setOpenQuote(q);
    try {
      setMessages(await fetchQuoteMessages(q.id));
    } catch {
      setMessages([]);
    }
  };

  const send = async (body: string, photo: string) => {
    if (!openQuote) return;
    const msg = await sendQuoteMessage(openQuote.id, 'client', body, photo);
    setMessages((m) => [...m, msg]);
  };

  const statusLabel = (s: string) => {
    if (s === 'answered') return t('answered');
    if (s === 'accepted') return t('accepted');
    if (s === 'declined') return t('declined');
    return t('pending');
  };

  if (openQuote) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.chatHead}>
          <BouncyPressable onPress={() => setOpenQuote(null)}>
            <Ionicons name="arrow-back" size={22} color={colors.ink} />
          </BouncyPressable>
          <Text style={styles.chatTitle} numberOfLines={1}>
            {openQuote.garageName ?? 'Garage'}
          </Text>
        </View>
        <ChatThread
          messages={messages}
          mySender="client"
          placeholder={t('writeMessage')}
          onSend={send}
          bottomInset={insets.bottom + 84}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.head, { paddingTop: insets.top + 14 }]}>
        <Text style={styles.title}>{t('myRequests')}</Text>
      </View>
      <View style={styles.tabs}>
        <BouncyPressable
          onPress={() => setTab('quotes')}
          style={[styles.tab, tab === 'quotes' && styles.tabActive]}
        >
          <Text style={[styles.tabText, tab === 'quotes' && styles.tabTextActive]}>
            {t('quotes')}
          </Text>
        </BouncyPressable>
        <BouncyPressable
          onPress={() => setTab('bookings')}
          style={[styles.tab, tab === 'bookings' && styles.tabActive]}
        >
          <Text
            style={[styles.tabText, tab === 'bookings' && styles.tabTextActive]}
          >
            {t('bookings')}
          </Text>
        </BouncyPressable>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.teal} style={{ marginTop: 40 }} />
      ) : tab === 'quotes' ? (
        <FlatList
          data={quotes}
          keyExtractor={(q) => q.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
          ListEmptyComponent={
            <Text style={styles.empty}>{t('noRequests')}</Text>
          }
          renderItem={({ item }) => (
            <BouncyPressable
              onPress={() => openChat(item)}
              style={styles.card}
            >
              <Text style={styles.cardTitle}>{item.garageName}</Text>
              <Text style={styles.cardDesc} numberOfLines={2}>
                {item.description}
              </Text>
              <View style={styles.cardMeta}>
                <Text style={styles.status}>{statusLabel(item.status)}</Text>
                <Text style={styles.meta}>
                  {item.messageCount} msg ·{' '}
                  {new Date(item.createdAt).toLocaleDateString()}
                </Text>
              </View>
            </BouncyPressable>
          )}
        />
      ) : (
        <FlatList
          data={appts}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
          ListEmptyComponent={
            <Text style={styles.empty}>{t('noRequests')}</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.garageName}</Text>
              <Text style={styles.cardDesc}>{item.slot}</Text>
              {!!item.note && (
                <Text style={styles.meta}>{item.note}</Text>
              )}
              <Text style={styles.status}>{statusLabel(item.status)}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  head: { paddingBottom: 12 },
  title: {
    fontSize: 26,
    fontWeight: font.black,
    letterSpacing: -0.5,
    color: colors.ink,
    paddingHorizontal: 18,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 18,
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.bg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
  },
  tabActive: { backgroundColor: colors.teal, borderColor: colors.teal },
  tabText: { fontWeight: font.bold, color: colors.muted },
  tabTextActive: { color: colors.white },
  card: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 10,
  },
  cardTitle: { fontWeight: font.extrabold, color: colors.ink, fontSize: 15 },
  cardDesc: { color: colors.muted, marginTop: 4, lineHeight: 19 },
  cardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  status: {
    color: colors.teal,
    fontWeight: font.extrabold,
    fontSize: 12,
    marginTop: 8,
  },
  meta: { color: colors.faint, fontSize: 12 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 40 },
  chatHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.card,
  },
  chatTitle: { fontWeight: font.extrabold, fontSize: 16, color: colors.ink, flex: 1 },
});
