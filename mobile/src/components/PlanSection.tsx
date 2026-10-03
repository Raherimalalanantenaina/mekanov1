import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cancelPlanRequest, requestPlan } from '../api/client';
import { PLAN_FEATURES, PLAN_IDS, planName, useAppConfig } from '../appConfig';
import { useTheme } from '../context/ThemeContext';
import { useI18n, type TKey } from '../i18n';
import { font, radii, type ThemeColors } from '../theme';
import type { Garage, PlanId } from '../types';
import { BouncyPressable } from './Pressable';
import { notify } from './Notifier';

/** « Mon offre » : offre en cours et demande de changement (activée par le super admin). */
export function PlanSection({ garage, onChanged }: { garage: Garage; onChanged: () => void }) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const { t, lang } = useI18n();
  const { config } = useAppConfig();
  const [busy, setBusy] = useState(false);

  const current: PlanId = garage.plan ?? 'free';
  const price = (id: PlanId) =>
    config.plans[id].price > 0
      ? `${config.plans[id].price.toLocaleString('fr-FR')} ${t('perMonth')}`
      : t('planFree');

  const onRequest = (id: PlanId) => {
    notify.alert(
      t('planRequestTitle', { p: planName(config, id, lang) }),
      t('planRequestText', { price: price(id) }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('planRequest'),
          onPress: async () => {
            setBusy(true);
            try {
              await requestPlan(garage.id, id);
              notify.success(t('planRequested'), t('planRequestSent'));
              onChanged();
            } catch (e) {
              notify.error(t('error'), e instanceof Error ? e.message : t('fail'));
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  const onCancel = async () => {
    setBusy(true);
    try {
      await cancelPlanRequest(garage.id);
      onChanged();
    } catch (e) {
      notify.error(t('error'), e instanceof Error ? e.message : t('fail'));
    } finally {
      setBusy(false);
    }
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
      {garage.planRequest && (
        <View style={styles.pendingBox}>
          <Ionicons name="hourglass-outline" size={15} color={colors.amberDark} />
          <Text style={styles.pendingText}>
            {t('planPendingInfo', { p: planName(config, garage.planRequest, lang) })}
          </Text>
          <Text style={styles.link} onPress={busy ? undefined : onCancel}>
            {t('planCancelRequest')}
          </Text>
        </View>
      )}

      {PLAN_IDS.map((id) => {
        const plan = config.plans[id];
        const isCurrent = id === current;
        const isRequested = id === garage.planRequest;
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
            {isCurrent ? (
              <View style={[styles.btn, styles.btnCurrent]}>
                <Text style={[styles.btnText, { color: colors.teal }]}>{t('currentPlan')}</Text>
              </View>
            ) : isRequested ? (
              <View style={[styles.btn, styles.btnCurrent]}>
                <Text style={[styles.btnText, { color: colors.amberDark }]}>{t('planRequested')}</Text>
              </View>
            ) : id !== 'free' ? (
              <BouncyPressable
                onPress={() => onRequest(id)}
                disabled={busy}
                style={[styles.btn, busy && { opacity: 0.6 }]}
              >
                <Text style={styles.btnText}>{t('planRequest')}</Text>
              </BouncyPressable>
            ) : null}
          </View>
        );
      })}
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
    link: { color: colors.teal, fontSize: 12.5, fontWeight: font.bold },
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
