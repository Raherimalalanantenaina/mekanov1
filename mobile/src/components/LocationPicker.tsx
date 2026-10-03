import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';
import { Camera, Map as MapLibreMap, type CameraRef } from '@maplibre/maplibre-react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { BouncyPressable } from './Pressable';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import { mapStyleFor } from '../map/osm';
import { font, radii, shadow, type ThemeColors } from '../theme';

export type Coords = { latitude: number; longitude: number };

const DEFAULT_CENTER: Coords = { latitude: -18.8792, longitude: 47.5079 };

async function currentPosition(): Promise<Coords | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
}

/**
 * Carte plein écran avec une épingle fixe au centre : on déplace la carte
 * sous l'épingle pour viser l'emplacement exact du garage.
 */
export function LocationPicker({
  visible,
  initial,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  initial: Coords | null;
  onCancel: () => void;
  onConfirm: (coords: Coords) => void;
}) {
  const { colors, mode } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const mapStyle = React.useMemo(() => mapStyleFor(mode), [mode]);
  const cameraRef = useRef<CameraRef>(null);
  const [center, setCenter] = useState<Coords>(initial ?? DEFAULT_CENTER);
  const [locating, setLocating] = useState(false);

  const goToMyPosition = async () => {
    setLocating(true);
    try {
      const pos = await currentPosition();
      if (pos) {
        setCenter(pos);
        cameraRef.current?.flyTo({ center: [pos.longitude, pos.latitude], zoom: 17, duration: 700 });
      }
    } catch {
      // GPS indisponible : on garde la position actuelle de la carte
    } finally {
      setLocating(false);
    }
  };

  useEffect(() => {
    if (!visible) return;
    setCenter(initial ?? DEFAULT_CENTER);
    if (!initial) goToMyPosition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const start = initial ?? DEFAULT_CENTER;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={styles.root}>
        {visible && (
          <MapLibreMap
            style={StyleSheet.absoluteFill}
            mapStyle={mapStyle}
            onRegionDidChange={(e) => {
              const [longitude, latitude] = e.nativeEvent.center;
              setCenter({ latitude, longitude });
            }}
            onPress={(e) => {
              const [longitude, latitude] = e.nativeEvent.lngLat;
              cameraRef.current?.easeTo({ center: [longitude, latitude], duration: 300 });
            }}
          >
            <Camera
              ref={cameraRef}
              initialViewState={{
                center: [start.longitude, start.latitude],
                zoom: initial ? 17 : 13,
              }}
            />
          </MapLibreMap>
        )}

        <View pointerEvents="none" style={styles.pinWrap}>
          <Ionicons name="location" size={46} color={colors.teal} />
          <View style={[styles.pinShadow, { backgroundColor: colors.ink }]} />
        </View>

        <View style={[styles.top, { paddingTop: insets.top + 10 }]}>
          <BouncyPressable onPress={onCancel} style={[styles.roundBtn, shadow.float]}>
            <Ionicons name="close" size={22} color={colors.ink} />
          </BouncyPressable>
          <View style={[styles.hintBox, shadow.float]}>
            <Text style={styles.hintTitle}>{t('locationTitle')}</Text>
            <Text style={styles.hintText}>{t('locationHint')}</Text>
          </View>
        </View>

        <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
          <BouncyPressable onPress={goToMyPosition} style={[styles.secondary, shadow.float]}>
            {locating ? (
              <ActivityIndicator color={colors.teal} />
            ) : (
              <Ionicons name="locate" size={18} color={colors.teal} />
            )}
            <Text style={styles.secondaryText}>{t('myPosition')}</Text>
          </BouncyPressable>
          <Text style={styles.coords}>
            {center.latitude.toFixed(5)}, {center.longitude.toFixed(5)}
          </Text>
          <BouncyPressable onPress={() => onConfirm(center)} style={styles.primary}>
            <Ionicons name="checkmark" size={18} color={colors.white} />
            <Text style={styles.primaryText}>{t('confirmLocation')}</Text>
          </BouncyPressable>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    pinWrap: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      width: 46,
      height: 46,
      marginLeft: -23,
      marginTop: -46,
      alignItems: 'center',
    },
    pinShadow: {
      width: 10,
      height: 4,
      borderRadius: 5,
      opacity: 0.25,
      marginTop: -3,
    },
    top: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 14,
      flexDirection: 'row',
      gap: 10,
      alignItems: 'flex-start',
    },
    roundBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hintBox: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: radii.md,
      padding: 12,
    },
    hintTitle: { color: colors.ink, fontWeight: font.extrabold, fontSize: 15 },
    hintText: { color: colors.muted, fontSize: 13, marginTop: 2, lineHeight: 18 },
    bottom: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 16,
      gap: 10,
    },
    secondary: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.card,
      borderRadius: radii.pill,
      paddingHorizontal: 16,
      height: 44,
    },
    secondaryText: { color: colors.teal, fontWeight: font.bold },
    coords: {
      alignSelf: 'center',
      color: colors.muted,
      backgroundColor: colors.card,
      borderRadius: radii.pill,
      paddingHorizontal: 10,
      paddingVertical: 3,
      fontSize: 12,
      overflow: 'hidden',
    },
    primary: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.teal,
      borderRadius: radii.md,
      height: 52,
    },
    primaryText: { color: colors.white, fontWeight: font.extrabold, fontSize: 15 },
  });
