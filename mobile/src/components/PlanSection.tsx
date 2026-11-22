import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchPaymentProviders } from '../api/client';
import { PLAN_FEATURES, PLAN_IDS, planName, useAppConfig } from '../appConfig';
import { useTheme } from '../context/ThemeContext';
import { useI18n, type TKey } from '../i18n';
import { font, radii, type ThemeColors } from '../theme';
import type { Garage, PaymentProviderInfo, PlanId } from '../types';
import { BouncyPressable } from './Pressable';
import { PaymentSheet } from './PaymentSheet';

/**
 * « Mon offre » : offre en cours et achat immédiat par mobile money
 * (MVola, Orange Money, Airtel Money). L'offre s'active dès que l'opérateur
 * confirme le paiement.
 */
export function PlanSection({ garage, onChanged }: { garage: Garage; onChanged: () => void }) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const { t, lang } = useI18n();
  const { config } = useAppConfig();
  const [providers, setProviders] = useState<PaymentProviderInfo[]>([]);
  const [providersLoaded, setProvidersLoaded] = useState(false);
  const [paying, setPaying] = useState<PlanId | null>(null);

  const loadProviders = useCallback(() => {
    fetchPaymentProviders()
      .then(setProviders)
      .catch(() => setProviders([]))
      .finally(() => setProvidersLoaded(true));
  }, []);
  useEffect(loadProviders, [loadProviders]);
  const onPaid = useCallback(() => onChanged(), [onChanged]);

  const current: PlanId = garage.plan ?? 'free';
  const daysLeft = garage.planExpiresAt
    ? Math.ceil((new Date(garage.planExpiresAt).getTime() - Date.now()) / 86_400_000)
    : null;
  const price = (id: PlanId) =>
    config.plans[id].price > 0
      ? `${config.plans[id].price.toLocaleString('fr-FR')} ${t('perMonth')}`
      : t('planFree');

  const onBuy = (id: PlanId) => {
    // Hors ligne au chargement de l'écran : on retente au moment d'acheter
    if (providers.length === 0) loadProviders();
    setPaying(id);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t('myPlan')}</Text>
      <View style={styles.currentBox}>
        <Ionicons name="ribbon" size={20} color={colors.amberDark} />
        <View style={{ flex: 1 }}>
          <Text style={styles.currentLabel}>{t('currentPlan')}</Text>
          <Text style={styles.currentName}>{planName(config, current, lang)}</Text>
          {current !== 'free' && (
            <Text style={styles.sub}>
              {garage.planExpiresAt
                ? t('planUntil', { d: new Date(garage.planExpiresAt).toLocaleDateString('fr-FR') })
                : t('planNoEnd')}
            </Text>
          )}
        </View>
      </View>
      {current !== 'free' && daysLeft != null && daysLeft <= 7 && (
        <View style={styles.pendingBox}>
          <Ionicons name="alarm-outline" size={15} color={colors.amberDark} />
          <Text style={styles.pendingText}>{t('planEndsSoon', { n: Math.max(daysLeft, 0) })}</Text>
        </View>
      )}

      {PLAN_IDS.map((id) => {
        const plan = config.plans[id];
        const isCurrent = id === current;
        return (
          <View key={id} style={[styles.card, isCurrent && styles.cardCurrent]}>
            <View style={styles.cardHead}>
              <Text style={styles.cardName}>{planName(config, id, lang)}</Text>
              <Text style={styles.cardPrice}>{price(id)}</Text>
            </View>
            <View style={styles.featureRow}>
              <Ionicons name="checkmark" size={14} color={colors.success} />
              <Text style={styles.featureText}>
                {plan.maxServices > 0
                  ? t('pfServicesLimited', { n: plan.maxServices })
                  : t('pfServicesAll')}
              </Text>
            </View>
            {PLAN_FEATURES.map((f) => (
              <View key={f} style={styles.featureRow}>
                <Ionicons
                  name={plan.features[f] ? 'checkmark' : 'close'}
                  size={14}
                  color={plan.features[f] ? colors.success : colors.faint}
                />
                <Text style={[styles.featureText, !plan.features[f] && styles.featureOff]}>
                  {t(`pf_${f}` as TKey)}
                </Text>
              </View>
            ))}
            {id === 'free' ? (
              isCurrent ? (
                <View style={[styles.btn, styles.btnCurrent]}>
                  <Text style={[styles.btnText, { color: colors.teal }]}>{t('currentPlan')}</Text>
                </View>
              ) : null
            ) : (
              // Offre payante : achat immédiat (ou prolongation d'un mois si c'est l'offre en cours)
              <BouncyPressable onPress={() => onBuy(id)} style={styles.btn}>
                <Text style={styles.btnText}>
                  {isCurrent ? t('planRenew') : t('payBtn')} · {config.plans[id].price.toLocaleString('fr-FR')} Ar
                </Text>
              </BouncyPressable>
            )}
          </View>
        );
      })}

      <PaymentSheet
        garage={garage}
        plan={paying}
        providers={providers}
        loading={!providersLoaded}
        onClose={() => setPaying(null)}
        onPaid={onPaid}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { marginTop: 18 },
    title: {
      color: colors.ink,
      fontSize: 18,
      fontWeight: font.black,
      marginBottom: 10,
    },
    currentBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.amberSoft,
      borderRadius: radii.md,
      padding: 14,
      marginBottom: 10,
    },
    currentLabel: { color: colors.muted, fontSize: 11.5 },
    currentName: { color: colors.ink, fontSize: 16, fontWeight: font.extrabold },
    sub: { color: colors.muted, fontSize: 12, marginTop: 2 },
    pendingBox: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radii.md,
      padding: 12,
      marginBottom: 10,
    },
    pendingText: { color: colors.ink, fontSize: 12.5, fontWeight: font.bold, flex: 1 },
    card: {
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radii.md,
      padding: 14,
      marginBottom: 10,
      backgroundColor: colors.bg,
    },
    cardCurrent: { borderColor: colors.teal, borderWidth: 2 },
    cardHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    cardName: { color: colors.ink, fontSize: 15.5, fontWeight: font.extrabold },
    cardPrice: { color: colors.teal, fontSize: 14, fontWeight: font.extrabold },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
    featureText: { color: colors.ink, fontSize: 12.5 },
    featureOff: { color: colors.faint, textDecorationLine: 'line-through' },
    btn: {
      marginTop: 10,
      backgroundColor: colors.teal,
      borderRadius: radii.pill,
      paddingVertical: 10,
      alignItems: 'center',
    },
    btnCurrent: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
    btnText: { color: colors.white, fontWeight: font.extrabold, fontSize: 13.5 },
  });
