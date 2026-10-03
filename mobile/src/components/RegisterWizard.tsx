import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAppConfig } from '../appConfig';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import { localized } from '../serviceCatalog';
import { font, radii, type ThemeColors } from '../theme';
import type { Garage } from '../types';
import { LocationPicker, type Coords } from './LocationPicker';
import { BouncyPressable } from './Pressable';
import { CategoryIcon } from './CategoryIcon';
import { notify } from './Notifier';

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
      <TextInput placeholderTextColor={colors.faint} style={styles.fieldInput} {...props} />
    </View>
  );
}

/**
 * Inscription en 3 étapes : compte, garage, localisation.
 * Le compte et la fiche sont créés ensemble et validés en une seule fois.
 */
export function RegisterWizard({ onDone }: { onDone: (garage: Garage | null) => void }) {
  const { register, offline } = useAuth();
  const { config, catalog } = useAppConfig();
  const form = config.garageForm;
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const { t, lang } = useI18n();

  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  // Étape 1
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Étape 2
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [services, setServices] = useState<string[]>([]);
  const [phone, setPhone] = useState('');
  // Étape 3
  const [coords, setCoords] = useState<Coords | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');

  const selectCategory = (id: string) => {
    setCategory((prev) => (prev === id ? null : id));
    setServices([]);
  };
  const toggleService = (label: string) =>
    setServices((prev) => (prev.includes(label) ? prev.filter((s) => s !== label) : [...prev, label]));

  const onLocationPicked = async (picked: Coords) => {
    setCoords(picked);
    setPickerOpen(false);
    try {
      const [place] = await Location.reverseGeocodeAsync(picked);
      if (!place) return;
      const street = [place.streetNumber, place.street].filter(Boolean).join(' ');
      const line = street || place.name || place.district || '';
      if (!address.trim() && line) setAddress(line);
      const town = place.city || place.subregion || '';
      if (!city.trim() && town) setCity(town);
    } catch {
      // Géocodage inverse indisponible : saisie manuelle
    }
  };

  const fail = (title: string, text?: string) => {
    notify.warning(title, text);
    return false;
  };

  const checkStep = (n: number): boolean => {
    if (n === 1) {
      if (!fullName.trim() || !email.trim() || !password) return fail(t('requiredFields'));
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) return fail(t('invalidEmail'));
      if (password.length < 6) return fail(t('passwordTooShort'));
    }
    if (n === 2) {
      if (!name.trim()) return fail(t('garageNameRequired'));
      if (form.minCategories > 0 && !category) {
        return fail(t('pickCategoryTitle'), t('pickCategoryText', { n: form.minCategories }));
      }
      if (form.fields.phone.visible && form.fields.phone.required && !phone.trim()) {
        return fail(t('requiredFields'), t('fieldRequired', { field: t('phone') }));
      }
    }
    if (n === 3) {
      if (!coords) return fail(t('locationTitle'), t('locationRequiredText'));
      if (!address.trim()) return fail(t('requiredFields'), t('nameAddressRequired'));
      if (form.fields.city.visible && form.fields.city.required && !city.trim()) {
        return fail(t('requiredFields'), t('fieldRequired', { field: t('city') }));
      }
    }
    return true;
  };

  const next = () => {
    if (checkStep(step)) setStep(step + 1);
  };

  const submit = async () => {
    if (!checkStep(3) || !coords) return;
    if (offline) {
      notify.warning(t('offlineTitle'), t('loginNeedsNet'));
      return;
    }
    setBusy(true);
    try {
      const garage = await register(email.trim(), password, fullName.trim(), {
        name: name.trim(),
        categories: category ? [category] : [],
        services,
        phone: phone.trim(),
        address: address.trim(),
        city: city.trim(),
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
      onDone(garage);
    } catch (e) {
      notify.error(t('error'), e instanceof Error ? e.message : t('fail'));
    } finally {
      setBusy(false);
    }
  };

  const titles = [t('stepAccount'), t('stepGarage'), t('stepLocation')];

  return (
    <View style={{ alignSelf: 'stretch' }}>
      <View style={styles.progress}>
        {[1, 2, 3].map((n) => (
          <View key={n} style={[styles.progressDot, n <= step && styles.progressDotOn]} />
        ))}
      </View>
      <Text style={styles.stepOf}>{t('stepOf', { n: step })}</Text>
      <Text style={styles.stepTitle}>{titles[step - 1]}</Text>

      {step === 1 && (
        <>
          <Field
            icon="person-outline"
            placeholder={t('managerName')}
            value={fullName}
            onChangeText={setFullName}
            styles={styles}
            colors={colors}
          />
          <Field
            icon="mail-outline"
            placeholder={t('email')}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            styles={styles}
            colors={colors}
          />
          <Field
            icon="lock-closed-outline"
            placeholder={t('password')}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            styles={styles}
            colors={colors}
          />
        </>
      )}

      {step === 2 && (
        <>
          <Field
            icon="business-outline"
            placeholder={t('garageName')}
            value={name}
            onChangeText={setName}
            styles={styles}
            colors={colors}
          />
          {form.fields.phone.visible && (
            <Field
              icon="call-outline"
              placeholder={`${t('phone')}${form.fields.phone.required ? ' *' : ''}`}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              styles={styles}
              colors={colors}
            />
          )}
          <Text style={styles.label}>{t('serviceTypesHint')}</Text>
          <View style={styles.box}>
            {catalog.map((c, i) => {
              const on = category === c.id;
              return (
                <View key={c.id} style={[styles.catBlock, i > 0 && styles.border]}>
                  <BouncyPressable onPress={() => selectCategory(c.id)} style={styles.catRow}>
                    <View style={[styles.radio, on && styles.radioOn]}>
                      {on && <View style={styles.radioDot} />}
                    </View>
                    <CategoryIcon category={c} size={18} color={on ? colors.teal : colors.muted} />
                    <Text style={styles.catText}>{localized(c, lang)}</Text>
                  </BouncyPressable>
                  {on && c.subtypes.length > 0 && (
                    <View style={styles.chips}>
                      {c.subtypes.map((s) => {
                        const sel = services.includes(s.label);
                        return (
                          <BouncyPressable
                            key={s.id}
                            onPress={() => toggleService(s.label)}
                            style={[styles.chip, sel && styles.chipOn]}
                          >
                            {sel && <Ionicons name="checkmark" size={13} color={colors.teal} />}
                            <Text style={[styles.chipText, sel && styles.chipTextOn]}>
                              {localized(s, lang)}
                            </Text>
                          </BouncyPressable>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </>
      )}

      {step === 3 && (
        <>
          <BouncyPressable
            onPress={() => setPickerOpen(true)}
            style={[styles.locationRow, !coords && styles.locationRowMissing]}
          >
            <Ionicons
              name={coords ? 'checkmark-circle' : 'pin-outline'}
              size={18}
              color={coords ? colors.success : colors.teal}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.locationTitle}>{t('locationTitle')} *</Text>
              <Text style={styles.locationSub}>
                {coords
                  ? `${t('locationSet')} (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`
                  : t('locationNotSet')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.faint} />
          </BouncyPressable>
          <Field
            icon="location-outline"
            placeholder={`${t('address')} *`}
            value={address}
            onChangeText={setAddress}
            styles={styles}
            colors={colors}
          />
          {form.fields.city.visible && (
            <Field
              icon="map-outline"
              placeholder={`${t('city')}${form.fields.city.required ? ' *' : ''}`}
              value={city}
              onChangeText={setCity}
              styles={styles}
              colors={colors}
            />
          )}
          <Text style={styles.hint}>{t('completeLaterHint')}</Text>
        </>
      )}

      <View style={styles.actions}>
        {step > 1 && (
          <BouncyPressable onPress={() => setStep(step - 1)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={16} color={colors.teal} />
            <Text style={styles.backText}>{t('back')}</Text>
          </BouncyPressable>
        )}
        <BouncyPressable
          onPress={step < 3 ? next : submit}
          disabled={busy}
          style={[styles.submit, busy && { opacity: 0.6 }]}
        >
          <Text style={styles.submitText}>
            {busy ? t('sending') : step < 3 ? t('next') : t('createMyGarage')}
          </Text>
          <Ionicons name={step < 3 ? 'arrow-forward' : 'checkmark'} size={17} color={colors.white} />
        </BouncyPressable>
      </View>

      <LocationPicker
        visible={pickerOpen}
        initial={coords}
        onCancel={() => setPickerOpen(false)}
        onConfirm={onLocationPicked}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    progress: { flexDirection: 'row', gap: 6, marginBottom: 10 },
    progressDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.line },
    progressDotOn: { backgroundColor: colors.teal },
    stepOf: { color: colors.faint, fontSize: 11.5, fontWeight: font.bold },
    stepTitle: {
      color: colors.ink,
      fontSize: 17,
      fontWeight: font.extrabold,
      marginTop: 2,
      marginBottom: 14,
    },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.field,
      borderRadius: radii.sm,
      paddingHorizontal: 14,
      height: 50,
      marginBottom: 10,
    },
    fieldInput: { flex: 1, color: colors.ink, fontSize: 14.5 },
    label: {
      color: colors.muted,
      fontSize: 12.5,
      fontWeight: font.bold,
      marginTop: 4,
      marginBottom: 8,
    },
    box: {
      backgroundColor: colors.field,
      borderRadius: radii.md,
      overflow: 'hidden',
      marginBottom: 6,
    },
    border: { borderTopWidth: 1, borderTopColor: colors.line },
    catBlock: { paddingHorizontal: 12, paddingVertical: 10 },
    catRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    catText: { color: colors.ink, fontSize: 14, fontWeight: font.semibold, flex: 1 },
    radio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: colors.faint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioOn: { borderColor: colors.teal },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.teal },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10, paddingLeft: 30 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.bg,
      borderRadius: radii.pill,
      paddingHorizontal: 11,
      paddingVertical: 6,
    },
    chipOn: { borderColor: colors.teal, backgroundColor: colors.tealSoft },
    chipText: { color: colors.muted, fontSize: 12.5, fontWeight: font.semibold },
    chipTextOn: { color: colors.teal },
    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.field,
      borderRadius: radii.sm,
      padding: 14,
      marginBottom: 10,
    },
    locationRowMissing: { borderWidth: 1, borderColor: colors.teal, borderStyle: 'dashed' },
    locationTitle: { color: colors.ink, fontSize: 14, fontWeight: font.bold },
    locationSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
    hint: { color: colors.faint, fontSize: 12, marginTop: 2 },
    actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 16,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.line,
    },
    backText: { color: colors.teal, fontWeight: font.bold, fontSize: 14 },
    submit: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 15,
      backgroundColor: colors.teal,
      borderRadius: radii.pill,
    },
    submitText: { color: colors.white, fontWeight: font.extrabold, fontSize: 15 },
  });
