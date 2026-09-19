import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { gradients } from '../theme';

/** Marqueur "ma position" avec halo animé discret. */
export function UserLocationMarker() {
  const { colors } = useTheme();
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );
  }, [pulse]);

  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.7 + pulse.value * 0.55 }],
    opacity: 0.45 * (1 - pulse.value),
  }));

  return (
    <View style={styles.wrap} collapsable={false}>
      <Animated.View
        style={[
          styles.halo,
          { backgroundColor: colors.teal },
          haloStyle,
        ]}
      />
      <View style={[styles.ring, { borderColor: colors.teal }]} />
      <LinearGradient
        colors={gradients.brand}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.dot}
      >
        <Ionicons name="navigate" size={13} color={colors.white} />
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  ring: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    backgroundColor: 'rgba(18,113,122,0.12)',
  },
  dot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
});
