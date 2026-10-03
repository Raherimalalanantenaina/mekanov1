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
import { LinearGradient } from 'expo-linear-gradient';
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
import { garageCategoryIds, getCategory, localized } from '../serviceCatalog';
import { font, radii, type ThemeColors } from '../theme';
import type { Garage } from '../types';
import type { RootStackParamList } from '../navigation/types';
import { notify } from '../components/Notifier';

type SortMode = 'distance' | 'rating';
type Styles = ReturnType<typeof createStyles>;

const isFeatured = (g: Garage) => garageFeatures(g).boost && !!g.plan && g.plan !== 'free';

/** Carte « À la une » (garages avec l'offre « meilleure visibilité »). */
function FeaturedCard({
  garage,
  onPress,
  styles,
  colors,
  gradient,
}: {
  garage: Garage;
  onPress: () => void;
  styles: Styles;
  colors: ThemeColors;
  gradient: readonly [string, string];
}) {
  const { t, lang } = useI18n();
  const { config } = useAppConfig();
  const pf = garageFeatures(garage);
  const category = getCategory(garageCategoryIds(garage)[0] ?? '');
  const photo = pf.photos ? garage.photos?.[0] : undefined;
  const open = isOpenNow(garage);
  return (
    <BouncyPressable onPress={onPress} style={styles.featured}>
      {photo ? (
        <Image source={{ uri: photo }} style={styles.featuredImg} resizeMode="cover" />
      ) : (
        <LinearGradient colors={gradient} style={[styles.featuredImg, styles.featuredPlaceholder]}>
          <CategoryIcon category={category} size={44} color="rgba(255,255,255,0.92)" />
        </LinearGradient>
      )}
      <View style={styles.featuredBadge}>
        <Ionicons name="ribbon" size={11} color={colors.tealDeep} />
        <Text style={styles.featuredBadgeText}>{t('featuredBadge')}</Text>
      </View>
      <View style={styles.featuredBody}>
        <Text style={styles.featuredName} numberOfLines={1}>
          {garage.name}
        </Text>
        <Text style={styles.featuredSub} numberOfLines={1}>
          {category ? localized(category, lang) : garage.city}
        </Text>
        <View style={styles.featuredMeta}>
          {config.features.reviews && pf.reviews && garage.rating != null && (
            <View style={styles.featuredMetaItem}>
              <Ionicons name="star" size={11} color={colors.amber} />
              <Text style={styles.featuredMetaText}>{garage.rating.toFixed(1)}</Text>
            </View>
          )}
          {garage.distanceKm != null && (
            <View style={styles.featuredMetaItem}>
              <Ionicons name="navigate-outline" size={11} color={colors.muted} />
              <Text style={styles.featuredMetaText}>{garage.distanceKm.toFixed(1)} km</Text>
            </View>
          )}
          <View style={styles.featuredMetaItem}>
            <View style={[styles.featuredDot, { backgroundColor: open ? colors.success : colors.danger }]} />
            <Text style={[styles.featuredMetaText, { color: open ? colors.success : colors.danger }]}>
              {open ? t('openNowBadge') : t('closedNowBadge')}
            </Text>
          </View>
        </View>
      </View>
    </BouncyPressable>
  );
}

