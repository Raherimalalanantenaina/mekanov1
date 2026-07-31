import React from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { I18nProvider } from './src/i18n';
import { MekanoLogo } from './src/components/MekanoLogo';
import { RootNavigator } from './src/navigation/RootNavigator';
import { gradients } from './src/theme';

function Boot() {
  const { loading } = useAuth();
  const { mode } = useTheme();
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
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <I18nProvider>
          <AuthProvider>
            <Boot />
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>
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
