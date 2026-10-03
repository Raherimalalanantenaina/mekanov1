import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { BouncyPressable } from './Pressable';
import { CategoryIcon } from './CategoryIcon';
import { useTheme } from '../context/ThemeContext';
import { isOpenNow } from '../hours';
import { useI18n } from '../i18n';
import { garageFeatures, useAppConfig } from '../appConfig';
import { garageCategoryIds, getCategory, localized } from '../serviceCatalog';
import { font, radii, type ThemeColors } from '../theme';
import type { Garage } from '../types';

type Props = {
  garage: Garage;
  onPress: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  /** Boutons rapides (affichés seulement si l'offre du garage les inclut) */
  onCall?: () => void;
  onRoute?: () => void;
  index?: number;
};

export function GarageCard({
  garage,
  onPress,
  isFavorite,
  onToggleFavorite,
  onCall,
  onRoute,
  index = 0,
}: Props) {
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const { config } = useAppConfig();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const pf = garageFeatures(garage);
  const category = getCategory(garageCategoryIds(garage)[0] ?? '');
  const photo = pf.photos ? garage.photos?.[0] : undefined;
  const open = isOpenNow(garage);
  const showRating = config.features.reviews && pf.reviews && garage.rating != null;
  const featured = pf.boost && !!garage.plan && garage.plan !== 'free';
  const canCall = !!onCall && pf.phone && !!garage.phone;
  const canRoute = !!onRoute && pf.route;

  return (
    <Animated.View entering={FadeInDown.duration(300).delay(Math.min(index, 6) * 40)}>
      <BouncyPressable onPress={onPress} style={styles.card}>
        <View style={styles.main}>
          <View>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.photo} resizeMode="cover" />
            ) : (
              <View style={[styles.photo, styles.photoPlaceholder]}>
                <CategoryIcon category={category} size={34} color={colors.teal} />
              </View>
            )}
            {featured && (
              <View style={styles.featuredTag}>
                <Ionicons name="ribbon" size={10} color={colors.tealDeep} />
              </View>
            )}
          </View>

          <View style={styles.body}>
            <View style={styles.rowTop}>
              <Text style={styles.name} numberOfLines={1}>
                {garage.name}
              </Text>
              {onToggleFavorite && (
                <BouncyPressable onPress={onToggleFavorite} style={styles.favBtn}>
                  <Ionicons
                    name={isFavorite ? 'heart' : 'heart-outline'}
                    size={19}
                    color={isFavorite ? colors.danger : colors.faint}
                  />
                </BouncyPressable>
              )}
            </View>

            <Text style={styles.sub} numberOfLines={1}>
              {category ? localized(category, lang) : ''}
              {category && garage.city ? ' · ' : ''}
              {garage.city}
            </Text>

            <View style={styles.meta}>
              {showRating && (
                <View style={styles.metaItem}>
                  <Ionicons name="star" size={12} color={colors.amber} />
                  <Text style={styles.metaStrong}>{garage.rating!.toFixed(1)}</Text>
                  <Text style={styles.metaText}>({garage.reviewCount})</Text>
                </View>
              )}
              {garage.distanceKm != null && (
                <View style={styles.metaItem}>
                  <Ionicons name="navigate-outline" size={12} color={colors.muted} />
                  <Text style={styles.metaText}>
                    {garage.distanceKm < 1
                      ? `${Math.round(garage.distanceKm * 1000)} m`
                      : `${garage.distanceKm.toFixed(1)} km`}
                  </Text>
                </View>
              )}
              <View style={styles.metaItem}>
                <View style={[styles.dot, { backgroundColor: open ? colors.success : colors.danger }]} />
                <Text style={[styles.metaStrong, { color: open ? colors.success : colors.danger }]}>
                  {open ? t('openNowBadge') : t('closedNowBadge')}
                </Text>
              </View>
            </View>

            {pf.extras && (!!garage.promo || garage.mobileService) && (
              <View style={styles.tags}>
                {!!garage.promo && (
                  <View style={[styles.tag, { backgroundColor: colors.dangerSoft }]}>
                    <Ionicons name="pricetag" size={10} color={colors.danger} />
                    <Text style={[styles.tagText, { color: colors.danger }]} numberOfLines={1}>
                      {garage.promo}
                    </Text>
                  </View>
                )}
                {garage.mobileService && (
                  <View style={styles.tag}>
                    <Ionicons name="car" size={10} color={colors.teal} />
                    <Text style={styles.tagText}>{t('movesAround')}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        {(canCall || canRoute) && (
          <View style={styles.actions}>
            {canCall && (
              <BouncyPressable onPress={onCall!} style={[styles.action, styles.actionPrimary]}>
                <Ionicons name="call" size={14} color={colors.white} />
                <Text style={[styles.actionText, { color: colors.white }]}>{t('call')}</Text>
              </BouncyPressable>
            )}
            {canRoute && (
              <BouncyPressable onPress={onRoute!} style={styles.action}>
                <Ionicons name="navigate" size={14} color={colors.teal} />
                <Text style={styles.actionText}>{t('routeShort')}</Text>
              </BouncyPressable>
            )}
            <BouncyPressable onPress={onPress} style={styles.actionIcon}>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </BouncyPressable>
          </View>
        )}
      </BouncyPressable>
    </Animated.View>
  );
}

/** Carte fantôme affichée pendant le chargement. */
export function GarageCardSkeleton() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={[styles.card, { opacity: 0.7 }]}>
      <View style={styles.main}>
        <View style={[styles.photo, { backgroundColor: colors.field }]} />
        <View style={[styles.body, { gap: 8 }]}>
          <View style={[styles.skel, { width: '70%', height: 14 }]} />
          <View style={[styles.skel, { width: '45%' }]} />
          <View style={[styles.skel, { width: '60%' }]} />
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.line,
      padding: 12,
      marginBottom: 12,
    },
    main: { flexDirection: 'row', gap: 12 },
    photo: {
      width: 84,
      height: 84,
      borderRadius: radii.md,
      backgroundColor: colors.field,
    },
    photoPlaceholder: {
      backgroundColor: colors.tealSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    featuredTag: {
      position: 'absolute',
      top: 6,
      left: 6,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.amber,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: { flex: 1, justifyContent: 'center' },
    rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    name: {
      flex: 1,
      fontSize: 15.5,
      fontWeight: font.extrabold,
      color: colors.ink,
      letterSpacing: -0.2,
    },
    favBtn: { padding: 2 },
    sub: { color: colors.muted, fontSize: 12.5, marginTop: 2 },
    meta: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      columnGap: 12,
      rowGap: 4,
      marginTop: 8,
    },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaStrong: { fontSize: 12, fontWeight: font.bold, color: colors.ink },
    metaText: { fontSize: 12, color: colors.muted },
    dot: { width: 6, height: 6, borderRadius: 3 },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
    tag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.tealSoft,
      borderRadius: radii.pill,
      paddingHorizontal: 8,
      paddingVertical: 3,
      maxWidth: '100%',
    },
    tagText: { fontSize: 10.5, fontWeight: font.bold, color: colors.teal, flexShrink: 1 },
    actions: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },
    action: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 38,
      borderRadius: radii.sm,
      backgroundColor: colors.tealSoft,
    },
    actionPrimary: { backgroundColor: colors.teal },
    actionText: { fontSize: 13, fontWeight: font.extrabold, color: colors.teal },
    actionIcon: {
      width: 38,
      height: 38,
      borderRadius: radii.sm,
      backgroundColor: colors.field,
      alignItems: 'center',
      justifyContent: 'center',
    },
    skel: { height: 10, borderRadius: 5, backgroundColor: colors.field },
  });