export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { offline, refreshConnectivity } = useAuth();
  const { t, lang } = useI18n();
  const { colors, gradients } = useTheme();
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

  const featured = useMemo(
    () => (onlyFav ? [] : displayed.filter(isFeatured).slice(0, 10)),
    [displayed, onlyFav]
  );

  const openDetail = (g: Garage) => navigation.navigate('GarageDetail', { id: g.id });
  const callGarage = (g: Garage) => {
    trackGarage(g.id, 'call');
    Linking.openURL(`tel:${g.phone}`);
  };
  const routeTo = (g: Garage) =>
    navigation.navigate('Route', {
      garageId: g.id,
      name: g.name,
      latitude: g.latitude,
      longitude: g.longitude,
    });

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

  const tools = [
    { key: 'open', icon: 'time-outline', label: t('openNow'), active: onlyOpen, onPress: () => setOnlyOpen((v) => !v) },
    { key: 'fav', icon: 'heart-outline', label: t('favorites'), active: onlyFav, onPress: () => setOnlyFav((v) => !v) },
  ] as const;

  const listHeader = (
    <View>
      {/* Types de service */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -pad }}
        contentContainerStyle={{ gap: 10, paddingHorizontal: pad, paddingTop: 4 }}
      >
        {[null, ...catalog].map((c) => {
          const active = c ? activeCategory === c.id : activeCategory === null;
          return (
            <BouncyPressable key={c?.id ?? '__all'} onPress={() => applyCategory(c?.id ?? null)} style={styles.cat}>
              <View style={[styles.catIcon, active && styles.catIconActive]}>
                {c ? (
                  <CategoryIcon category={c} size={26} color={active ? colors.white : colors.teal} />
                ) : (
                  <Ionicons name="apps" size={22} color={active ? colors.white : colors.teal} />
                )}
              </View>
              <Text style={[styles.catLabel, active && styles.catLabelActive]} numberOfLines={2}>
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
          contentContainerStyle={{ gap: 8, paddingHorizontal: pad }}
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
                <Text style={[styles.subChipText, active && styles.subChipTextActive]}>
                  {s ? localized(s, lang) : t('allSubtypes')}
                </Text>
              </BouncyPressable>
            );
          })}
        </ScrollView>
      )}

      {/* À la une */}
      {!loading && featured.length > 0 && (
        <View style={{ marginTop: 20 }}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>{t('featured')}</Text>
            <Text style={styles.sectionHint}>{t('featuredHint')}</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -pad }}
            contentContainerStyle={{ gap: 12, paddingHorizontal: pad }}
            decelerationRate="fast"
            snapToInterval={Math.min(260, width * 0.7) + 12}
          >
            {featured.map((g) => (
              <View key={g.id} style={{ width: Math.min(260, width * 0.7) }}>
                <FeaturedCard
                  garage={g}
                  onPress={() => openDetail(g)}
                  styles={styles}
                  colors={colors}
                  gradient={gradients.brand}
                />
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Tri et filtres */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -pad, marginTop: 20 }}
        contentContainerStyle={styles.toolbar}
      >
        <View style={[styles.segment, { marginLeft: pad }]}>
          {(['distance', 'rating'] as const).map((m) => (
            <BouncyPressable
              key={m}
              onPress={() => setSort(m)}
              style={[styles.segmentBtn, sort === m && styles.segmentBtnActive]}
            >
              <Text style={[styles.segmentText, sort === m && styles.segmentTextActive]}>
                {m === 'distance' ? t('sortDistance') : t('sortRating')}
              </Text>
            </BouncyPressable>
          ))}
        </View>
        {tools.map((tool) => (
          <BouncyPressable
            key={tool.key}
            onPress={tool.onPress}
            style={[styles.toolChip, tool.active && styles.toolChipActive]}
          >
            <Ionicons
              name={tool.active ? (tool.key === 'fav' ? 'heart' : 'time') : tool.icon}
              size={14}
              color={tool.active ? colors.white : colors.muted}
            />
            <Text style={[styles.toolText, tool.active && styles.toolTextActive]}>{tool.label}</Text>
          </BouncyPressable>
        ))}
        <View style={{ width: pad - 8 }} />
      </ScrollView>

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
            onCall={() => callGarage(item)}
            onRoute={() => routeTo(item)}
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
    cat: { width: 72, alignItems: 'center' },
    catIcon: {
      width: 56,
      height: 56,
      borderRadius: radii.lg,
      backgroundColor: colors.tealSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    catIconActive: { backgroundColor: colors.teal },
    catLabel: {
      marginTop: 6,
      fontSize: 11.5,
      lineHeight: 14,
      color: colors.muted,
      fontWeight: font.semibold,
      textAlign: 'center',
    },
    catLabelActive: { color: colors.ink, fontWeight: font.extrabold },
    subChip: {
      backgroundColor: colors.field,
      borderRadius: radii.pill,
      paddingHorizontal: 13,
      height: 32,
      justifyContent: 'center',
    },
    subChipActive: { backgroundColor: colors.tealSoft, borderWidth: 1, borderColor: colors.teal },
    subChipText: { color: colors.muted, fontSize: 12.5, fontWeight: font.semibold },
    subChipTextActive: { color: colors.teal, fontWeight: font.extrabold },
    // À la une
    sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 },
    sectionTitle: { fontSize: 17, fontWeight: font.black, color: colors.ink, letterSpacing: -0.3 },
    sectionHint: { fontSize: 11.5, color: colors.faint },
    featured: {
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.line,
      overflow: 'hidden',
    },
    featuredImg: { width: '100%', height: 120, backgroundColor: colors.field },
    featuredPlaceholder: { alignItems: 'center', justifyContent: 'center' },
    featuredBadge: {
      position: 'absolute',
      top: 10,
      left: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.amber,
      borderRadius: radii.pill,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    featuredBadgeText: { fontSize: 10.5, fontWeight: font.extrabold, color: colors.tealDeep },
    featuredBody: { padding: 12 },
    featuredName: { fontSize: 15, fontWeight: font.extrabold, color: colors.ink },
    featuredSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
    featuredMeta: { flexDirection: 'row', gap: 10, marginTop: 8 },
    featuredMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    featuredMetaText: { fontSize: 11.5, fontWeight: font.bold, color: colors.muted },
    featuredDot: { width: 6, height: 6, borderRadius: 3 },
    // Tri / filtres
    toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    segment: {
      width: 190,
      flexDirection: 'row',
      backgroundColor: colors.field,
      borderRadius: radii.pill,
      padding: 3,
    },
    segmentBtn: { flex: 1, height: 32, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
    segmentBtnActive: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
    segmentText: { fontSize: 12.5, fontWeight: font.bold, color: colors.muted },
    segmentTextActive: { color: colors.ink, fontWeight: font.extrabold },
    toolChip: {
      flexDirection: 'row',
      gap: 6,
      height: 38,
      paddingHorizontal: 13,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    toolChipActive: { backgroundColor: colors.teal, borderColor: colors.teal },
    toolText: { fontSize: 12.5, fontWeight: font.bold, color: colors.muted },
    toolTextActive: { color: colors.white },
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
