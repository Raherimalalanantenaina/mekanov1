import React, { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { font } from '../theme';

type Props = {
  size?: number;
  showWordmark?: boolean;
  light?: boolean;
};

export function MekanoLogo({ size = 72, showWordmark = true, light }: Props) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 600 });
  }, [opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[styles.wrap, style]}>
      <Image
        source={require('../../assets/mekano-logo.png')}
        style={{ width: size, height: size, borderRadius: size * 0.22 }}
        resizeMode="contain"
        accessibilityLabel="Logo Mekano"
      />
      {showWordmark && (
        <Text
          style={[styles.word, { color: light ? colors.white : colors.teal }]}
        >
          MEKANO
        </Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  word: {
    marginTop: 8,
    fontSize: 22,
    fontWeight: font.black,
    letterSpacing: 4,
  },
});
