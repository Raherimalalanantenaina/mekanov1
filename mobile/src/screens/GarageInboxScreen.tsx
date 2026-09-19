import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  fetchQuoteMessages,
  fetchReceivedAppointments,
  fetchReceivedQuotes,
  sendQuoteMessage,
  setAppointmentStatus,
} from '../api/client';
import { ChatThread } from '../components/ChatThread';
import { BouncyPressable } from '../components/Pressable';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import { font, radii, type ThemeColors } from '../theme';
import type { Appointment, Quote, QuoteMessage } from '../types';

type Tab = 'quotes' | 'bookings';

export function GarageInboxScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('quotes');
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [openQuote, setOpenQuote] = useState<Quote | null>(null);
  const [messages, setMessages] = useState<QuoteMessage[]>([]);

  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [q, a] = await Promise.all([
        fetchReceivedQuotes(),
        fetchReceivedAppointments(),
      ]);
      setQuotes(q);
      setAppts(a);
    } catch (e) {
      // Ne vide pas l'historique déjà affiché ; alerte seulement si liste vide
      setQuotes((prev) => {
        if (prev.length === 0) {
          Alert.alert(t('error'), e instanceof Error ? e.message : t('fail'));
        }
        return prev;
      });
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

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

  if (!user) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.hint}>{t('inboxLoginHint')}</Text>
      </View>
    );
  }

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
    const msg = await sendQuoteMessage(openQuote.id, 'garage', body, photo);
    setMessages((m) => [...m, msg]);
  };

  const decide = async (id: string, status: 'accepted' | 'declined') => {
    await setAppointmentStatus(id, status);
    await reload();
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
          <View style={{ flex: 1 }}>
            <Text style={styles.chatTitle}>{openQuote.clientName}</Text>
            <Text style={styles.meta}>{openQuote.clientPhone || '—'}</Text>
          </View>
        </View>
        <View style={styles.problemBox}>
          <Text style={styles.problem}>{openQuote.description}</Text>
        </View>
        <ChatThread
          messages={messages}
          mySender="garage"
          placeholder={t('replyToClient')}
          onSend={send}
          bottomInset={insets.bottom + 84}
          quickReplies={t('quickReplies').split('|')}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.head, { paddingTop: insets.top + 14 }]}>
        <Text style={styles.title}>{t('inboxTitle')}</Text>
      </View>
      <View style={styles.tabs}>
        <BouncyPressable
          onPress={() => setTab('quotes')}
          style={[styles.tab, tab === 'quotes' && styles.tabActive]}
        >
          <Text style={[styles.tabText, tab === 'quotes' && styles.tabTextActive]}>
            {t('quotes')} ({quotes.length})
          </Text>
        </BouncyPressable>
        <BouncyPressable
          onPress={() => setTab('bookings')}
          style={[styles.tab, tab === 'bookings' && styles.tabActive]}
        >
          <Text
            style={[styles.tabText, tab === 'bookings' && styles.tabTextActive]}
          >
            {t('bookings')} ({appts.length})
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
            <Text style={styles.hint}>{t('noQuoteRequests')}</Text>
          }
          renderItem={({ item }) => (
            <BouncyPressable
              onPress={() => openChat(item)}
              style={styles.card}
            >
              <Text style={styles.cardTitle}>
                {item.clientName} → {item.garageName}
              </Text>
              <Text style={styles.cardDesc} numberOfLines={2}>
                {item.description}
              </Text>
              <Text style={styles.meta}>
                {statusLabel(item.status)} · {item.messageCount} msg
              </Text>
            </BouncyPressable>
          )}
        />
      ) : (
        <FlatList
          data={appts}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
          ListEmptyComponent={
            <Text style={styles.hint}>{t('noAppointments')}</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {item.clientName} → {item.garageName}
              </Text>
              <Text style={styles.cardDesc}>{item.slot}</Text>
              {!!item.note && <Text style={styles.meta}>{item.note}</Text>}
              <Text style={styles.meta}>{item.clientPhone}</Text>
              <Text style={styles.status}>{statusLabel(item.status)}</Text>
              {item.status === 'pending' && (
                <View style={styles.rowActions}>
                  <BouncyPressable
                    onPress={() => decide(item.id, 'accepted')}
                    style={styles.accept}
                  >
                    <Text style={styles.acceptText}>{t('accept')}</Text>
                  </BouncyPressable>
                  <BouncyPressable
                    onPress={() => decide(item.id, 'declined')}
                    style={styles.decline}
                  >
                    <Text style={styles.declineText}>{t('decline')}</Text>
                  </BouncyPressable>
                </View>
              )}
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
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
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
  tabText: { fontWeight: font.bold, color: colors.muted, fontSize: 13 },
  tabTextActive: { color: colors.white },
  card: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 10,
  },
  cardTitle: { fontWeight: font.extrabold, color: colors.ink },
  cardDesc: { color: colors.muted, marginTop: 4, lineHeight: 19 },
  meta: { color: colors.faint, fontSize: 12, marginTop: 6 },
  status: {
    color: colors.teal,
    fontWeight: font.extrabold,
    fontSize: 12,
    marginTop: 8,
  },
  hint: { textAlign: 'center', color: colors.muted, marginTop: 40 },
  rowActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  accept: {
    flex: 1,
    backgroundColor: colors.successSoft,
    borderRadius: radii.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  acceptText: { color: colors.success, fontWeight: font.extrabold },
  decline: {
    flex: 1,
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  declineText: { color: colors.danger, fontWeight: font.extrabold },
  chatHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.card,
  },
  chatTitle: { fontWeight: font.extrabold, fontSize: 16, color: colors.ink },
  problemBox: {
    backgroundColor: colors.amberSoft,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  problem: { color: colors.ink, fontWeight: font.semibold },
});
