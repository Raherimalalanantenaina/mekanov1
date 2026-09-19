import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { fetchGarages, getFavorites, toggleFavorite } from '../api/client';
import { GarageCard } from '../components/GarageCard';
import { OfflineBanner } from '../components/OfflineBanner';
import { BouncyPressable } from '../components/Pressable';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { isOpenNow } from '../hours';
import { useI18n } from '../i18n';
import { font, radii, type ThemeColors } from '../theme';
import type { Garage } from '../types';
import type { RootStackParamList } from '../navigation/types';

const QUICK_FILTERS = [
  'vidange',
  'freins',
  'pneus',
  'diagnostic',
  'moteur',
  'lavage',
];
type SortMode = 'distance' | 'rating';

export function HomeScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { offline, refreshConnectivity } = useAuth();
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const pad = width < 360 ? 14 : 18;

  const [q, setQ] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [garages, setGarages] = useState<Garage[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [isOfflineData, setIsOfflineData] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>('distance');
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [onlyFav, setOnlyFav] = useState(false);

  const load = useCallback(
    async (query?: string) => {
      setError(null);
      await refreshConnectivity();
      try {
        let coords: { lat?: number; lng?: number } = {};
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        }
        const [data, favs] = await Promise.all([
          fetchGarages({ q: query ?? q, ...coords }),
          getFavorites(),
        ]);
        setGarages(data.garages);
        setFavorites(favs);
        setSyncedAt(data.syncedAt);
        setIsOfflineData(data.offline);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur de chargement');
      } finally {
        setLoading(false);
      }
    },
    [q, refreshConnectivity]
  );

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const applyFilter = (f: string) => {
    const next = activeFilter === f ? null : f;
    setActiveFilter(next);
    setQ(next ?? '');
    setLoading(true);
    load(next ?? '');
  };

  const onToggleFav = async (id: string) => {
    const next = await toggleFavorite(id);
    setFavorites(next);
  };

  const displayed = useMemo(() => {
    let list = [...garages];
    if (onlyOpen) list = list.filter((g) => isOpenNow(g));
    if (onlyFav) list = list.filter((g) => favorites.includes(g.id));
    list.sort((a, b) => {
      if (sort === 'rating') {
        return (b.rating ?? 0) - (a.rating ?? 0);
      }
      return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
    });
    return list;
  }, [garages, onlyOpen, onlyFav, favorites, sort]);

  const onSos = () => {
    const open = displayed.filter((g) => isOpenNow(g));
    const target = open[0] ?? displayed[0];
    if (!target) {
      Alert.alert('SOS', t('sosNone'));
      return;
    }
    Alert.alert(
      t('sos'),
      `${target.name}${
        target.distanceKm != null
          ? ` · ${target.distanceKm.toFixed(1)} km`
          : ''
      }`,
      [
        { text: 'Voir', onPress: () => navigation.navigate('GarageDetail', { id: target.id }) },
        ...(target.phone
          ? [
              {
                text: t('call'),
                onPress: () => Linking.openURL(`tel:${target.phone}`),
              },
            ]
          : []),
        { text: 'Annuler', style: 'cancel' as const },
      ]
    );
  };

  return (
    <View style={styles.root}>
      {/* Header plat, typographie forte */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 14, paddingHorizontal: pad },
        ]}
      >
        <View style={styles.brandRow}>
          <Image
            source={require('../../assets/mekano-logo.png')}
            style={styles.brandLogo}
            resizeMode="contain"
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.brand}>Mekano</Text>
          </View>
          <BouncyPressable onPress={onSos} style={styles.sosBtn}>
            <Ionicons name="flash" size={15} color={colors.white} />
            <Text style={styles.sosText}>{t('sos')}</Text>
          </BouncyPressable>
        </View>

        <Text style={styles.heroTitle}>
          {t('heroTitle1')}{' '}
          <Text style={{ color: colors.teal }}>{t('heroTitle2')}</Text>
        </Text>
      </View>

      {/* Recherche : champ plat */}
      <Animated.View
        entering={FadeInDown.duration(380)}
        style={[styles.searchWrap, { marginHorizontal: pad }]}
      >
        <Ionicons name="search" size={18} color={colors.teal} />
        <TextInput
          value={q}
          onChangeText={setQ}
          onSubmitEditing={() => {
            setLoading(true);
            load(q);
          }}
          placeholder={t('searchPlaceholder')}
          placeholderTextColor={colors.faint}
          style={styles.search}
          returnKeyType="search"
        />
        {q.length > 0 && (
          <Ionicons
            name="close-circle"
            size={18}
            color={colors.faint}
            onPress={() => {
              setQ('');
              setActiveFilter(null);
              setLoading(true);
              load('');
            }}
          />
        )}
        <BouncyPressable
          onPress={() => {
            setLoading(true);
            load(q);
          }}
          style={styles.searchBtn}
        >
          <Ionicons name="arrow-forward" size={17} color={colors.white} />
        </BouncyPressable>
      </Animated.View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: 12, flexGrow: 0, flexShrink: 0 }}
        contentContainerStyle={{
          gap: 8,
          paddingHorizontal: pad,
          alignItems: 'center',
        }}
      >
        {QUICK_FILTERS.map((f) => {
          const active = activeFilter === f;
          return (
            <BouncyPressable
              key={f}
              onPress={() => applyFilter(f)}
              style={[styles.filterChip, active && styles.filterChipActive]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  active && styles.filterChipTextActive,
                ]}
              >
                {f}
              </Text>
            </BouncyPressable>
          );
        })}
      </ScrollView>

      <OfflineBanner offline={offline || isOfflineData} />

      {/* Tri / filtres */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.toolsBar}
        contentContainerStyle={[styles.tools, { paddingHorizontal: pad }]}
      >
        {(
          [
            {
              key: 'distance',
              label: t('sortDistance'),
              active: sort === 'distance',
              onPress: () => setSort('distance'),
            },
            {
              key: 'rating',
              label: t('sortRating'),
              active: sort === 'rating',
              onPress: () => setSort('rating'),
            },
            {
              key: 'open',
              label: t('openNow'),
              active: onlyOpen,
              onPress: () => setOnlyOpen((v) => !v),
            },
            {
              key: 'fav',
              label: t('favorites'),
              active: onlyFav,
              onPress: () => setOnlyFav((v) => !v),
            },
          ] as const
        ).map((tool) => (
          <BouncyPressable
            key={tool.key}
            onPress={tool.onPress}
            style={[styles.toolChip, tool.active && styles.toolChipActive]}
          >
            <Text
              style={[styles.toolText, tool.active && styles.toolTextActive]}
            >
              {tool.label}
            </Text>
          </BouncyPressable>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.teal} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: pad, paddingBottom: 28 }}
          ListHeaderComponent={
            <View>
              {!isOfflineData && displayed[0]?.distanceKm != null && sort === 'distance' && (
                <BouncyPressable
                  onPress={() =>
                    navigation.navigate('GarageDetail', { id: displayed[0].id })
                  }
                  style={styles.nearest}
                >
                  <View style={styles.nearestIcon}>
                    <Ionicons name="flash" size={16} color={colors.tealDeep} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.nearestLabel}>{t('nearestLabel')}</Text>
                    <Text style={styles.nearestName} numberOfLines={1}>
                      {displayed[0].name} ·{' '}
                      {displayed[0].distanceKm!.toFixed(1)} km
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={colors.amberDark}
                  />
                </BouncyPressable>
              )}
              <View style={styles.listHeader}>
                <Text style={styles.listTitle}>
                  {displayed.length} garage{displayed.length > 1 ? 's' : ''}{' '}
                  {t('found')}
                  {displayed.length > 1 ? 's' : ''}
                </Text>
                {syncedAt && (
                  <Text style={styles.sync}>
                    {isOfflineData ? 'cache · ' : ''}
                    {new Date(syncedAt).toLocaleTimeString()}
                  </Text>
                )}
              </View>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => load()}
              tintColor={colors.teal}
              colors={[colors.teal]}
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="car-outline" size={44} color={colors.faint} />
              <Text style={styles.empty}>{t('noGarageFound')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <GarageCard
              garage={item}
              isFavorite={favorites.includes(item.id)}
              onToggleFavorite={() => onToggleFav(item.id)}
              onPress={() =>
                navigation.navigate('GarageDetail', { id: item.id })
              }
            />
          )}
        />
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingBottom: 4 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandLogo: { width: 36, height: 36 },
  brand: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: font.black,
    letterSpacing: 0.3,
  },
  sosBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.danger,
    borderRadius: radii.pill,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  sosText: {
    color: colors.white,
    fontWeight: font.extrabold,
    fontSize: 12,
  },
  heroTitle: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: font.black,
    letterSpacing: -0.6,
    lineHeight: 34,
    marginTop: 18,
    marginBottom: 14,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.field,
    borderRadius: radii.md,
    paddingHorizontal: 16,
    paddingRight: 8,
    height: 52,
  },
  search: { flex: 1, fontSize: 15, color: colors.ink },
  searchBtn: {
    width: 38,
    height: 38,
    borderRadius: radii.sm,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChip: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    height: 34,
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: colors.teal,
    borderColor: colors.teal,
  },
  filterChipText: {
    color: colors.muted,
    fontSize: 12.5,
    fontWeight: font.semibold,
  },
  filterChipTextActive: {
    color: colors.white,
    fontWeight: font.extrabold,
  },
  toolsBar: { flexGrow: 0, flexShrink: 0 },
  tools: { gap: 8, paddingVertical: 10, alignItems: 'center' },
  toolChip: {
    backgroundColor: colors.bg,
    borderRadius: radii.pill,
    paddingHorizontal: 13,
    height: 34,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
  },
  toolChipActive: {
    backgroundColor: colors.teal,
    borderColor: colors.teal,
  },
  toolText: { fontSize: 12.5, fontWeight: font.bold, color: colors.muted },
  toolTextActive: { color: colors.white },
  nearest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: colors.amberSoft,
    borderRadius: radii.lg,
    padding: 14,
    marginBottom: 14,
  },
  nearestIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nearestLabel: {
    fontSize: 10.5,
    fontWeight: font.bold,
    color: colors.amberDark,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  nearestName: {
    fontSize: 14,
    fontWeight: font.extrabold,
    color: colors.ink,
    marginTop: 2,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  listTitle: {
    fontSize: 15,
    fontWeight: font.extrabold,
    color: colors.ink,
  },
  sync: { fontSize: 11, color: colors.faint },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: 10,
  },
  error: { color: colors.danger, textAlign: 'center', paddingHorizontal: 30 },
  empty: { color: colors.muted, fontSize: 14 },
});
