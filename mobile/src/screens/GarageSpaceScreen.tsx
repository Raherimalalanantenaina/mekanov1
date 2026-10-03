import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchReceivedAppointments, fetchReceivedQuotes } from '../api/client';
import { BouncyPressable } from '../components/Pressable';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import { useSync } from '../sync';
import { font, radii, type ThemeColors } from '../theme';
import { MyGarageScreen } from './MyGarageScreen';
import { GarageInboxScreen } from './GarageInboxScreen';

type Section = 'sheet' | 'messages';

export function GarageSpaceScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const pad = width < 360 ? 14 : 18;
  const [section, setSection] = useState<Section>('sheet');
  const [pending, setPending] = useState(0);

  const loadPending = useCallback(async () => {
    if (!user) return;
    try {
      const [q, a] = await Promise.all([
        fetchReceivedQuotes(),
        fetchReceivedAppointments(),
      ]);
      setPending(
        q.filter((x) => x.status === 'pending').length +
          a.filter((x) => x.status === 'pending').length
      );
    } catch {
      // badge facultatif
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadPending();
    }, [loadPending])
  );

  useSync(['inbox'], () => {
    loadPending();
  });

  // Non connecté : l'écran « Mon garage » affiche déjà l'invitation à se connecter
  if (!user) return <MyGarageScreen />;

  const segments: { key: Section; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'sheet', label: t('spaceSheet'), icon: 'business-outline' },
    { key: 'messages', label: t('spaceMessages'), icon: 'mail-outline' },
  ];

  return (
    <View style={styles.root}>
      <View style={[styles.hero, { paddingTop: insets.top + 16, paddingHorizontal: pad }]}>
        <Text style={styles.heroTitle}>{t('myGarageTitle')}</Text>
        <Text style={styles.heroSub}>{t('myGarageSub')}</Text>
        <View style={styles.segment}>
          {segments.map((s) => {
            const active = section === s.key;
            return (
              <BouncyPressable
                key={s.key}
                onPress={() => setSection(s.key)}
                style={[styles.segBtn, active && styles.segBtnActive]}
              >
                <Ionicons
                  name={s.icon}
                  size={16}
                  color={active ? colors.white : colors.muted}
                />
                <Text style={[styles.segText, active && styles.segTextActive]}>
                  {s.label}
                </Text>
                {s.key === 'messages' && pending > 0 && (
                  <View style={[styles.badge, active && styles.badgeActive]}>
                    <Text style={[styles.badgeText, active && styles.badgeTextActive]}>
                      {pending > 99 ? '99+' : pending}
                    </Text>
                  </View>
                )}
              </BouncyPressable>
            );
          })}
        </View>
      </View>

      {/* Les deux vues restent montées pour ne pas perdre un formulaire en cours */}
      <View style={[styles.body, section !== 'sheet' && styles.hidden]}>
        <MyGarageScreen embedded />
      </View>
      <View style={[styles.body, section !== 'messages' && styles.hidden]}>
        <GarageInboxScreen embedded />
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    hero: { paddingBottom: 12 },
    heroTitle: {
      color: colors.ink,
      fontSize: 27,
      fontWeight: font.black,
      letterSpacing: -0.6,
    },
    heroSub: { color: colors.muted, fontSize: 12.5, marginTop: 4 },
    segment: {
      flexDirection: 'row',
      gap: 6,
      marginTop: 14,
      padding: 4,
      borderRadius: radii.pill,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.line,
    },
    segBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 9,
      borderRadius: radii.pill,
    },
    segBtnActive: { backgroundColor: colors.teal },
    segText: { color: colors.muted, fontWeight: font.bold, fontSize: 13 },
    segTextActive: { color: colors.white },
    badge: {
      minWidth: 18,
      height: 18,
      paddingHorizontal: 5,
      borderRadius: 9,
      backgroundColor: colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeActive: { backgroundColor: colors.white },
    badgeText: { color: colors.white, fontSize: 10.5, fontWeight: font.extrabold },
    badgeTextActive: { color: colors.teal },
    body: { flex: 1 },
    hidden: { display: 'none' },
  });
