import { Platform } from 'react-native';

/** Android emulator → host machine. Device physique : IP locale de ta machine. */
const DEV_HOST = Platform.select({
  android: '10.0.2.2',
  default: 'localhost',
});

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || `http://${DEV_HOST}:4000`;
