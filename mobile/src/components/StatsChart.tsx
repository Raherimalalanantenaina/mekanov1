import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import { font, radii, type ThemeColors } from '../theme';
import type { DailyStat } from '../types';

/**
 * Mini graphique en barres des 7 derniers jours (vues + appels),
 * dessiné avec de simples View — aucune librairie de chart.
 */
export function StatsChart({ data }: { data: DailyStat[] }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  if (data.length === 0) return null;

  const dayNames = t('daysShort').split(',');
  const max = Math.max(1, ...data.map((d) => d.views + d.calls));
  const totals = data.reduce(
    (acc, d) => ({
      views: acc.views + d.views,
      calls: acc.calls + d.calls,
      searches: acc.searches + d.searches,
    }),
    { views: 0, calls: 0, searches: 0 }
  );

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>{t('statsTitle')}</Text>
        <View style={styles.legend}>
          <View style={[styles.legendDot, { backgroundColor: colors.teal }]} />
          <Text style={styles.legendText}>{t('statViews')}</Text>
          <View style={[styles.legendDot, { backgroundColor: colors.amber }]} />
          <Text style={styles.legendText}>{t('statCalls')}</Text>
        </View>
      </View>

      <View style={styles.bars}>
        {data.map((d) => {
          const dayIdx = (new Date(d.day).getDay() + 6) % 7;
          const viewsH = Math.round((d.views / max) * 56);
          const callsH = Math.round((d.calls / max) * 56);
          return (
            <View key={d.day} style={styles.barCol}>
              <View style={styles.barStack}>
                <View
                  style={{
                    width: 14,
                    height: Math.max(callsH, d.calls > 0 ? 3 : 0),
                    backgroundColor: colors.amber,
                    borderTopLeftRadius: 3,
                    borderTopRightRadius: 3,
                  }}
                />
                <View
                  style={{
                    width: 14,
                    height: Math.max(viewsH, d.views > 0 ? 3 : 0),
                    backgroundColor: colors.teal,
                    borderTopLeftRadius: callsH > 0 ? 0 : 3,
                    borderTopRightRadius: callsH > 0 ? 0 : 3,
                  }}
                />
              </View>
              <Text style={styles.barLabel}>{dayNames[dayIdx]?.[0] ?? ''}</Text>
            </View>
          );
        })}
      </View>

      <Text style={styles.totals}>
        {t('statViews')} {totals.views} · {t('statCalls')} {totals.calls} ·{' '}
        {t('statSearches')} {totals.searches}
      </Text>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radii.lg,
      padding: 14,
      marginTop: 10,
    },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    title: {
      fontSize: 13,
      fontWeight: font.black,
      color: colors.ink,
    },
    legend: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 6 },
    legendText: { fontSize: 11, color: colors.muted },
    bars: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-around',
      height: 78,
    },
    barCol: { alignItems: 'center', gap: 4 },
    barStack: { justifyContent: 'flex-end' },
    barLabel: {
      fontSize: 10,
      color: colors.faint,
      fontWeight: font.semibold,
    },
    totals: {
      marginTop: 10,
      fontSize: 11.5,
      color: colors.muted,
      textAlign: 'center',
    },
  });
