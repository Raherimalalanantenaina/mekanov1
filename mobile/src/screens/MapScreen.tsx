import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map as MapLibreMap,
  Marker,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { fetchGarages } from '../api/client';
import { OfflineBanner } from '../components/OfflineBanner';
import { BouncyPressable } from '../components/Pressable';
import { UserLocationMarker } from '../components/UserLocationMarker';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { OSM_STYLE, circlePolygon, zoomForDelta } from '../map/osm';
import { font, radii, shadow, type ThemeColors } from '../theme';
import type { Garage } from '../types';
import type { RootStackParamList } from '../navigation/types';

const DEFAULT_CENTER: [number, number] = [47.5079, -18.8792];

const RADIUS_OPTIONS = [1, 3, 5, 10] as const;

function haversineKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) *
      Math.cos((b.latitude * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function MapScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { offline } = useAuth();
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraRef>(null);
  const [garages, setGarages] = useState<Garage[]>([]);
  const [selected, setSelected] = useState<Garage | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOfflineData, setIsOfflineData] = useState(false);
  const [userPos, setUserPos] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [radiusKm, setRadiusKm] = useState<number | null>(null);
  const [q, setQ] = useState('');

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setLoading(true);
        try {
          const { status } =
            await Location.requestForegroundPermissionsAsync();
          let lat: number | undefined;
          let lng: number | undefined;
          if (status === 'granted') {
            const pos = await Location.getCurrentPositionAsync({});
            lat = pos.coords.latitude;
            lng = pos.coords.longitude;
            setUserPos({ latitude: lat, longitude: lng });
            cameraRef.current?.easeTo({
              center: [lng, lat],
              zoom: zoomForDelta(0.08),
              duration: 800,
            });
          }
          const data = await fetchGarages({ lat, lng });
          setGarages(data.garages);
          setIsOfflineData(data.offline);
        } finally {
          setLoading(false);
        }
      })();
    }, [])
  );

  /** Distance calculée localement si absente (cache hors ligne). */
  const withDistance = useMemo(() => {
    if (!userPos) return garages;
    return garages.map((g) => ({
      ...g,
      distanceKm:
        g.distanceKm ??
        haversineKm(userPos, { latitude: g.latitude, longitude: g.longitude }),
    }));
  }, [garages, userPos]);

  /** Garages filtrés par recherche + rayon, triés par distance. */
  const visible = useMemo(() => {
    let list = withDistance;
    const term = q.trim().toLowerCase();
    if (term) {
      list = list.filter(
        (g) =>
          g.name.toLowerCase().includes(term) ||
          g.city.toLowerCase().includes(term) ||
          g.address.toLowerCase().includes(term) ||
          g.services?.some((s) => s.toLowerCase().includes(term))
      );
    }
    if (radiusKm != null && userPos) {
      list = list.filter(
        (g) => g.distanceKm != null && g.distanceKm <= radiusKm
      );
    }
    return [...list].sort(
      (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
    );
  }, [withDistance, q, radiusKm, userPos]);

  const nearest = userPos && visible[0]?.distanceKm != null ? visible[0] : null;

  const applyRadius = (r: number | null) => {
    setRadiusKm(r);
    setSelected(null);
    if (r != null && userPos) {
      const delta = (r * 2.6) / 111;
      cameraRef.current?.easeTo({
        center: [userPos.longitude, userPos.latitude],
        zoom: zoomForDelta(delta),
        duration: 600,
      });
    }
  };

  const focusGarage = (g: Garage) => {
    setSelected(g);
    cameraRef.current?.easeTo({
      center: [g.longitude, g.latitude],
      zoom: zoomForDelta(0.03),
      duration: 600,
    });
  };

  return (
    <View style={styles.root}>
      <MapLibreMap
        style={StyleSheet.absoluteFill}
        mapStyle={OSM_STYLE}
        onPress={() => setSelected(null)}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{
            center: DEFAULT_CENTER,
            zoom: zoomForDelta(0.12),
          }}
        />

        {/* Cercle du rayon de recherche */}
        {radiusKm != null && userPos && (
          <GeoJSONSource
            id="radius-circle"
            data={circlePolygon(userPos, radiusKm)}
          >
            <Layer
              id="radius-fill"
              type="fill"
              paint={{ 'fill-color': 'rgba(18,113,122,0.08)' }}
            />
            <Layer
              id="radius-line"
              type="line"
              paint={{
                'line-color': 'rgba(18,113,122,0.8)',
                'line-width': 2,
              }}
            />
          </GeoJSONSource>
        )}

        {userPos && (
          <Marker
            lngLat={[userPos.longitude, userPos.latitude]}
            anchor="center"
          >
            <UserLocationMarker />
          </Marker>
        )}

        {visible.map((g) => {
          const isNearest = nearest?.id === g.id;
          const isSelected = selected?.id === g.id;
          return (
            <Marker
              key={g.id}
              lngLat={[g.longitude, g.latitude]}
              anchor="center"
              onPress={() => focusGarage(g)}
            >
              <View collapsable={false} style={styles.markerWrap}>
                <View
                  style={[
                    styles.marker,
                    isNearest && styles.markerNearest,
                    isSelected && styles.markerActive,
                  ]}
                >
                  <Ionicons
                    name={isNearest ? 'flash' : 'construct'}
                    size={15}
                    color={
                      isNearest || isSelected ? colors.tealDeep : colors.white
                    }
                  />
                </View>
              </View>
            </Marker>
          );
        })}
      </MapLibreMap>

      {/* Bandeau haut : recherche + compteur + rayon */}
      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <OfflineBanner offline={offline || isOfflineData} />

        {/* Barre de recherche */}
        <View style={[styles.searchWrap, shadow.float]}>
          <Ionicons name="search" size={17} color={colors.muted} />
          <TextInput
            value={q}
            onChangeText={(t) => {
              setQ(t);
              setSelected(null);
            }}
            onSubmitEditing={() => {
              const first = visible[0];
              if (first) focusGarage(first);
            }}
            placeholder="Nom, ville, service…"
            placeholderTextColor={colors.faint}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {q.length > 0 && (
            <Ionicons
              name="close-circle"
              size={17}
              color={colors.faint}
              onPress={() => {
                setQ('');
                setSelected(null);
              }}
            />
          )}
        </View>

        <View style={[styles.counter, shadow.float]}>
          <Ionicons name="map" size={15} color={colors.teal} />
          <Text style={styles.counterText}>
            {loading
              ? 'Chargement…'
              : radiusKm != null
                ? `${visible.length} garage${visible.length > 1 ? 's' : ''} à moins de ${radiusKm} km`
                : `${visible.length} garage${visible.length > 1 ? 's' : ''}`}
          </Text>
          {loading && <ActivityIndicator size="small" color={colors.teal} />}
        </View>

        {/* Sélecteur de rayon */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}
        >
          <BouncyPressable
            onPress={() => applyRadius(null)}
            style={[
              styles.radiusChip,
              shadow.card,
              radiusKm == null && styles.radiusChipActive,
            ]}
          >
            <Text
              style={[
                styles.radiusText,
                radiusKm == null && styles.radiusTextActive,
              ]}
            >
              Tous
            </Text>
          </BouncyPressable>
          {RADIUS_OPTIONS.map((r) => {
            const active = radiusKm === r;
            return (
              <BouncyPressable
                key={r}
                onPress={() => applyRadius(r)}
                style={[
                  styles.radiusChip,
                  shadow.card,
                  active && styles.radiusChipActive,
                ]}
              >
                <Text
                  style={[styles.radiusText, active && styles.radiusTextActive]}
                >
                  {r} km
                </Text>
              </BouncyPressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Recentrer sur moi */}
      {userPos && (
        <BouncyPressable
          onPress={() =>
            cameraRef.current?.easeTo({
              center: [userPos.longitude, userPos.latitude],
              zoom: zoomForDelta(0.05),
              duration: 600,
            })
          }
          style={[styles.locateBtn, shadow.float, { bottom: 118 + insets.bottom }]}
        >
          <Ionicons name="locate" size={20} color={colors.teal} />
        </BouncyPressable>
      )}

      {/* Carrousel bas : liste rapide */}
      {!selected && visible.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.strip, { bottom: 16 + insets.bottom }]}
          contentContainerStyle={{ paddingHorizontal: 14, gap: 10 }}
        >
          {visible.map((g) => (
            <BouncyPressable
              key={g.id}
              onPress={() => focusGarage(g)}
              style={[styles.stripCard, shadow.card, { width: width * 0.6 }]}
            >
              <View style={styles.stripHead}>
                <Text style={styles.stripName} numberOfLines={1}>
                  {g.name}
                </Text>
                {nearest?.id === g.id && (
                  <Ionicons name="flash" size={13} color={colors.amberDark} />
                )}
              </View>
              <Text style={styles.stripCity} numberOfLines={1}>
                {g.city}
                {g.distanceKm != null ? ` · ${g.distanceKm.toFixed(1)} km` : ''}
              </Text>
            </BouncyPressable>
          ))}
        </ScrollView>
      )}

      {/* Aucun résultat */}
      {!loading && visible.length === 0 && (q.trim() || radiusKm != null) && (
        <View style={[styles.emptyRadius, shadow.float, { bottom: 20 + insets.bottom }]}>
          <Ionicons name="search-outline" size={17} color={colors.danger} />
          <Text style={styles.emptyRadiusText}>
            {q.trim()
              ? `Aucun garage pour « ${q.trim()} »`
              : `Aucun garage à moins de ${radiusKm} km — élargis le rayon`}
          </Text>
        </View>
      )}

      {/* Fiche sélectionnée */}
      {selected && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={[styles.sheet, shadow.float, { bottom: 16 + insets.bottom }]}
        >
          <View style={styles.sheetIcon}>
            <Ionicons name="construct" size={22} color={colors.teal} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sheetName} numberOfLines={1}>
              {selected.name}
            </Text>
            <Text style={styles.sheetInfo} numberOfLines={1}>
              {selected.city}
              {selected.distanceKm != null
                ? ` · ${selected.distanceKm.toFixed(1)} km`
                : ''}
            </Text>
            {selected.services?.length > 0 && (
              <Text style={styles.sheetServices} numberOfLines={1}>
                {selected.services.join(' · ')}
              </Text>
            )}
          </View>
          <BouncyPressable
            onPress={() =>
              navigation.navigate('GarageDetail', { id: selected.id })
            }
            style={styles.sheetBtn}
          >
            <Ionicons name="arrow-forward" size={19} color={colors.white} />
          </BouncyPressable>
        </Animated.View>
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    position: 'absolute',
    left: 14,
    right: 14,
    gap: 8,
    alignItems: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    alignSelf: 'stretch',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    paddingHorizontal: 15,
    height: 50,
  },
  searchInput: { flex: 1, fontSize: 14.5, color: colors.ink },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  counterText: {
    fontSize: 13,
    fontWeight: font.extrabold,
    color: colors.ink,
  },
  radiusChip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  radiusChipActive: {
    backgroundColor: colors.teal,
  },
  radiusText: {
    fontSize: 12.5,
    fontWeight: font.bold,
    color: colors.muted,
  },
  radiusTextActive: { color: colors.white },
  markerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
  },
  marker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: colors.white,
  },
  markerNearest: { backgroundColor: colors.amber },
  markerActive: {
    backgroundColor: colors.amber,
    transform: [{ scale: 1.15 }],
  },
  locateBtn: {
    position: 'absolute',
    right: 16,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  strip: { position: 'absolute', left: 0, right: 0 },
  stripCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: 13,
  },
  stripHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  stripName: {
    flex: 1,
    fontWeight: font.extrabold,
    color: colors.ink,
    fontSize: 14,
  },
  stripCity: { color: colors.muted, fontSize: 12, marginTop: 3 },
  emptyRadius: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: 14,
  },
  emptyRadiusText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: font.semibold,
  },
  sheet: {
    position: 'absolute',
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: 15,
  },
  sheetIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetName: { fontWeight: font.extrabold, fontSize: 15.5, color: colors.ink },
  sheetInfo: { color: colors.muted, fontSize: 12.5, marginTop: 2 },
  sheetServices: { color: colors.faint, fontSize: 11.5, marginTop: 3 },
  sheetBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
