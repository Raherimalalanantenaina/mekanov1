import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { registerPushToken } from './api/client';

/**
 * Notifications push via le service Expo.
 * L'enregistrement échoue silencieusement (permission refusée, émulateur,
 * hors ligne…) : l'app fonctionne normalement sans notifications.
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPush(): Promise<void> {
  try {
    if (!Device.isDevice) return; // émulateur : pas de push

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Mekano',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#12717A',
      });
    }

    const { status } = await Notifications.getPermissionsAsync();
    let granted = status === 'granted';
    if (!granted) {
      const req = await Notifications.requestPermissionsAsync();
      granted = req.status === 'granted';
    }
    if (!granted) return;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    const token = (
      await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined
      )
    ).data;

    await registerPushToken(token);
  } catch {
    /* silencieux : les notifications sont un bonus, jamais bloquantes */
  }
}
