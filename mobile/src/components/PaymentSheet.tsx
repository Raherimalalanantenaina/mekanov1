import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchPayment, startPlanPayment } from '../api/client';
import { planName, useAppConfig } from '../appConfig';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import { font, radii, type ThemeColors } from '../theme';
import type { Garage, Payment, PaymentProviderId, PaymentProviderInfo, PlanId } from '../types';
import { BouncyPressable } from './Pressable';

/** Couleur repère de chaque opérateur (pastille, pas de logo). */
const PROVIDER_COLORS: Record<PaymentProviderId, string> = {
  mvola: '#F6C700',
  orange: '#FF7900',
  airtel: '#E40613',
  simulation: '#7C8A8C',
};

const POLL_MS = 3000;

/** 9 chiffres sans le 0, ou null. */
function normalize(input: string): string | null {
  let d = input.replace(/\D/g, '');
  if (d.startsWith('261')) d = d.slice(3);
  if (d.startsWith('0')) d = d.slice(1);
  return /^3[2-9]\d{7}$/.test(d) ? d : null;
}

const pretty = (n: string) => `0${n.slice(0, 2)} ${n.slice(2, 4)} ${n.slice(4, 7)} ${n.slice(7)}`;

export function PaymentSheet({
  garage,
  plan,
  providers,
  onClose,
  onPaid,
  loading = false,
}: {
  garage: Garage;
  plan: PlanId | null;
  providers: PaymentProviderInfo[];
  onClose: () => void;
  onPaid: () => void;
  /** Liste des opérateurs encore en chargement. */
  loading?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t, lang } = useI18n();
  const { config } = useAppConfig();

  const guessProvider = () => {
    const n = normalize(garage.phone ?? '');
    return (n && providers.find((p) => p.prefixes.includes(n.slice(0, 2)))?.id) || providers[0]?.id;
  };
  const [providerId, setProviderId] = useState<PaymentProviderId | undefined>(guessProvider);
  const [phone, setPhone] = useState(garage.phone ?? '');
  const [payment, setPayment] = useState<Payment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paidRef = useRef(false);

  // Réinitialise à chaque ouverture
  useEffect(() => {
    if (!plan) return;
    setPayment(null);
    setError(null);
    setBusy(false);
    setProviderId(guessProvider());
    setPhone(garage.phone ?? '');
    paidRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  // Opérateurs reçus après l'ouverture : on présélectionne le bon
  useEffect(() => {
    if (plan && !providers.some((p) => p.id === providerId)) setProviderId(guessProvider());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providers]);

  const provider = providers.find((p) => p.id === providerId);
  const price = plan ? config.plans[plan].price : 0;
  const name = plan ? planName(config, plan, lang) : '';

  // Suivi du paiement : interrogation régulière + au retour dans l'app
  useEffect(() => {
    if (!payment || payment.status !== 'pending') return;
    let alive = true;
    const check = async () => {
      try {
        const p = await fetchPayment(payment.id);
        if (alive) setPayment(p);
      } catch {
        /* réseau : on réessaie au prochain tour */
      }
    };
    const timer = setInterval(check, POLL_MS);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void check();
    });
    return () => {
      alive = false;
      clearInterval(timer);
      sub.remove();
    };
  }, [payment?.id, payment?.status]);

  useEffect(() => {
    if (payment?.status === 'success' && !paidRef.current) {
      paidRef.current = true;
      onPaid();
    }
  }, [payment?.status, onPaid]);

  const phoneNeeded = provider ? provider.prefixes.length > 0 && !provider.redirect : false;
  const prefixesText = provider?.prefixes.map((x) => `0${x}`).join(', ') ?? '';

  const onPay = async () => {
    if (!plan || !provider) return;
    setError(null);
    const n = normalize(phone);
    if (provider.prefixes.length > 0 && (phoneNeeded || phone.trim())) {
      if (!n || !provider.prefixes.includes(n.slice(0, 2))) {
        setError(t('payInvalidPhone', { op: provider.label, prefixes: prefixesText }));
        return;
      }
    }
    setBusy(true);
    try {
      const p = await startPlanPayment({ garageId: garage.id, plan, provider: provider.id, msisdn: n ?? '' });
      setPayment(p);
      if (p.paymentUrl) await Linking.openURL(p.paymentUrl).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : t('fail'));
    } finally {
      setBusy(false);
    }
  };

  const status = payment?.status;
  const opLabel = providers.find((p) => p.id === payment?.provider)?.label ?? provider?.label ?? '';

  return (
    <Modal visible={!!plan} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={status === 'pending' ? undefined : onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{t('payTitle', { p: name })}</Text>
              <Text style={styles.amount}>
                {t('payAmount', { price: `${price.toLocaleString('fr-FR')} Ar` })}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.muted} />
            </Pressable>
          </View>

          {!payment && providers.length === 0 ? (
            // Aucun opérateur : chargement, hors ligne ou paiement pas encore configuré
            <View style={styles.center}>
              {loading ? (
                <ActivityIndicator size="large" color={colors.teal} />
              ) : (
                <>
                  <Ionicons name="cloud-offline-outline" size={40} color={colors.faint} />
                  <Text style={styles.waitText}>{t('payNoProvider')}</Text>
                  <BouncyPressable onPress={onClose} style={[styles.btn, styles.btnOutline]}>
                    <Text style={[styles.btnText, { color: colors.teal }]}>{t('payClose')}</Text>
                  </BouncyPressable>
                </>
              )}
            </View>
          ) : !payment || status === 'failed' || status === 'expired' ? (
            <>
              {payment && (
                <View style={[styles.banner, { backgroundColor: colors.dangerSoft }]}>
                  <Ionicons name="alert-circle" size={18} color={colors.danger} />
                  <Text style={[styles.bannerText, { color: colors.danger }]}>
                    {status === 'expired' ? t('payExpired') : payment.error || t('payFailedTitle')}
                  </Text>
                </View>
              )}
              <Text style={styles.label}>{t('payMethod')}</Text>
              <View style={styles.providers}>
                {providers.map((p) => {
                  const active = p.id === providerId;
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => {
                        setProviderId(p.id);
                        setError(null);
                      }}
                      style={[styles.provider, active && styles.providerActive]}
                    >
                      <View style={[styles.dot, { backgroundColor: PROVIDER_COLORS[p.id] }]}>
                        <Text style={styles.dotText}>{p.label.charAt(0)}</Text>
                      </View>
                      <Text style={[styles.providerText, active && { color: colors.teal }]} numberOfLines={1}>
                        {p.label}
                      </Text>
                      {active && <Ionicons name="checkmark-circle" size={18} color={colors.teal} />}
                    </Pressable>
                  );
                })}
              </View>

              {provider && provider.prefixes.length > 0 && (
                <>
                  <Text style={styles.label}>
                    {phoneNeeded
                      ? t('payPhone', { op: provider.label })
                      : t('payPhoneOptional', { op: provider.label })}
                  </Text>
                  <TextInput
                    value={phone}
                    onChangeText={(v) => {
                      setPhone(v);
                      setError(null);
                    }}
                    placeholder={t('payPhonePlaceholder')}
                    placeholderTextColor={colors.faint}
                    keyboardType="phone-pad"
                    maxLength={17}
                    style={styles.input}
                  />
                </>
              )}

              {error && <Text style={styles.error}>{error}</Text>}

              <BouncyPressable
                onPress={onPay}
                disabled={busy || !provider}
                style={[styles.btn, (busy || !provider) && { opacity: 0.6 }]}
              >
                {busy ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.btnText}>
                    {payment ? t('payRetry') : t('payNow', { amount: price.toLocaleString('fr-FR') })}
                  </Text>
                )}
              </BouncyPressable>
              <View style={styles.secureRow}>
                <Ionicons name="shield-checkmark-outline" size={14} color={colors.muted} />
                <Text style={styles.secure}>{t('paySecure')}</Text>
              </View>
            </>
          ) : status === 'pending' ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.teal} />
              <Text style={styles.waitTitle}>{t('payChecking')}</Text>
              <Text style={styles.waitText}>
                {payment.paymentUrl
                  ? t('payWaitingWeb', { op: opLabel })
                  : t('payWaitingUssd', {
                      phone: payment.msisdn ? pretty(payment.msisdn.slice(1)) : '',
                      op: opLabel,
                    })}
              </Text>
              {payment.paymentUrl && (
                <BouncyPressable
                  onPress={() => Linking.openURL(payment.paymentUrl!).catch(() => {})}
                  style={[styles.btn, styles.btnOutline]}
                >
                  <Text style={[styles.btnText, { color: colors.teal }]}>{t('payOpenPage')}</Text>
                </BouncyPressable>
              )}
              <Text style={styles.ref}>Réf. {payment.reference}</Text>
            </View>
          ) : (
            <View style={styles.center}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark" size={36} color={colors.white} />
              </View>
              <Text style={styles.waitTitle}>{t('paySuccessTitle')}</Text>
              <Text style={styles.waitText}>{t('paySuccess', { p: name })}</Text>
              <Text style={styles.ref}>
                Réf. {payment.reference}
                {payment.providerTxnId ? ` · ${payment.providerTxnId}` : ''}
              </Text>
              <BouncyPressable onPress={onClose} style={styles.btn}>
                <Text style={styles.btnText}>{t('payClose')}</Text>
              </BouncyPressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      paddingHorizontal: 18,
      paddingBottom: 28,
      paddingTop: 8,
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.line,
      marginBottom: 12,
    },
    head: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
    title: { color: colors.ink, fontSize: 18, fontWeight: font.black },
    amount: { color: colors.teal, fontSize: 14, fontWeight: font.extrabold, marginTop: 2 },
    label: { color: colors.muted, fontSize: 12.5, fontWeight: font.bold, marginBottom: 8, marginTop: 4 },
    providers: { gap: 8, marginBottom: 12 },
    provider: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radii.md,
      paddingVertical: 11,
      paddingHorizontal: 12,
      backgroundColor: colors.bg,
    },
    providerActive: { borderColor: colors.teal, borderWidth: 2, backgroundColor: colors.tealSoft },
    providerText: { flex: 1, color: colors.ink, fontSize: 14.5, fontWeight: font.extrabold },
    dot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
    dotText: { color: '#fff', fontWeight: font.black, fontSize: 14 },
    input: {
      backgroundColor: colors.field,
      borderRadius: radii.md,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.ink,
      letterSpacing: 0.5,
    },
    error: { color: colors.danger, fontSize: 12.5, marginTop: 8 },
    btn: {
      marginTop: 16,
      backgroundColor: colors.teal,
      borderRadius: radii.pill,
      paddingVertical: 13,
      alignItems: 'center',
      alignSelf: 'stretch',
    },
    btnOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.teal },
    btnText: { color: colors.white, fontWeight: font.extrabold, fontSize: 15 },
    secureRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
    secure: { flex: 1, color: colors.muted, fontSize: 11.5, lineHeight: 16 },
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: radii.md,
      padding: 12,
      marginBottom: 12,
    },
    bannerText: { flex: 1, fontSize: 12.5, fontWeight: font.bold },
    center: { alignItems: 'center', paddingVertical: 12 },
    waitTitle: { color: colors.ink, fontSize: 16.5, fontWeight: font.black, marginTop: 14 },
    waitText: { color: colors.muted, fontSize: 13.5, lineHeight: 19, textAlign: 'center', marginTop: 6 },
    ref: { color: colors.faint, fontSize: 11.5, marginTop: 12 },
    successIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.success,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
