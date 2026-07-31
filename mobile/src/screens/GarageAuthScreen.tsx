import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MekanoLogo } from '../components/MekanoLogo';
import { BouncyPressable } from '../components/Pressable';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import { font, radii, type ThemeColors } from '../theme';

type Styles = ReturnType<typeof createStyles>;

function Field({
  icon,
  styles,
  colors,
  ...props
}: React.ComponentProps<typeof TextInput> & {
  icon: keyof typeof Ionicons.glyphMap;
  styles: Styles;
  colors: ThemeColors;
}) {
  return (
    <View style={styles.field}>
      <Ionicons name={icon} size={17} color={colors.faint} />
      <TextInput
        placeholderTextColor={colors.faint}
        style={styles.fieldInput}
        {...props}
      />
    </View>
  );
}

/** Préférences : langue (lignes avec drapeau + radio) et apparence. */
function Preferences({ styles, colors }: { styles: Styles; colors: ThemeColors }) {
  const { lang, setLang, t } = useI18n();
  const { mode, setMode } = useTheme();

  const langs = [
    { key: 'fr' as const, flag: '🇫🇷', label: 'Français' },
    { key: 'mg' as const, flag: '🇲🇬', label: 'Malagasy' },
  ];

  return (
    <View style={{ alignSelf: 'stretch' }}>
      <Text style={styles.prefLabel}>{t('language')}</Text>
      <View style={styles.optionList}>
        {langs.map((l, i) => {
          const active = lang === l.key;
          return (
            <BouncyPressable
              key={l.key}
              onPress={() => setLang(l.key)}
              style={[styles.optionRow, i > 0 && styles.optionRowBorder]}
            >
              <Text style={styles.optionFlag}>{l.flag}</Text>
              <Text
                style={[styles.optionLabel, active && styles.optionLabelActive]}
              >
                {l.label}
              </Text>
              <View style={[styles.radio, active && styles.radioActive]}>
                {active && (
                  <Ionicons name="checkmark" size={12} color={colors.white} />
                )}
              </View>
            </BouncyPressable>
          );
        })}
      </View>

      <Text style={styles.prefLabel}>Apparence</Text>
      <View style={styles.segment}>
        {(
          [
            { key: 'light' as const, icon: 'sunny-outline' as const, label: 'Clair' },
            { key: 'dark' as const, icon: 'moon-outline' as const, label: 'Sombre' },
          ]
        ).map((m) => {
          const active = mode === m.key;
          return (
            <BouncyPressable
              key={m.key}
              onPress={() => setMode(m.key)}
              style={[styles.segmentBtn, active && styles.segmentBtnActive]}
            >
              <Ionicons
                name={m.icon}
                size={15}
                color={active ? colors.white : colors.muted}
              />
              <Text
                style={[styles.segmentText, active && styles.segmentTextActive]}
              >
                {m.label}
              </Text>
            </BouncyPressable>
          );
        })}
      </View>
    </View>
  );
}

