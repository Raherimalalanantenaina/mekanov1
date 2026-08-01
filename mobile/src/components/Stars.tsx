import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import { font } from '../theme';

type Props = {
  rating: number | null;
  count?: number;
  size?: number;
  onRate?: (value: number) => void;
  value?: number;
};

/** Affichage note (rating) ou saisie (onRate + value). */
export function Stars({ rating, count, size = 13, onRate, value }: Props) {
  const { colors } = useTheme();
  const { t } = useI18n();
  if (onRate) {
    return (
      <View style={styles.row}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Ionicons
            key={i}
            name={i <= (value ?? 0) ? 'star' : 'star-outline'}
            size={size + 9}
            color={colors.amber}
            onPress={() => onRate(i)}
            style={{ padding: 2 }}
          />
        ))}
      </View>
    );
  }

  if (rating == null) {
    return (
      <View style={styles.row}>
        <Ionicons name="star-outline" size={size} color={colors.faint} />
        <Text style={[styles.text, { color: colors.faint }]}>
          {t('noReviewsShort')}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <Ionicons name="star" size={size} color={colors.amber} />
      <Text style={[styles.text, { color: colors.ink }]}>
        {rating.toFixed(1)}
        {count != null ? ` (${count})` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  text: {
    fontSize: 12,
    fontWeight: font.bold,
  },
});
