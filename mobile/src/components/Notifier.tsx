import React from 'react';
import {
  Alert,
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { font, radii } from '../theme';

/**
 * Notifications in-app : bandeau animé en haut de l'écran (succès, erreur,
 * info) et boîte de dialogue stylée (confirmations, messages importants).
 * `notify.alert` a la même signature que `Alert.alert`.
 */

export type NotifyKind = 'success' | 'error' | 'info' | 'warning';
type DialogKind = NotifyKind | 'danger';
type IconName = keyof typeof Ionicons.glyphMap;

export type NotifyButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

type ToastOptions = {
  kind?: NotifyKind;
  title: string;
  message?: string;
  icon?: IconName;
  onPress?: () => void;
};

type DialogOptions = {
  title: string;
  message?: string;
  buttons?: NotifyButton[];
  kind?: DialogKind;
  icon?: IconName;
};

type Impl = { toast: (o: ToastOptions) => void; dialog: (o: DialogOptions) => void };

let impl: Impl | null = null;

export const notify = {
  toast(o: ToastOptions) {
    if (impl) impl.toast(o);
    else Alert.alert(o.title, o.message);
  },
  success(title: string, message?: string) {
    notify.toast({ kind: 'success', title, message });
  },
  error(title: string, message?: string) {
    notify.toast({ kind: 'error', title, message });
  },
  info(title: string, message?: string) {
    notify.toast({ kind: 'info', title, message });
  },
  warning(title: string, message?: string) {
    notify.toast({ kind: 'warning', title, message });
  },
  alert(
    title: string,
    message?: string,
    buttons?: NotifyButton[],
    opts?: { kind?: DialogKind; icon?: IconName }
  ) {
    if (impl) impl.dialog({ title, message, buttons, ...opts });
    else Alert.alert(title, message, buttons);
  },
};

const ICONS: Record<DialogKind, IconName> = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  info: 'information-circle',
  warning: 'warning',
  danger: 'trash',
};

export function NotifierProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = React.useState<(ToastOptions & { id: number }) | null>(null);
  const [dialog, setDialog] = React.useState<DialogOptions | null>(null);
  const anim = React.useRef(new Animated.Value(0)).current;
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideToast = React.useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() =>
      setToast(null)
    );
  }, [anim]);

  const showToast = React.useCallback(
    (o: ToastOptions) => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ ...o, id: Date.now() });
      anim.setValue(0);
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, damping: 16, stiffness: 180 }).start();
      timer.current = setTimeout(hideToast, o.kind === 'error' ? 5000 : 3500);
    },
    [anim, hideToast]
  );

  React.useEffect(() => {
    impl = { toast: showToast, dialog: setDialog };
    return () => {
      impl = null;
    };
  }, [showToast]);

  // Notification push reçue app ouverte → bandeau in-app
  React.useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((n) => {
      const { title, body } = n.request.content;
      if (title || body) {
        showToast({ kind: 'info', title: title ?? 'Mekano', message: body ?? undefined, icon: 'notifications' });
      }
    });
    return () => sub.remove();
  }, [showToast]);

  const tone = (k: DialogKind = 'info') =>
    k === 'success'
      ? { fg: colors.success, bg: colors.successSoft }
      : k === 'error' || k === 'danger'
        ? { fg: colors.danger, bg: colors.dangerSoft }
        : k === 'warning'
          ? { fg: colors.amberDark, bg: colors.amberSoft }
          : { fg: colors.teal, bg: colors.tealSoft };

  const closeDialog = (b?: NotifyButton) => {
    setDialog(null);
    // Laisse la modale se fermer avant d'enchaîner (ex. ouvrir un écran)
    if (b?.onPress) setTimeout(b.onPress, 120);
  };

  const dialogKind: DialogKind =
    dialog?.kind ?? (dialog?.buttons?.some((b) => b.style === 'destructive') ? 'danger' : 'info');
  const buttons = dialog?.buttons?.length ? dialog.buttons : [{ text: 'OK' }];
  const t = toast ? tone(toast.kind) : null;
  const d = tone(dialogKind);

  return (
    <View style={{ flex: 1 }}>
      {children}

      {toast && t && (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.toastWrap,
            {
              top: insets.top + 8,
              opacity: anim,
              transform: [
                { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }) },
                { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
              ],
            },
          ]}
        >
          <Pressable
            onPress={() => {
              toast.onPress?.();
              hideToast();
            }}
            style={[styles.toast, { backgroundColor: colors.card, borderColor: colors.line }]}
          >
            <View style={[styles.toastBar, { backgroundColor: t.fg }]} />
            <View style={[styles.toastIcon, { backgroundColor: t.bg }]}>
              <Ionicons name={toast.icon ?? ICONS[toast.kind ?? 'info']} size={20} color={t.fg} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.toastTitle, { color: colors.ink }]} numberOfLines={1}>
                {toast.title}
              </Text>
              {!!toast.message && (
                <Text style={[styles.toastText, { color: colors.muted }]} numberOfLines={3}>
                  {toast.message}
                </Text>
              )}
            </View>
            <Ionicons name="close" size={18} color={colors.faint} />
          </Pressable>
        </Animated.View>
      )}

      <Modal
        visible={!!dialog}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => closeDialog(buttons.find((b) => b.style === 'cancel'))}
      >
        <View style={styles.backdrop}>
          <View style={[styles.dialog, { backgroundColor: colors.card }]}>
            <View style={[styles.dialogIcon, { backgroundColor: d.bg }]}>
              <Ionicons name={dialog?.icon ?? ICONS[dialogKind]} size={30} color={d.fg} />
            </View>
            <Text style={[styles.dialogTitle, { color: colors.ink }]}>{dialog?.title}</Text>
            {!!dialog?.message && (
              <Text style={[styles.dialogText, { color: colors.muted }]}>{dialog.message}</Text>
            )}
            <View style={[styles.dialogActions, buttons.length > 2 && { flexDirection: 'column' }]}>
              {buttons.map((b, i) => {
                const cancel = b.style === 'cancel';
                const danger = b.style === 'destructive';
                return (
                  <Pressable
                    key={`${b.text}-${i}`}
                    onPress={() => closeDialog(b)}
                    style={({ pressed }) => [
                      styles.dialogBtn,
                      buttons.length > 2 && { flex: 0 },
                      cancel
                        ? { backgroundColor: colors.field }
                        : { backgroundColor: danger ? colors.danger : colors.teal },
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text style={[styles.dialogBtnText, { color: cancel ? colors.ink : '#fff' }]}>{b.text}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  toastWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 1000,
    elevation: 12,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 14,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  toastBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  toastIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastTitle: {
    fontSize: 14.5,
    fontWeight: font.bold,
  },
  toastText: {
    fontSize: 13,
    marginTop: 1,
    lineHeight: 18,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(8,16,18,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  dialog: {
    width: '100%',
    maxWidth: 380,
    borderRadius: radii.xl,
    padding: 24,
    alignItems: 'center',
  },
  dialogIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: font.extrabold,
    textAlign: 'center',
  },
  dialogText: {
    fontSize: 14.5,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 8,
  },
  dialogActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
    alignSelf: 'stretch',
  },
  dialogBtn: {
    flex: 1,
    height: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  dialogBtnText: {
    fontSize: 15,
    fontWeight: font.bold,
  },
});