export function GarageAuthScreen() {
  const { user, login, register, logout, offline } = useAuth();
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const pad = width < 360 ? 16 : 24;

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('garage@mekano.app');
  const [password, setPassword] = useState('garage123');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (offline) {
      Alert.alert('Hors ligne', 'La connexion garage nécessite Internet.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'login') await login(email.trim(), password);
      else {
        await register(email.trim(), password, fullName.trim());
        Alert.alert(
          'Compte créé',
          'Ton compte a été envoyé à l’administrateur Mekano pour validation. Tu pourras publier ton garage dès qu’il sera validé.'
        );
      }
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Échec');
    } finally {
      setBusy(false);
    }
  };

  /* ===== Connecté ===== */
  if (user) {
    return (
      <View style={styles.root}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 24, paddingHorizontal: pad },
          ]}
        >
          <View style={styles.card}>
            <MekanoLogo size={64} showWordmark={false} />
            <Text style={styles.cardTitle}>Espace garage</Text>
            <View style={styles.profileRow}>
              <Ionicons name="person-circle" size={40} color={colors.teal} />
              <View>
                <Text style={styles.profileName}>{user.fullName}</Text>
                <Text style={styles.profileEmail}>{user.email}</Text>
              </View>
            </View>
            {user.status === 'pending' ? (
              <View style={[styles.rolePill, styles.rolePillPending]}>
                <Ionicons name="hourglass-outline" size={13} color={colors.amberDark} />
                <Text style={[styles.roleText, { color: colors.amberDark }]}>
                  Compte en attente de validation
                </Text>
              </View>
            ) : (
              <View style={styles.rolePill}>
                <Ionicons name="shield-checkmark" size={13} color={colors.teal} />
                <Text style={styles.roleText}>Compte garage validé</Text>
              </View>
            )}

            <Preferences styles={styles} colors={colors} />

            <BouncyPressable onPress={() => logout()} style={styles.logoutBtn}>
              <Ionicons name="log-out-outline" size={17} color={colors.danger} />
              <Text style={styles.logoutText}>Se déconnecter</Text>
            </BouncyPressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  /* ===== Login / inscription ===== */
  return (
    <View style={styles.root}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 30, paddingHorizontal: pad },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <MekanoLogo size={80} />

          <View style={[styles.card, { marginTop: 28 }]}>
            <Text style={styles.cardTitle}>
              {mode === 'login' ? 'Connexion garage' : 'Créer un compte'}
            </Text>
            <Text style={styles.cardSub}>
              Réservé aux propriétaires de garage
            </Text>

            {mode === 'register' && (
              <Field
                icon="person-outline"
                placeholder="Nom du responsable"
                value={fullName}
                onChangeText={setFullName}
                styles={styles}
                colors={colors}
              />
            )}
            <Field
              icon="mail-outline"
              placeholder="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              styles={styles}
              colors={colors}
            />
            <Field
              icon="lock-closed-outline"
              placeholder="Mot de passe"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              styles={styles}
              colors={colors}
            />

            <BouncyPressable
              onPress={submit}
              disabled={busy}
              style={[styles.submitWrap, busy && { opacity: 0.6 }]}
            >
              <View style={styles.submit}>
                <Text style={styles.submitText}>
                  {mode === 'login' ? 'Se connecter' : 'Créer le compte'}
                </Text>
                <Ionicons name="arrow-forward" size={17} color={colors.white} />
              </View>
            </BouncyPressable>

            <Text
              style={styles.switch}
              onPress={() => setMode(mode === 'login' ? 'register' : 'login')}
            >
              {mode === 'login'
                ? 'Pas encore de compte ? S’inscrire'
                : 'Déjà un compte ? Se connecter'}
            </Text>

            <Preferences styles={styles} colors={colors} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    scroll: { flexGrow: 1, paddingBottom: 40 },
    card: {
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radii.lg,
      padding: 24,
      alignItems: 'center',
    },
    cardTitle: {
      fontSize: 21,
      fontWeight: font.black,
      color: colors.ink,
      marginTop: 10,
      letterSpacing: -0.3,
    },
    cardSub: {
      color: colors.muted,
      fontSize: 13,
      marginTop: 4,
      marginBottom: 18,
      textAlign: 'center',
    },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      alignSelf: 'stretch',
      backgroundColor: colors.field,
      borderRadius: radii.sm,
      paddingHorizontal: 14,
      height: 50,
      marginBottom: 10,
    },
    fieldInput: { flex: 1, color: colors.ink, fontSize: 14.5 },
    submitWrap: {
      alignSelf: 'stretch',
      borderRadius: radii.pill,
      overflow: 'hidden',
      marginTop: 6,
    },
    submit: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 15,
      backgroundColor: colors.teal,
      borderRadius: radii.pill,
    },
    submitText: {
      color: colors.white,
      fontWeight: font.extrabold,
      fontSize: 15,
    },
    switch: {
      marginTop: 18,
      color: colors.teal,
      fontWeight: font.bold,
      fontSize: 13.5,
    },
    profileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 14,
    },
    profileName: { fontWeight: font.extrabold, color: colors.ink, fontSize: 15 },
    profileEmail: { color: colors.muted, fontSize: 12.5, marginTop: 1 },
    rolePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.tealSoft,
      borderRadius: radii.pill,
      paddingHorizontal: 13,
      paddingVertical: 7,
      marginTop: 16,
    },
    rolePillPending: { backgroundColor: colors.amberSoft },
    roleText: { color: colors.teal, fontWeight: font.bold, fontSize: 12.5 },

    // Préférences
    prefLabel: {
      marginTop: 20,
      marginBottom: 8,
      color: colors.faint,
      fontSize: 11.5,
      fontWeight: font.extrabold,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    optionList: {
      alignSelf: 'stretch',
      backgroundColor: colors.field,
      borderRadius: radii.md,
      overflow: 'hidden',
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    optionRowBorder: {
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },
    optionFlag: { fontSize: 17 },
    optionLabel: {
      flex: 1,
      color: colors.muted,
      fontSize: 14,
      fontWeight: font.semibold,
    },
    optionLabelActive: { color: colors.ink, fontWeight: font.extrabold },
    radio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: colors.faint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioActive: {
      backgroundColor: colors.teal,
      borderColor: colors.teal,
    },
    segment: {
      flexDirection: 'row',
      alignSelf: 'stretch',
      backgroundColor: colors.field,
      borderRadius: radii.pill,
      padding: 4,
      gap: 4,
    },
    segmentBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 9,
      borderRadius: radii.pill,
    },
    segmentBtnActive: { backgroundColor: colors.teal },
    segmentText: {
      color: colors.muted,
      fontWeight: font.bold,
      fontSize: 13,
    },
    segmentTextActive: { color: colors.white },
    logoutBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      marginTop: 24,
      backgroundColor: colors.dangerSoft,
      borderRadius: radii.md,
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    logoutText: { color: colors.danger, fontWeight: font.bold, fontSize: 14 },
  });
