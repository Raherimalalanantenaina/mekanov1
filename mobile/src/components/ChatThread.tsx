import React, { useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import { font, radii, type ThemeColors } from '../theme';
import type { QuoteMessage } from '../types';
import { BouncyPressable } from './Pressable';

function Avatar({ sender }: { sender: 'client' | 'garage' }) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const isGarage = sender === 'garage';
  return (
    <View
      style={[
        styles.avatar,
        { backgroundColor: isGarage ? colors.teal : colors.amberSoft },
      ]}
    >
      <Ionicons
        name={isGarage ? 'build' : 'person'}
        size={15}
        color={isGarage ? colors.white : colors.amberDark}
      />
    </View>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const time = d.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const sameDay =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
  return sameDay ? time : `${d.toLocaleDateString('fr-FR')} ${time}`;
}

type Props = {
  messages: QuoteMessage[];
  /** Qui suis-je dans cette conversation ? */
  mySender: 'client' | 'garage';
  placeholder: string;
  onSend: (body: string, photo: string) => Promise<void>;
  bottomInset: number;
  /** Suggestions tapables au-dessus du champ de saisie. */
  quickReplies?: string[];
};

export function ChatThread({
  messages,
  mySender,
  placeholder,
  onSend,
  bottomInset,
  quickReplies,
}: Props) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [draft, setDraft] = useState('');
  const [photo, setPhoto] = useState('');
  const [sending, setSending] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const listRef = useRef<FlatList<QuoteMessage>>(null);

  React.useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setKeyboardOpen(true);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
      }
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardOpen(false)
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.3,
      base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      setPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const send = async () => {
    if ((!draft.trim() && !photo) || sending) return;
    setSending(true);
    try {
      await onSend(draft.trim(), photo);
      setDraft('');
      setPhoto('');
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        onContentSizeChange={() =>
          listRef.current?.scrollToEnd({ animated: false })
        }
        renderItem={({ item }) => {
          const mine = item.sender === mySender;
          return (
            <View style={[styles.row, mine && styles.rowMine]}>
              {!mine && <Avatar sender={item.sender} />}
              <View style={{ maxWidth: '78%' }}>
                <View
                  style={[styles.bubble, mine ? styles.bubbleMe : styles.bubbleThem]}
                >
                  {!!item.photo && (
                    <Image source={{ uri: item.photo }} style={styles.msgPhoto} />
                  )}
                  {!!item.body && (
                    <Text style={{ color: mine ? colors.white : colors.ink }}>
                      {item.body}
                    </Text>
                  )}
                </View>
                <Text style={[styles.time, mine && { textAlign: 'right' }]}>
                  {formatTime(item.createdAt)}
                </Text>
              </View>
              {mine && <Avatar sender={item.sender} />}
            </View>
          );
        }}
      />

      {!!photo && (
        <View style={styles.preview}>
          <Image source={{ uri: photo }} style={styles.previewImg} />
          <BouncyPressable onPress={() => setPhoto('')} style={styles.previewRemove}>
            <Ionicons name="close" size={13} color={colors.white} />
          </BouncyPressable>
          <Text style={styles.previewText}>{t('photoReady')}</Text>
        </View>
      )}

      {quickReplies && quickReplies.length > 0 && (
        <FlatList
          horizontal
          data={quickReplies}
          keyExtractor={(r) => r}
          showsHorizontalScrollIndicator={false}
          style={styles.quickRow}
          contentContainerStyle={{ gap: 7, paddingHorizontal: 12 }}
          renderItem={({ item }) => (
            <BouncyPressable
              onPress={() => setDraft(item)}
              style={styles.quickChip}
            >
              <Text style={styles.quickChipText} numberOfLines={1}>
                {item}
              </Text>
            </BouncyPressable>
          )}
        />
      )}

      <View
        style={[
          styles.composer,
          { paddingBottom: keyboardOpen ? 12 : 12 + bottomInset },
        ]}
      >
        <BouncyPressable onPress={pickPhoto} style={styles.photoBtn}>
          <Ionicons name="image-outline" size={19} color={colors.teal} />
        </BouncyPressable>
        <TextInput
          style={styles.composerInput}
          placeholder={placeholder}
          placeholderTextColor={colors.faint}
          value={draft}
          onChangeText={setDraft}
          multiline
        />
        <BouncyPressable
          onPress={send}
          style={[styles.sendBtn, sending && { opacity: 0.5 }]}
        >
          <Ionicons name="send" size={16} color={colors.white} />
        </BouncyPressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 7,
  },
  rowMine: { justifyContent: 'flex-end' },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  bubble: {
    borderRadius: radii.lg,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  bubbleMe: { backgroundColor: colors.teal, borderBottomRightRadius: 6 },
  bubbleThem: {
    backgroundColor: colors.field,
    borderBottomLeftRadius: 6,
  },
  msgPhoto: {
    width: 190,
    height: 140,
    borderRadius: radii.md,
    marginBottom: 6,
    backgroundColor: colors.line,
  },
  time: {
    fontSize: 10.5,
    color: colors.faint,
    marginTop: 3,
    marginHorizontal: 4,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  previewImg: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    backgroundColor: colors.line,
  },
  previewRemove: {
    position: 'absolute',
    left: 46,
    top: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewText: { color: colors.muted, fontSize: 12.5, fontWeight: font.semibold },
  quickRow: {
    flexGrow: 0,
    paddingVertical: 8,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  quickChip: {
    backgroundColor: colors.tealSoft,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: 260,
  },
  quickChipText: {
    color: colors.teal,
    fontSize: 12.5,
    fontWeight: font.semibold,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 12,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  photoBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerInput: {
    flex: 1,
    backgroundColor: colors.field,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    color: colors.ink,
    maxHeight: 110,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
