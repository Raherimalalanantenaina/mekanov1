import React from 'react';
import { StyleSheet, View } from 'react-native';

/** Cercles décoratifs translucides pour les en-têtes en dégradé. */
export function HeroDecor() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.circle, styles.big]} />
      <View style={[styles.circle, styles.medium]} />
      <View style={[styles.circle, styles.small]} />
      <View style={[styles.circle, styles.amber]} />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  big: { width: 220, height: 220, top: -80, right: -60 },
  medium: {
    width: 130,
    height: 130,
    top: 40,
    right: 30,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  small: { width: 70, height: 70, bottom: -20, left: 40 },
  amber: {
    width: 46,
    height: 46,
    top: 26,
    left: -14,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});
