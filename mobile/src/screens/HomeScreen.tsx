import React, { useCallback, useMemo, useState } from 'react';
import {
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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { fetchGarages, getFavorites, toggleFavorite, trackGarage } from '../api/client';
import { CategoryIcon } from '../components/CategoryIcon';
import { GarageCard, GarageCardSkeleton } from '../components/GarageCard';
import { OfflineBanner } from '../components/OfflineBanner';
import { BouncyPressable } from '../components/Pressable';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { isOpenNow } from '../hours';
import { useI18n } from '../i18n';
import { configText, garageFeatures, useAppConfig } from '../appConfig';
import { localized } from '../serviceCatalog';
import { font, radii, type ThemeColors } from '../theme';
import type { Garage } from '../types';
import type { RootStackParamList } from '../navigation/types';
import { notify } from '../components/Notifier';
import { useSync } from '../sync';

type SortMode = 'distance' | 'rating';

export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { offline, refreshConnectivity } = useAuth();
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const { config, catalog, logoUri } = useAppConfig();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const pad = width < 360 ? 14 : 18;

  const [q, setQ] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeService, setActiveService] = useState<string | null>(null);
  const [garages, setGarages] = useState<Garage[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [isOfflineData, setIsOfflineData] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
          fetchGarages({
            q: query ?? q,
            category: activeCategory ?? undefined,
            service: activeService ?? undefined,
            ...coords,
          }),
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
        setRefreshing(false);
      }
    },
    [q, activeCategory, activeService, refreshConnectivity]
  );

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  // Garage validé, fiche modifiée, offre activée… : rechargement discret
  useSync(['garages'], () => load());

  const search = (text = q) => {
    setLoading(true);
    load(text);
  };

  // Le changement de filtre recrée `load`, que useFocusEffect relance
  const applyCategory = (id: string | null) => {
    setActiveCategory((prev) => (id === null || prev === id ? null : id));
    setActiveService(null);
  };

  const currentCategory = catalog.find((c) => c.id === activeCategory);

  const onToggleFav = async (id: string) => {
    setFavorites(await toggleFavorite(id));
  };

  const displayed = useMemo(() => {
    let list = [...garages];
    if (onlyOpen) list = list.filter((g) => isOpenNow(g));
    if (onlyFav) list = list.filter((g) => favorites.includes(g.id));
    list.sort((a, b) =>
      sort === 'rating'
        ? (b.rating ?? 0) - (a.rating ?? 0)
        : (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
    );
    return list;
  }, [garages, onlyOpen, onlyFav, favorites, sort]);

  const openDetail = (g: Garage) => navigation.navigate('GarageDetail', { id: g.id });
  const callGarage = (g: Garage) => {
    trackGarage(g.id, 'call');
    Linking.openURL(`tel:${g.phone}`);
  };
  const onSos = () => {
    const open = displayed.filter((g) => isOpenNow(g));
    const target = open[0] ?? displayed[0];
    if (!target) {
      notify.warning('SOS', t('sosNone'));
      return;
    }
    const phone = garageFeatures(target).phone ? target.phone : '';
    notify.alert(
      t('sos'),
      `${target.name}${target.distanceKm != null ? ` · ${target.distanceKm.toFixed(1)} km` : ''}`,
      [
        { text: t('see'), onPress: () => openDetail(target) },
        ...(phone ? [{ text: t('call'), onPress: () => callGarage(target) }] : []),
        { text: t('cancel'), style: 'cancel' as const },
      ],
      { kind: 'error', icon: 'medkit' }
    );
  };

  const filtersActive = onlyOpen || onlyFav || sort === 'rating';

  const listHeader = (
    <View>
      {/* Types de service */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -pad }}
        contentContainerStyle={{ gap: 8, paddingHorizontal: pad }}
      >
        {[null, ...catalog].map((c) => {
          const active = c ? activeCategory === c.id : activeCategory === null;
          return (
            <BouncyPressable
              key={c?.id ?? '__all'}
              onPress={() => applyCategory(c?.id ?? null)}
              style={[styles.catChip, active && styles.catChipActive]}
            >
              {c ? (
                <CategoryIcon category={c} size={17} color={active ? colors.white : colors.teal} />
              ) : (
                <Ionicons name="apps" size={15} color={active ? colors.white : colors.teal} />
              )}
              <Text style={[styles.catChipText, active && styles.catChipTextActive]} numberOfLines={1}>
                {c ? localized(c, lang) : t('allSubtypes')}
              </Text>
            </BouncyPressable>
          );
        })}
      </ScrollView>

      {currentCategory && currentCategory.subtypes.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -pad, marginTop: 10 }}
          contentContainerStyle={{ gap: 6, paddingHorizontal: pad }}
        >
          {[null, ...currentCategory.subtypes].map((s) => {
            const value = s?.label ?? null;
            const active = activeService === value;
            return (
              <BouncyPressable
                key={s?.id ?? '__all'}
                onPress={() => setActiveService((prev) => (prev === value ? null : value))}
                style={[styles.subChip, active && styles.subChipActive]}
              >
                {active && <Ionicons name="checkmark" size={13} color={colors.teal} />}
                <Text style={[styles.subChipText, active && styles.subChipTextActive]}>
                  {s ? localized(s, lang) : t('allSubtypes')}
                </Text>
              </BouncyPressable>
            );
          })}
        </ScrollView>
      )}

      {/* Tri et filtres rapides */}
      <View style={styles.toolbar}>
        <BouncyPressable
          onPress={() => setSort((m) => (m === 'distance' ? 'rating' : 'distance'))}
          style={[styles.tool, sort === 'rating' && styles.toolActive]}
        >
          <Ionicons
            name={sort === 'distance' ? 'navigate-outline' : 'star'}
            size={14}
            color={sort === 'rating' ? colors.white : colors.ink}
          />
          <Text style={[styles.toolText, sort === 'rating' && styles.toolTextActive]}>
            {sort === 'distance' ? t('sortDistance') : t('sortRating')}
          </Text>
          <Ionicons name="swap-vertical" size={13} color={sort === 'rating' ? colors.white : colors.faint} />
        </BouncyPressable>
        <BouncyPressable
          onPress={() => setOnlyOpen((v) => !v)}
          style={[styles.tool, onlyOpen && styles.toolActive]}
        >
          <Ionicons name={onlyOpen ? 'time' : 'time-outline'} size={14} color={onlyOpen ? colors.white : colors.ink} />
          <Text style={[styles.toolText, onlyOpen && styles.toolTextActive]}>{t('openNow')}</Text>
        </BouncyPressable>
        <BouncyPressable
          onPress={() => setOnlyFav((v) => !v)}
          style={[styles.tool, onlyFav && styles.toolActive]}
        >
          <Ionicons name={onlyFav ? 'heart' : 'heart-outline'} size={14} color={onlyFav ? colors.white : colors.ink} />
          <Text style={[styles.toolText, onlyFav && styles.toolTextActive]}>{t('favorites')}</Text>
        </BouncyPressable>
        {filtersActive && (
          <BouncyPressable
            onPress={() => {
              setSort('distance');
              setOnlyOpen(false);
              setOnlyFav(false);
            }}
            style={styles.toolClear}
          >
            <Ionicons name="close" size={15} color={colors.muted} />
          </BouncyPressable>
        )}
      </View>

      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>
          {loading
            ? t('loadingGarages')
            : t(displayed.length > 1 ? 'garageMany' : 'garageOne', { n: displayed.length })}
        </Text>
        {!loading && syncedAt && (
          <Text style={styles.sync}>
            {isOfflineData ? `${t('cache')} · ` : ''}
            {new Date(syncedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12, paddingHorizontal: pad }]}>
        <View style={styles.brandRow}>
          <Image
            source={logoUri ? { uri: logoUri } : require('../../assets/mekano-logo.png')}
            style={styles.brandLogo}
            resizeMode="contain"
          />
          <Text style={styles.brand}>{config.appName}</Text>
          {config.features.sos && (
            <BouncyPressable onPress={onSos} style={styles.sosBtn}>
              <Ionicons name="flash" size={14} color={colors.white} />
              <Text style={styles.sosText}>{t('sos')}</Text>
            </BouncyPressable>
          )}
        </View>

        <Text style={styles.heroTitle}>
          {configText(config.texts.heroTitle1, lang, t('heroTitle1'))}{' '}
          <Text style={{ color: colors.teal }}>
            {configText(config.texts.heroTitle2, lang, t('heroTitle2'))}
          </Text>
        </Text>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={colors.faint} />
          <TextInput
            value={q}
            onChangeText={setQ}
            onSubmitEditing={() => search()}
            placeholder={configText(config.texts.searchPlaceholder, lang, t('searchPlaceholder'))}
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
                search('');
              }}
            />
          )}
          <BouncyPressable onPress={() => search()} style={styles.searchBtn}>
            <Ionicons name="arrow-forward" size={17} color={colors.white} />
          </BouncyPressable>
        </View>
      </View>

      <OfflineBanner offline={offline || isOfflineData} />

      <FlatList
        data={loading ? [] : displayed}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: pad, paddingTop: 12, paddingBottom: 28 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={listHeader}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.teal}
            colors={[colors.teal]}
          />
        }
        ListEmptyComponent={
          loading ? (
            <View>
              <GarageCardSkeleton />
              <GarageCardSkeleton />
              <GarageCardSkeleton />
            </View>
          ) : (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name={error ? 'cloud-offline-outline' : 'search-outline'}
                  size={28}
                  color={error ? colors.danger : colors.teal}
                />
              </View>
              <Text style={styles.emptyTitle}>{error ?? t('noGarageFound')}</Text>
              {!error && (onlyOpen || onlyFav || activeCategory || q) ? (
                <BouncyPressable
                  onPress={() => {
                    setOnlyOpen(false);
                    setOnlyFav(false);
                    setActiveCategory(null);
                    setActiveService(null);
                    if (q) {
                      setQ('');
                      search('');
                    }
                  }}
                  style={styles.resetBtn}
                >
                  <Text style={styles.resetText}>{t('resetFilters')}</Text>
                </BouncyPressable>
              ) : null}
            </View>
          )
        }
        renderItem={({ item, index }) => (
          <GarageCard
            garage={item}
            index={index}
            isFavorite={favorites.includes(item.id)}
            onToggleFavorite={() => onToggleFav(item.id)}
            onPress={() => openDetail(item)}
          />
        )}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    header: {
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
      backgroundColor: colors.bg,
    },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    brandLogo: { width: 32, height: 32 },
    brand: { flex: 1, color: colors.ink, fontSize: 17, fontWeight: font.black, letterSpacing: 0.2 },
    sosBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.danger,
      borderRadius: radii.pill,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    sosText: { color: colors.white, fontWeight: font.extrabold, fontSize: 12 },
    heroTitle: {
      color: colors.ink,
      fontSize: 23,
      fontWeight: font.black,
      letterSpacing: -0.5,
      lineHeight: 29,
      marginTop: 14,
      marginBottom: 12,
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.field,
      borderRadius: radii.md,
      paddingLeft: 14,
      paddingRight: 6,
      height: 50,
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
    // Types de service
    catChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      height: 38,
      paddingHorizontal: 14,
      borderRadius: radii.pill,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.line,
    },
    catChipActive: { backgroundColor: colors.teal, borderColor: colors.teal },
    catChipText: { fontSize: 13, fontWeight: font.bold, color: colors.ink, maxWidth: 160 },
    catChipTextActive: { color: colors.white },
    subChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      height: 30,
      paddingHorizontal: 12,
      borderRadius: radii.pill,
      backgroundColor: colors.field,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    subChipActive: { backgroundColor: colors.tealSoft, borderColor: colors.teal },
    subChipText: { color: colors.muted, fontSize: 12, fontWeight: font.semibold },
    subChipTextActive: { color: colors.teal, fontWeight: font.extrabold },
    // Tri / filtres
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 14,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },
    tool: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 32,
      paddingHorizontal: 12,
      borderRadius: radii.sm,
      backgroundColor: colors.field,
    },
    toolActive: { backgroundColor: colors.teal },
    toolText: { fontSize: 12.5, fontWeight: font.bold, color: colors.ink },
    toolTextActive: { color: colors.white },
    toolClear: {
      width: 32,
      height: 32,
      borderRadius: radii.sm,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.line,
    },
    listHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 18,
      marginBottom: 10,
    },
    listTitle: { fontSize: 15, fontWeight: font.extrabold, color: colors.ink },
    sync: { fontSize: 11, color: colors.faint },
    // Vide / erreur
    empty: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 24, gap: 12 },
    emptyIcon: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.field,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyTitle: { color: colors.muted, fontSize: 14, textAlign: 'center' },
    resetBtn: {
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.teal,
      paddingHorizontal: 16,
      paddingVertical: 9,
    },
    resetText: { color: colors.teal, fontWeight: font.extrabold, fontSize: 13 },
  });
