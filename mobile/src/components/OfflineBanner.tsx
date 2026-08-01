import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import { font, type ThemeColors } from '../theme';

export function OfflineBanner({ offline }: { offline: boolean }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  if (!offline) return null;
  return (
    <Animated.View
      entering={FadeInUp.duration(350)}
      exiting={FadeOutUp.duration(250)}
      style={styles.banner}
    >
      <View style={styles.row}>
        <Ionicons name="cloud-offline-outline" size={16} color={colors.offline} />
        <Text style={styles.text}>{t('offline')}</Text>
      </View>
    </Animated.View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    banner: {
      backgroundColor: colors.offlineBg,
      paddingVertical: 9,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    text: {
      color: colors.offline,
      fontSize: 13,
      fontWeight: font.semibold,
    },
  });
