import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map as MapLibreMap,
  Marker,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { fetchRoute, LatLng, RouteResult } from '../api/client';
import { BouncyPressable } from '../components/Pressable';
import { GarageMapPin } from '../components/GarageMapPin';
import { UserLocationMarker } from '../components/UserLocationMarker';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import { mapStyleFor, boundsOf, zoomForDelta } from '../map/osm';
import { font, radii, shadow, type ThemeColors } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Route'>;

export function RouteScreen({ route, navigation }: Props) {
  const { garageId, name, latitude, longitude } = route.params;
  const { colors, mode } = useTheme();
  const { t } = useI18n();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const mapStyle = React.useMemo(() => mapStyleFor(mode), [mode]);
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraRef>(null);
  const [userPos, setUserPos] = useState<LatLng | null>(null);
  const [result, setResult] = useState<RouteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const destination: LatLng = { latitude, longitude };

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError(t('locationNeeded'));
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const from = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
      setUserPos(from);
      const r = await fetchRoute(from, destination, garageId);
      setResult(r);
      setTimeout(() => {
        cameraRef.current?.fitBounds(
          boundsOf([from, destination, ...r.coords]),
          {
            padding: { top: 120, bottom: 200, left: 60, right: 60 },
            duration: 800,
          }
        );
      }, 400);
    })().catch(() => setError(t('routeError')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude]);

  return (
    <View style={styles.root}>
      <MapLibreMap style={StyleSheet.absoluteFill} mapStyle={mapStyle}>
        <Camera
          ref={cameraRef}
          initialViewState={{
            center: [longitude, latitude],
            zoom: zoomForDelta(0.1),
          }}
        />

        {result && (
          <GeoJSONSource
            id="route"
            data={{
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: result.coords.map((c) => [
                  c.longitude,
                  c.latitude,
                ]),
              },
            }}
          >
            {/* Liseré blanc dessous pour le contraste */}
            <Layer
              id="route-casing"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{
                'line-color': '#FFFFFF',
                'line-width': 11,
                ...(result.straightLine
                  ? { 'line-dasharray': [1.2, 1] }
                  : {}),
              }}
            />
            <Layer
              id="route-line"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{
                'line-color': '#0E7C86',
                'line-width': 6,
                ...(result.straightLine
                  ? { 'line-dasharray': [1.2, 1] }
                  : {}),
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
        <Marker lngLat={[longitude, latitude]} anchor="bottom">
          <GarageMapPin selected />
        </Marker>
      </MapLibreMap>

      {/* Retour */}
      <BouncyPressable
        onPress={() => navigation.goBack()}
        style={[styles.back, shadow.float, { top: insets.top + 10 }]}
      >
        <Ionicons name="arrow-back" size={20} color={colors.ink} />
      </BouncyPressable>

      {/* Panneau d'infos */}
      <View style={[styles.panel, shadow.float, { bottom: 18 + insets.bottom }]}>
        <View style={styles.panelIcon}>
          <Ionicons name="navigate" size={20} color={colors.teal} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.panelTitle} numberOfLines={1}>
            {t('towards', { name })}
          </Text>
          {error ? (
            <Text style={styles.panelError}>{error}</Text>
          ) : result ? (
            <Text style={styles.panelInfo}>
              {t('routeSummary', {
                km: result.distanceKm.toFixed(1),
                min: Math.round(result.durationMin),
              })}
              {result.fromCache ? ` ${t('cachedRouteNote')}` : ''}
              {result.straightLine ? ` ${t('straightLineNote')}` : ''}
            </Text>
          ) : (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.teal} />
              <Text style={styles.panelInfo}>{t('calculatingRoute')}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  back: {
    position: 'absolute',
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: 16,
  },
  panelIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelTitle: { fontWeight: font.extrabold, fontSize: 15.5, color: colors.ink },
  panelInfo: { color: colors.muted, fontSize: 13, marginTop: 3 },
  panelError: { color: colors.danger, fontSize: 13, marginTop: 3 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
