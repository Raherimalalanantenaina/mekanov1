import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BouncyPressable } from './Pressable';
import { font, radii } from '../theme';

type Props = {
  photos: string[];
  /** Index de la photo ouverte ; null = visionneuse fermée */
  index: number | null;
  onClose: () => void;
  title?: string;
};

/** Visionneuse plein écran : balayage horizontal entre les photos. */
export function PhotoViewer({ photos, index, onClose, title }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<string>>(null);
  const [current, setCurrent] = useState(index ?? 0);

  useEffect(() => {
    if (index != null) setCurrent(index);
  }, [index]);

  return (
    <Modal
      visible={index != null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" />
      <View style={styles.root}>
        <FlatList
          ref={listRef}
          data={photos}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={index ?? 0}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          keyExtractor={(uri, i) => `${i}-${uri.slice(-24)}`}
          onMomentumScrollEnd={(e) =>
            setCurrent(Math.round(e.nativeEvent.contentOffset.x / width))
          }
          renderItem={({ item }) => (
            <View style={{ width, height, justifyContent: 'center' }}>
              <Image source={{ uri: item }} style={{ width, height: height * 0.8 }} resizeMode="contain" />
            </View>
          )}
        />

        <View style={[styles.top, { paddingTop: insets.top + 10 }]}>
          <View style={{ flex: 1 }}>
            {!!title && (
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
            )}
            {photos.length > 1 && (
              <Text style={styles.counter}>
                {current + 1} / {photos.length}
              </Text>
            )}
          </View>
          <BouncyPressable onPress={onClose} style={styles.close}>
            <Ionicons name="close" size={24} color="#fff" />
          </BouncyPressable>
        </View>

        {photos.length > 1 && (
          <View style={[styles.dots, { bottom: insets.bottom + 24 }]}>
            {photos.map((_, i) => (
              <View key={i} style={[styles.dot, i === current && styles.dotActive]} />
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)' },
  top: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  title: { color: '#fff', fontSize: 16, fontWeight: font.extrabold },
  counter: { color: 'rgba(255,255,255,0.7)', fontSize: 12.5, marginTop: 2 },
  close: {
    width: 42,
    height: 42,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotActive: { backgroundColor: '#fff', width: 18 },
});
