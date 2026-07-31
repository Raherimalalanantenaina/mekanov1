import React from 'react';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { HomeScreen } from '../screens/HomeScreen';
import { MapScreen } from '../screens/MapScreen';
import { GarageDetailScreen } from '../screens/GarageDetailScreen';
import { GarageAuthScreen } from '../screens/GarageAuthScreen';
import { MyGarageScreen } from '../screens/MyGarageScreen';
import { RequestsScreen } from '../screens/RequestsScreen';
import { GarageInboxScreen } from '../screens/GarageInboxScreen';
import { RouteScreen } from '../screens/RouteScreen';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import { font } from '../theme';
import type { RootStackParamList } from './types';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<RootStackParamList>();

function MainTabs() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.teal,
        tabBarInactiveTintColor: colors.faint,
        tabBarLabelStyle: {
          fontSize: 10.5,
          fontWeight: font.bold,
          marginTop: 2,
        },
        // Barre plate classique : filet fin en haut, aucun relief
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopWidth: 1,
          borderTopColor: colors.line,
          elevation: 0,
          height: 62,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarIcon: ({ focused, color, size }) => {
          const map: Record<string, keyof typeof Ionicons.glyphMap> = {
            Liste: focused ? 'list' : 'list-outline',
            Carte: focused ? 'map' : 'map-outline',
            Demandes: focused ? 'chatbubbles' : 'chatbubbles-outline',
            Publier: focused ? 'add-circle' : 'add-circle-outline',
            Inbox: focused ? 'mail' : 'mail-outline',
            Garage: focused ? 'person' : 'person-outline',
          };
          return (
            <Ionicons
              name={map[route.name] ?? 'ellipse'}
              size={size - 2}
              color={color}
            />
          );
        },
      })}
    >
      <Tab.Screen
        name="Liste"
        component={HomeScreen}
        options={{ tabBarLabel: t('tabList') }}
      />
      <Tab.Screen
        name="Carte"
        component={MapScreen}
        options={{ tabBarLabel: t('tabMap') }}
      />
      <Tab.Screen
        name="Demandes"
        component={RequestsScreen}
        options={{ tabBarLabel: t('tabRequests') }}
      />
      <Tab.Screen
        name="Publier"
        component={MyGarageScreen}
        options={{ tabBarLabel: t('tabPublish') }}
      />
      {user ? (
        <Tab.Screen
          name="Inbox"
          component={GarageInboxScreen}
          options={{ tabBarLabel: 'Inbox' }}
        />
      ) : null}
      <Tab.Screen
        name="Garage"
        component={GarageAuthScreen}
        options={{ tabBarLabel: t('tabAccount') }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { colors } = useTheme();
  const navTheme = React.useMemo(
    () => ({
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        background: colors.bg,
        card: colors.bg,
        text: colors.ink,
        border: colors.line,
        primary: colors.teal,
      },
    }),
    [colors]
  );
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={MainTabs} />
        <Stack.Screen
          name="GarageDetail"
          component={GarageDetailScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="Route"
          component={RouteScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
