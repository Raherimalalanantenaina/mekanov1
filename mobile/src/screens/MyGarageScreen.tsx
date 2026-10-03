import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import {
  createGarage,
  deleteGarage,
  fetchGarageDailyStats,
  fetchMyGarages,
  updateGarage,
} from '../api/client';
import { CategoryIcon } from '../components/CategoryIcon';
import { GarageCard } from '../components/GarageCard';
import { LocationPicker, type Coords } from '../components/LocationPicker';
import { OfflineBanner } from '../components/OfflineBanner';
import { PlanSection } from '../components/PlanSection';
import { BouncyPressable } from '../components/Pressable';
import { StatsChart } from '../components/StatsChart';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { defaultWeek, summarizeWeek } from '../hours';
import { useI18n, type TKey } from '../i18n';
import { garageFeatures, useAppConfig } from '../appConfig';
import { garageCategoryIds, localized } from '../serviceCatalog';
import { font, radii, shadow, type ThemeColors } from '../theme';
import type { DailyStat, DayHours, Garage } from '../types';
import { notify } from '../components/Notifier';

function Input({
  icon,
  ...props
}: React.ComponentProps<typeof TextInput> & {
  icon: keyof typeof Ionicons.glyphMap;
}) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.input}>
      <Ionicons name={icon} size={16} color={colors.faint} />
      <TextInput
        placeholderTextColor={colors.faint}
        style={styles.inputText}
        {...props}
      />
    </View>
  );
}

