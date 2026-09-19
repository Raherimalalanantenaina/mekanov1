import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

type Props = {
  nearest?: boolean;
  selected?: boolean;
};

/** Pin garage style carte — teal / ambre si plus proche ou sélectionné. */
export function GarageMapPin({ nearest, selected }: Props) {
  const { colors } = useTheme();
  const active = Boolean(nearest || selected);
  const fill = active ? colors.amber : colors.teal;
  const icon = nearest ? 'flash' : 'construct';

  return (
    <View
      collapsable={false}
      style={[styles.wrap, selected && styles.wrapSelected]}
    >
      {selected && <View style={[styles.pulse, { borderColor: fill }]} />}
      <View style={[styles.head, { backgroundColor: fill }]}>
        <Ionicons
          name={icon}
          size={14}
          color={active ? colors.tealDeep : colors.white}
        />
      </View>
      <View style={[styles.tip, { borderTopColor: fill }]} />
      <View style={styles.shadow} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    width: 44,
    height: 52,
  },
  wrapSelected: {
    transform: [{ scale: 1.12 }],
  },
  pulse: {
    position: 'absolute',
    top: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    opacity: 0.35,
  },
  head: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  tip: {
    width: 0,
    height: 0,
    marginTop: -3,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  shadow: {
    width: 10,
    height: 4,
    marginTop: 1,
    borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
});
