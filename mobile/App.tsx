import React from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppConfigProvider } from './src/appConfig';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { I18nProvider } from './src/i18n';
import { MekanoLogo } from './src/components/MekanoLogo';
import { NotifierProvider } from './src/components/Notifier';
import { RootNavigator } from './src/navigation/RootNavigator';
import { registerForPush } from './src/push';
import { SyncRunner } from './src/sync';

function Boot() {
  const { loading, user } = useAuth();
  const { mode, gradients } = useTheme();

  // Enregistre le jeton push au démarrage, puis à chaque connexion garage
  // (pour associer le compte au jeton côté serveur).
  React.useEffect(() => {
    if (!loading) registerForPush();
  }, [loading, user?.id]);
  if (loading) {
    return (
      <LinearGradient colors={gradients.hero} style={styles.splash}>
        <MekanoLogo size={110} light />
      </LinearGradient>
    );
  }
  return (
    <>
      <StatusBar
        barStyle={mode === 'dark' ? 'light-content' : 'dark-content'}
        translucent
        backgroundColor="transparent"
      />
      <RootNavigator />
      <SyncRunner />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppConfigProvider>
        <ThemeProvider>
          <I18nProvider>
            <AuthProvider>
              <NotifierProvider>
                <Boot />
              </NotifierProvider>
            </AuthProvider>
          </I18nProvider>
        </ThemeProvider>
      </AppConfigProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
