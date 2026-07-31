import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { BouncyPressable } from './Pressable';
import { useTheme } from '../context/ThemeContext';
import { font, radii, type ThemeColors } from '../theme';
import type { Garage } from '../types';

type Props = {
  garage: Garage;
  onPress: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
};

type CardStyles = ReturnType<typeof createStyles>;

function Stars({
  rating,
  styles,
  colors,
}: {
  rating: number | null;
  styles: CardStyles;
  colors: ThemeColors;
}) {
  if (rating == null) return null;
  const full = Math.round(rating);
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= full ? 'star' : 'star-outline'}
          size={11}
          color={colors.amberDark}
        />
      ))}
      <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
    </View>
  );
}

export function GarageCard({
  garage,
  onPress,
  isFavorite,
  onToggleFavorite,
}: Props) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  return (
    <Animated.View entering={FadeInDown.duration(320)}>
    <BouncyPressable onPress={onPress} style={styles.card}>
      {garage.photos?.[0] ? (
        <Image
          source={{ uri: garage.photos[0] }}
          style={styles.iconWrap}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.iconWrap, styles.iconPlaceholder]}>
          <Ionicons name="construct" size={22} color={colors.teal} />
        </View>
      )}

      <View style={styles.body}>
        <View style={styles.rowTop}>
          <Text style={styles.name} numberOfLines={1}>
            {garage.name}
          </Text>
          {onToggleFavorite && (
            <BouncyPressable onPress={onToggleFavorite} style={styles.favBtn}>
              <Ionicons
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={18}
                color={isFavorite ? colors.danger : colors.faint}
              />
            </BouncyPressable>
          )}
        </View>

        <Stars rating={garage.rating} styles={styles} colors={colors} />

        <View style={styles.rowInfo}>
          <Ionicons name="location" size={12} color={colors.amberDark} />
          <Text style={styles.city} numberOfLines={1}>
            {garage.city || 'Ville non renseignée'}
            {garage.distanceKm != null
              ? `  ·  ${garage.distanceKm.toFixed(1)} km`
              : ''}
          </Text>
        </View>

        {!!garage.promo && (
          <View style={styles.promo}>
            <Ionicons name="pricetag" size={11} color={colors.danger} />
            <Text style={styles.promoText} numberOfLines={1}>
              {garage.promo}
            </Text>
          </View>
        )}

        <View style={styles.rowBottom}>
          <View
            style={[
              styles.badge,
              {
                backgroundColor: garage.isOpen
                  ? colors.successSoft
                  : colors.dangerSoft,
              },
            ]}
          >
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: garage.isOpen
                    ? colors.success
                    : colors.danger,
                },
              ]}
            />
            <Text
              style={{
                color: garage.isOpen ? colors.success : colors.danger,
                fontSize: 10.5,
                fontWeight: font.bold,
              }}
            >
              {garage.isOpen ? 'Ouvert' : 'Fermé'}
            </Text>
          </View>
          {garage.mobileService && (
            <View style={styles.mobileBadge}>
              <Ionicons name="car" size={10} color={colors.teal} />
              <Text style={styles.mobileText}>Se déplace</Text>
            </View>
          )}
          {garage.services?.slice(0, 1).map((s) => (
            <View key={s} style={styles.chip}>
              <Text style={styles.chipText}>{s}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.arrow}>
        <Ionicons name="chevron-forward" size={15} color={colors.teal} />
      </View>
    </BouncyPressable>
    </Animated.View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  // Ligne éditoriale plate : filet fin en bas, pas de carte
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    paddingVertical: 16,
    gap: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  iconWrap: {
    width: 58,
    height: 58,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPlaceholder: { backgroundColor: colors.tealSoft },
  body: { flex: 1 },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: font.extrabold,
    color: colors.ink,
    letterSpacing: -0.2,
  },
  favBtn: { padding: 2 },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 3 },
  ratingText: {
    marginLeft: 4,
    fontSize: 11,
    fontWeight: font.bold,
    color: colors.amberDark,
  },
  rowInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  city: { flex: 1, color: colors.muted, fontSize: 12.5 },
  promo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
  },
  promoText: { color: colors.danger, fontSize: 11.5, fontWeight: font.bold, flex: 1 },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
  mobileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.tealSoft,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  mobileText: { fontSize: 10.5, color: colors.teal, fontWeight: font.bold },
  chip: {
    backgroundColor: colors.tealSoft,
    borderRadius: radii.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  chipText: {
    fontSize: 10.5,
    color: colors.tealDark,
    fontWeight: font.bold,
  },
  arrow: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