export function MyGarageScreen() {
  const { user, offline, refreshUser } = useAuth();
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const { config, catalog } = useAppConfig();
  const form = config.garageForm;
  const MAX_PHOTOS = form.maxPhotos;
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const pad = width < 360 ? 14 : 18;

  const [mine, setMine] = useState<Garage[]>([]);
  const [editing, setEditing] = useState<Garage | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Antananarivo');
  const [phone, setPhone] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [promo, setPromo] = useState('');
  const [priceText, setPriceText] = useState('');
  const [description, setDescription] = useState('');
  const [week, setWeek] = useState<DayHours[]>(defaultWeek());
  const [timePicker, setTimePicker] = useState<{
    day: number;
    field: 'open' | 'close';
  } | null>(null);
  const [mobileService, setMobileService] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<DailyStat[]>([]);

  const resetForm = () => {
    setEditing(null);
    setName('');
    setAddress('');
    setCity('Antananarivo');
    setPhone('');
    setCategories([]);
    setServices([]);
    setPhotos([]);
    setPromo('');
    setPriceText('');
    setDescription('');
    setWeek(defaultWeek());
    setMobileService(false);
    setIsOpen(true);
    setCoords(null);
  };

  const startEdit = (g: Garage) => {
    setEditing(g);
    setName(g.name);
    setAddress(g.address);
    setCity(g.city);
    setPhone(g.phone);
    setCategories(garageCategoryIds(g));
    setServices(g.services ?? []);
    setPhotos(g.photos ?? []);
    setPromo(g.promo ?? '');
    setPriceText(
      (g.priceList ?? []).map((p) => `${p.service}:${p.price}`).join(', ')
    );
    setDescription(g.description ?? '');
    setWeek(g.hoursJson?.length === 7 ? g.hoursJson : defaultWeek());
    setMobileService(!!g.mobileService);
    setIsOpen(g.isOpen);
    setCoords({ latitude: g.latitude, longitude: g.longitude });
  };

  /** Position choisie sur la carte ; complète l'adresse et la ville si elles sont vides. */
  const onLocationPicked = async (picked: Coords) => {
    setCoords(picked);
    setPickerOpen(false);
    if (address.trim() && city.trim()) return;
    try {
      const [place] = await Location.reverseGeocodeAsync(picked);
      if (!place) return;
      const street = [place.streetNumber, place.street].filter(Boolean).join(' ');
      const line = street || place.name || place.district || '';
      if (!address.trim() && line) setAddress(line);
      const town = place.city || place.subregion || '';
      if (!city.trim() && town) setCity(town);
    } catch {
      // Géocodage inverse indisponible : l'utilisateur saisit l'adresse lui-même
    }
  };

  const toggleService = (s: string) => {
    setServices((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  /** Un garage = un seul type : changer de type retire les sous-types de l'ancien. */
  const selectCategory = (id: string) => {
    const allSubs = new Set(
      catalog.flatMap((c) => c.subtypes.map((s) => s.label))
    );
    setServices((prev) => prev.filter((s) => !allSubs.has(s)));
    setCategories((prev) => (prev[0] === id ? [] : [id]));
  };

  const catalogSubtypes = new Set(
    catalog.flatMap((c) => c.subtypes.map((s) => s.label))
  );
  const otherServices = services.filter((s) => !catalogSubtypes.has(s));

  const setDay = (i: number, patch: Partial<DayHours>) =>
    setWeek((prev) => prev.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  const hhmmToDate = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    const d = new Date();
    d.setHours(h || 0, m || 0, 0, 0);
    return d;
  };

  const reload = useCallback(async () => {
    if (!user || offline) return;
    try {
      await refreshUser();
      const list = await fetchMyGarages();
      setMine(list);
      // Statistiques journalières de la fiche (une seule par compte)
      if (list[0]) {
        fetchGarageDailyStats(list[0].id)
          .then(setStats)
          .catch(() => setStats([]));
      } else {
        setStats([]);
      }
    } catch (e) {
      notify.error(t('error'), e instanceof Error ? e.message : t('fail'));
    }
  }, [user, offline, refreshUser, t]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  if (!user) {
    return (
      <View style={[styles.root, styles.center]}>
        <View style={styles.emptyBox}>
          <View style={styles.emptyIcon}>
            <Ionicons name="key-outline" size={30} color={colors.teal} />
          </View>
          <Text style={styles.emptyTitle}>{t('reservedTitle')}</Text>
          <Text style={styles.hint}>{t('reservedText')}</Text>
        </View>
      </View>
    );
  }

  const pickPhoto = async () => {
    if (photos.length >= MAX_PHOTOS) {
      notify.warning(t('limit'), t('maxPhotos', { n: MAX_PHOTOS }));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.35,
      base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      setPhotos((prev) => [
        ...prev,
        `data:image/jpeg;base64,${result.assets[0].base64}`,
      ]);
    }
  };

  const parsePrices = () =>
    priceText
      .split(',')
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .map((chunk) => {
        const [service, ...rest] = chunk.split(':');
        return { service: service.trim(), price: rest.join(':').trim() || '—' };
      })
      .filter((p) => p.service);

  const onSubmit = async () => {
    if (offline) {
      notify.warning(t('offlineTitle'), t('needsConnection'));
      return;
    }
    if (!name.trim() || !address.trim()) {
      notify.warning(t('requiredFields'), t('nameAddressRequired'));
      return;
    }
    const required: [boolean, string][] = [
      [form.fields.phone.required && !phone.trim(), t('phone')],
      [form.fields.city.required && !city.trim(), t('city')],
      [form.fields.description.required && !description.trim(), t('description')],
    ];
    const missing = required.find(([isMissing]) => isMissing);
    if (missing) {
      notify.warning(t('requiredFields'), t('fieldRequired', { field: missing[1] }));
      return;
    }
    if (form.fields.photos.required && photos.length === 0) {
      notify.warning(t('requiredFields'), t('photoRequired'));
      return;
    }
    if (categories.length < form.minCategories) {
      notify.warning(t('pickCategoryTitle'), t('pickCategoryText', { n: form.minCategories }));
      return;
    }
    if (!coords) {
      notify.alert(t('locationTitle'), t('locationRequiredText'), [
        { text: t('cancel'), style: 'cancel' },
        { text: 'OK', onPress: () => setPickerOpen(true) },
      ], { kind: 'warning', icon: 'location' });
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
        address: address.trim(),
        city: city.trim(),
        phone: phone.trim(),
        categories,
        services,
        photos,
        promo: promo.trim(),
        priceList: parsePrices(),
        description: description.trim() || 'Garage inscrit via Mekano',
        openingHours:
          summarizeWeek(week, t('daysShort').split(',')) || t('closedDay'),
        hoursJson: week,
        mobileService,
        isOpen,
        latitude: coords.latitude,
        longitude: coords.longitude,
      };
      if (editing) {
        await updateGarage(editing.id, payload);
        notify.success(t('saved'), t('sheetUpdated'));
      } else {
        const created = await createGarage(payload);
        if (created.status === 'pending') {
          notify.alert(t('submittedTitle'), t('submittedText'), undefined, { kind: 'success', icon: 'hourglass-outline' });
        } else {
          notify.success(t('saved'), t('sheetUpdated'));
        }
      }
      resetForm();
      await reload();
    } catch (e) {
      notify.error(t('error'), e instanceof Error ? e.message : t('fail'));
    } finally {
      setBusy(false);
    }
  };

  const toggleOpenQuick = async (g: Garage) => {
    try {
      await updateGarage(g.id, { isOpen: !g.isOpen });
      await reload();
    } catch (e) {
      notify.error(t('error'), e instanceof Error ? e.message : t('fail'));
    }
  };

  const onDelete = () => {
    if (!editing) return;
    notify.alert(t('delete'), t('deleteConfirm', { name: editing.name }), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteGarage(editing.id);
            resetForm();
            await reload();
          } catch (e) {
            notify.error(t('error'), e instanceof Error ? e.message : t('fail'));
          }
        },
      },
    ]);
  };

  // Offre de la fiche en cours d'édition (une nouvelle fiche démarre en gratuit)
  const formPlan = config.plans[editing?.plan ?? 'free'];
  const formFeatures = editing ? garageFeatures(editing) : formPlan.features;
  const hiddenByPlan = (
    [
      ['photos', form.fields.photos.visible],
      ['hours', form.fields.hours.visible],
      ['extras', form.fields.promo.visible || form.fields.prices.visible || form.fields.mobileService.visible],
    ] as const
  )
    .filter(([f, shown]) => shown && !formFeatures[f])
    .map(([f]) => t(`pf_${f}` as TKey).toLowerCase());

  const accountPending = user.status === 'pending';
  const hasGarage = mine.length >= 1;
  // Compte en attente : il peut créer / compléter sa fiche, validée en même temps que le compte
  const showForm = Boolean(editing) || !hasGarage;

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.hero,
          { paddingTop: insets.top + 16, paddingHorizontal: pad },
        ]}
      >
        <Text style={styles.heroTitle}>{t('myGarageTitle')}</Text>
        <Text style={styles.heroSub}>{t('myGarageSub')}</Text>
      </View>

      <OfflineBanner offline={offline} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <FlatList
        data={mine}
        keyExtractor={(g) => g.id}
        contentContainerStyle={{ padding: pad, paddingBottom: 28 }}
        ListHeaderComponent={
          <View>
            {accountPending && (
              <View style={[styles.notice, shadow.card]}>
                <View style={styles.noticeIcon}>
                  <Ionicons name="hourglass-outline" size={22} color={colors.amberDark} />
                </View>
                <Text style={styles.noticeTitle}>
                  {t('accountPendingTitle')}
                </Text>
                <Text style={styles.noticeText}>{t('accountPendingText')}</Text>
              </View>
            )}

            {!accountPending && hasGarage && !editing && (
              <View style={[styles.notice, shadow.card]}>
                <View style={styles.noticeIcon}>
                  <Ionicons name="business-outline" size={22} color={colors.teal} />
                </View>
                <Text style={styles.noticeTitle}>{t('yourSheetTitle')}</Text>
                <Text style={styles.noticeText}>{t('yourSheetText')}</Text>
              </View>
            )}

            {showForm && (
          <View style={[styles.form, shadow.card]}>
            <View style={styles.formHead}>
              <Text style={styles.formTitle}>
                {editing
                  ? `${t('editPrefix')} · ${editing.name}`
                  : t('publishMyGarage')}
              </Text>
              {editing && (
                <Text style={styles.cancelLink} onPress={resetForm}>
                  {t('cancel')}
                </Text>
              )}
            </View>

            {hiddenByPlan.length > 0 && (
              <View style={styles.planHint}>
                <Ionicons name="lock-closed-outline" size={14} color={colors.amberDark} />
                <Text style={styles.planHintText}>
                  {t('planLockedHint', { list: hiddenByPlan.join(', ') })}
                </Text>
              </View>
            )}
            <Input
              icon="business-outline"
              placeholder={t('garageName')}
              value={name}
              onChangeText={setName}
            />
            <Input
              icon="location-outline"
              placeholder={t('address')}
              value={address}
              onChangeText={setAddress}
            />
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
            {form.fields.city.visible && (
              <Input
                icon="map-outline"
                placeholder={`${t('city')}${form.fields.city.required ? ' *' : ''}`}
                value={city}
                onChangeText={setCity}
              />
            )}
            {form.fields.phone.visible && (
              <Input
                icon="call-outline"
                placeholder={`${t('phone')}${form.fields.phone.required ? ' *' : ''}`}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            )}
            {form.fields.description.visible && (
              <Input
                icon="document-text-outline"
                placeholder={`${t('description')}${form.fields.description.required ? ' *' : ''}`}
                value={description}
                onChangeText={setDescription}
              />
            )}
            {form.fields.hours.visible && (
            <>
            {/* Horaires par jour */}
            <Text style={styles.sectionLabel}>{t('hoursPerDay')}</Text>
            <View style={styles.hoursBox}>
              {week.map((d, i) => {
                const dayName = t('daysShort').split(',')[i];
                return (
                  <View
                    key={i}
                    style={[styles.hoursRow, i > 0 && styles.hoursRowBorder]}
                  >
                    <BouncyPressable
                      onPress={() => setDay(i, { closed: !d.closed })}
                      style={[styles.dayToggle, !d.closed && styles.dayToggleOn]}
                    >
                      <Ionicons
                        name={d.closed ? 'close' : 'checkmark'}
                        size={13}
                        color={d.closed ? colors.faint : colors.white}
                      />
                    </BouncyPressable>
                    <Text style={styles.hoursDay}>{dayName}</Text>
                    {d.closed ? (
                      <Text style={styles.hoursClosed}>{t('closedDay')}</Text>
                    ) : (
                      <View style={styles.hoursBtns}>
                        <BouncyPressable
                          onPress={() => setTimePicker({ day: i, field: 'open' })}
                          style={styles.hoursBtn}
                        >
                          <Text style={styles.hoursBtnText}>{d.open}</Text>
                        </BouncyPressable>
                        <Text style={styles.hoursDash}>–</Text>
                        <BouncyPressable
                          onPress={() =>
                            setTimePicker({ day: i, field: 'close' })
                          }
                          style={styles.hoursBtn}
                        >
                          <Text style={styles.hoursBtnText}>{d.close}</Text>
                        </BouncyPressable>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
            {timePicker && (
              <DateTimePicker
                value={hhmmToDate(week[timePicker.day][timePicker.field])}
                mode="time"
                is24Hour
                onChange={(_event, date) => {
                  const target = timePicker;
                  setTimePicker(null);
                  if (date && target) {
                    const hhmm = `${String(date.getHours()).padStart(2, '0')}:${String(
                      date.getMinutes()
                    ).padStart(2, '0')}`;
                    setDay(target.day, { [target.field]: hhmm });
                  }
                }}
              />
            )}
            </>
            )}

            {/* Types de service puis sous-types */}
            <Text style={styles.sectionLabel}>{t('serviceTypesHint')}</Text>
            {formPlan.maxServices > 0 && (
              <Text style={styles.planServicesHint}>
                {t('planServicesHint', { n: formPlan.maxServices })}
              </Text>
            )}
            <View style={styles.categoriesBox}>
              {catalog.map((c, i) => {
                const catOn = categories.includes(c.id);
                return (
                  <View
                    key={c.id}
                    style={[styles.categoryBlock, i > 0 && styles.hoursRowBorder]}
                  >
                    <BouncyPressable
                      onPress={() => selectCategory(c.id)}
                      style={styles.categoryRow}
                    >
                      <View
                        style={[styles.dayToggle, styles.radio, catOn && styles.dayToggleOn]}
                      >
                        {catOn && <View style={styles.radioDot} />}
                      </View>
                      <CategoryIcon category={c} size={18} color={catOn ? colors.teal : colors.muted} />
                      <Text style={styles.categoryText}>{localized(c, lang)}</Text>
                    </BouncyPressable>
                    {catOn && c.subtypes.length > 0 && (
                      <View style={styles.subChipsWrap}>
                        {c.subtypes.map((s) => {
                          const on = services.includes(s.label);
                          return (
                            <BouncyPressable
                              key={s.id}
                              onPress={() => toggleService(s.label)}
                              style={[styles.serviceChip, on && styles.serviceChipOn]}
                            >
                              {on && (
                                <Ionicons name="checkmark" size={13} color={colors.teal} />
                              )}
                              <Text
                                style={[
                                  styles.serviceChipText,
                                  on && styles.serviceChipTextOn,
                                ]}
                              >
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

            {otherServices.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>{t('otherServices')}</Text>
                <View style={styles.chipsWrap}>
                  {otherServices.map((s) => (
                    <BouncyPressable
                      key={s}
                      onPress={() => toggleService(s)}
                      style={[styles.serviceChip, styles.serviceChipOn]}
                    >
                      <Ionicons name="close" size={13} color={colors.teal} />
                      <Text style={[styles.serviceChipText, styles.serviceChipTextOn]}>
                        {s}
                      </Text>
                    </BouncyPressable>
                  ))}
                </View>
              </>
            )}

            {form.fields.promo.visible && (
              <Input
                icon="pricetag-outline"
                placeholder={t('promoPlaceholder')}
                value={promo}
                onChangeText={setPromo}
              />
            )}
            {form.fields.prices.visible && (
              <Input
                icon="cash-outline"
                placeholder={t('pricesPlaceholder')}
                value={priceText}
                onChangeText={setPriceText}
              />
            )}

            <View style={styles.toggles}>
              <BouncyPressable
                onPress={() => setIsOpen((v) => !v)}
                style={[styles.toggle, isOpen && styles.toggleOn]}
              >
                <Ionicons
                  name={isOpen ? 'checkmark-circle' : 'close-circle'}
                  size={16}
                  color={isOpen ? colors.success : colors.danger}
                />
                <Text style={styles.toggleText}>
                  {isOpen ? t('open') : t('closed')}
                </Text>
              </BouncyPressable>
              {form.fields.mobileService.visible && (
                <BouncyPressable
                  onPress={() => setMobileService((v) => !v)}
                  style={[styles.toggle, mobileService && styles.toggleOn]}
                >
                  <Ionicons
                    name="car"
                    size={16}
                    color={mobileService ? colors.teal : colors.faint}
                  />
                  <Text style={styles.toggleText}>{t('movesAround')}</Text>
                </BouncyPressable>
              )}
            </View>

            {/* Photos */}
            {form.fields.photos.visible && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: 4, marginBottom: 8 }}
              contentContainerStyle={{ gap: 8 }}
            >
              {photos.map((uri, i) => (
                <View key={i}>
                  <Image source={{ uri }} style={styles.photoThumb} />
                  <BouncyPressable
                    onPress={() =>
                      setPhotos((prev) => prev.filter((_, j) => j !== i))
                    }
                    style={styles.photoRemove}
                  >
                    <Ionicons name="close" size={12} color={colors.white} />
                  </BouncyPressable>
                </View>
              ))}
              {photos.length < MAX_PHOTOS && (
                <BouncyPressable onPress={pickPhoto} style={styles.photoAdd}>
                  <Ionicons name="camera-outline" size={20} color={colors.teal} />
                  <Text style={styles.photoAddText}>
                    {t('photo')}
                    {form.fields.photos.required ? ' *' : ''}
                  </Text>
                </BouncyPressable>
              )}
            </ScrollView>
            )}

            <BouncyPressable
              onPress={onSubmit}
              disabled={busy}
              style={[styles.btnWrap, busy && { opacity: 0.6 }]}
            >
              <View style={styles.btn}>
                <Ionicons
                  name={editing ? 'save-outline' : 'cloud-upload-outline'}
                  size={17}
                  color={colors.white}
                />
                <Text style={styles.btnText}>
                  {busy
                    ? t('sending')
                    : editing
                      ? t('saveChanges')
                      : t('publishMyGarage')}
                </Text>
              </View>
            </BouncyPressable>

            {editing && (
              <BouncyPressable onPress={onDelete} style={styles.deleteBtn}>
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
                <Text style={styles.deleteText}>{t('deleteThisGarage')}</Text>
              </BouncyPressable>
            )}
          </View>
            )}

            {(!accountPending || hasGarage) && (
              <Text style={styles.listLabel}>
                {hasGarage ? t('mySheetTouch') : t('noSheetYet')}
              </Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View>
            {item.status === 'pending' && (
              <View style={styles.pendingBadge}>
                <Ionicons name="hourglass-outline" size={13} color={colors.amberDark} />
                <Text style={styles.pendingBadgeText}>
                  {t('pendingNotVisible')}
                </Text>
              </View>
            )}
            <GarageCard garage={item} onPress={() => startEdit(item)} />
            <View style={styles.statsRow}>
              <View style={styles.statsItems}>
                <Ionicons name="eye-outline" size={14} color={colors.muted} />
                <Text style={styles.stats}>{item.views}</Text>
                <Ionicons name="call-outline" size={14} color={colors.muted} style={{ marginLeft: 8 }} />
                <Text style={styles.stats}>{item.calls}</Text>
                {item.rating != null && (
                  <>
                    <Ionicons name="star" size={13} color={colors.amber} style={{ marginLeft: 8 }} />
                    <Text style={styles.stats}>{item.rating}</Text>
                  </>
                )}
              </View>
              <BouncyPressable
                onPress={() => toggleOpenQuick(item)}
                style={[
                  styles.quickOpen,
                  item.isOpen ? styles.quickOpenOn : styles.quickOpenOff,
                ]}
              >
                <Text
                  style={{
                    color: item.isOpen ? colors.success : colors.danger,
                    fontWeight: '700',
                    fontSize: 12,
                  }}
                >
                  {item.isOpen ? t('setClosed') : t('setOpen')}
                </Text>
              </BouncyPressable>
            </View>
            <StatsChart data={stats} />
            <PlanSection garage={item} onChanged={reload} />
          </View>
        )}
      />
      </KeyboardAvoidingView>
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
  root: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  hero: { paddingBottom: 14 },
  heroTitle: {
    color: colors.ink,
    fontSize: 27,
    fontWeight: font.black,
    letterSpacing: -0.6,
  },
  heroSub: { color: colors.muted, fontSize: 12.5, marginTop: 4 },
  planHint: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: colors.amberSoft,
    borderRadius: radii.sm,
    padding: 10,
    marginBottom: 12,
  },
  planHintText: { flex: 1, color: colors.ink, fontSize: 12, lineHeight: 17 },
  planServicesHint: { color: colors.muted, fontSize: 11.5, marginTop: -4, marginBottom: 8 },
  form: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: 18,
    marginBottom: 18,
  },
  notice: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: 18,
    marginBottom: 14,
    alignItems: 'center',
  },
  noticeIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.amberSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  noticeTitle: {
    fontSize: 15.5,
    fontWeight: font.extrabold,
    color: colors.ink,
    textAlign: 'center',
  },
  noticeText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 6,
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.amberSoft,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  pendingBadgeText: {
    flex: 1,
    color: colors.amberDark,
    fontWeight: font.bold,
    fontSize: 12,
  },
  formHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  formTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: font.extrabold,
    color: colors.ink,
  },
  cancelLink: {
    color: colors.teal,
    fontWeight: font.bold,
    fontSize: 13,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: colors.field,
    borderRadius: radii.sm,
    paddingHorizontal: 13,
    height: 48,
    marginBottom: 9,
  },
  inputText: { flex: 1, color: colors.ink, fontSize: 14 },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.field,
    borderRadius: radii.sm,
    paddingHorizontal: 13,
    paddingVertical: 10,
    marginBottom: 9,
  },
  locationRowMissing: {
    backgroundColor: colors.tealSoft,
  },
  locationTitle: { color: colors.ink, fontWeight: font.bold, fontSize: 13.5 },
  radio: { borderRadius: 999 },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.white },
  locationSub: { color: colors.muted, fontSize: 12, marginTop: 1 },
  sectionLabel: {
    fontSize: 12.5,
    fontWeight: font.extrabold,
    color: colors.muted,
    marginTop: 4,
    marginBottom: 8,
  },
  hoursBox: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    marginBottom: 12,
  },
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  hoursRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  dayToggle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.field,
  },
  dayToggleOn: {
    backgroundColor: colors.teal,
    borderColor: colors.teal,
  },
  hoursDay: {
    width: 44,
    fontSize: 12.5,
    fontWeight: font.bold,
    color: colors.ink,
  },
  hoursClosed: {
    flex: 1,
    fontSize: 12.5,
    color: colors.faint,
    textAlign: 'right',
  },
  hoursBtns: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  hoursBtn: {
    backgroundColor: colors.field,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.line,
  },
  hoursBtnText: {
    fontSize: 12.5,
    fontWeight: font.bold,
    color: colors.teal,
  },
  hoursDash: { color: colors.faint },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 12,
  },
  categoriesBox: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    marginBottom: 12,
  },
  categoryBlock: { paddingHorizontal: 12, paddingVertical: 9 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  categoryText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: font.bold,
    color: colors.ink,
  },
  subChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 9,
    marginLeft: 32,
  },
  serviceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.bg,
    borderRadius: radii.pill,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: colors.line,
  },
  serviceChipOn: {
    backgroundColor: colors.tealSoft,
    borderColor: colors.teal,
  },
  serviceChipText: { fontSize: 12.5, color: colors.muted, fontWeight: font.semibold },
  serviceChipTextOn: { color: colors.tealDark, fontWeight: font.bold },
  toggles: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  toggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.line,
  },
  toggleOn: {
    backgroundColor: colors.tealSoft,
    borderColor: colors.teal,
  },
  toggleText: { fontWeight: font.bold, color: colors.ink, fontSize: 12.5 },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -6,
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  stats: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  statsItems: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  quickOpen: {
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  quickOpenOn: { backgroundColor: colors.successSoft },
  quickOpenOff: { backgroundColor: colors.dangerSoft },
  photoThumb: {
    width: 76,
    height: 76,
    borderRadius: radii.md,
    backgroundColor: colors.line,
  },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAdd: {
    width: 76,
    height: 76,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.teal,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: colors.tealSoft,
  },
  photoAddText: { fontSize: 11, color: colors.teal, fontWeight: font.bold },
  btnWrap: { borderRadius: radii.pill, overflow: 'hidden', marginTop: 6 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    backgroundColor: colors.teal,
    borderRadius: radii.pill,
  },
  btnText: { color: colors.white, fontWeight: font.extrabold, fontSize: 14.5 },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: radii.md,
    backgroundColor: colors.dangerSoft,
  },
  deleteText: { color: colors.danger, fontWeight: font.bold, fontSize: 13.5 },
  listLabel: {
    marginTop: 18,
    fontSize: 12.5,
    fontWeight: font.extrabold,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyBox: { alignItems: 'center', gap: 8, paddingHorizontal: 20 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: radii.lg,
    backgroundColor: colors.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: { fontSize: 18, fontWeight: font.extrabold, color: colors.ink },
  hint: { color: colors.muted, textAlign: 'center', lineHeight: 20 },
});
