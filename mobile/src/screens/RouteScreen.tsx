import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { fetchRoute, LatLng, RouteResult } from '../api/client';
import { BouncyPressable } from '../components/Pressable';
import { UserLocationMarker } from '../components/UserLocationMarker';
import { useTheme } from '../context/ThemeContext';
import { font, radii, shadow, type ThemeColors } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Route'>;

export function RouteScreen({ route, navigation }: Props) {
  const { name, latitude, longitude } = route.params;
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const [userPos, setUserPos] = useState<LatLng | null>(null);
  const [result, setResult] = useState<RouteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const destination: LatLng = { latitude, longitude };

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Autorise la localisation pour tracer l’itinéraire.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const from = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
      setUserPos(from);
      const r = await fetchRoute(from, destination);
      setResult(r);
      setTimeout(() => {
        mapRef.current?.fitToCoordinates([from, destination, ...r.coords], {
          edgePadding: { top: 120, bottom: 200, left: 60, right: 60 },
          animated: true,
        });
      }, 400);
    })().catch(() =>
      setError('Impossible de calculer l’itinéraire pour le moment.')
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude]);

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude,
          longitude,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }}
        showsUserLocation={false}
      >
        {userPos && (
          <Marker coordinate={userPos} anchor={{ x: 0.5, y: 0.5 }} zIndex={10}>
            <UserLocationMarker />
          </Marker>
        )}
        <Marker coordinate={destination}>
          <View style={styles.destMarker}>
            <Ionicons name="construct" size={15} color={colors.tealDeep} />
          </View>
        </Marker>
        {result && (
          <>
            {/* Liseré blanc dessous pour le contraste */}
            <Polyline
              coordinates={result.coords}
              strokeColor="#FFFFFF"
              strokeWidth={11}
              lineDashPattern={result.straightLine ? [12, 10] : undefined}
            />
            <Polyline
              coordinates={result.coords}
              strokeColor="#0E7C86"
              strokeWidth={6}
              lineDashPattern={result.straightLine ? [12, 10] : undefined}
            />
          </>
        )}
      </MapView>

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
            Vers {name}
          </Text>
          {error ? (
            <Text style={styles.panelError}>{error}</Text>
          ) : result ? (
            <Text style={styles.panelInfo}>
              {result.distanceKm.toFixed(1)} km ·{' '}
              {Math.round(result.durationMin)} min en voiture
              {result.straightLine ? ' (estimation à vol d’oiseau)' : ''}
            </Text>
          ) : (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.teal} />
              <Text style={styles.panelInfo}>Calcul de l’itinéraire…</Text>
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
  destMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: colors.white,
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
