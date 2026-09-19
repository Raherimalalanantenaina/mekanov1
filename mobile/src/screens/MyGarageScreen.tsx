import React, { useCallback, useState } from 'react';
import {
  Alert,
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
import { GarageCard } from '../components/GarageCard';
import { OfflineBanner } from '../components/OfflineBanner';
import { BouncyPressable } from '../components/Pressable';
import { StatsChart } from '../components/StatsChart';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { defaultWeek, summarizeWeek } from '../hours';
import { useI18n } from '../i18n';
import { font, radii, shadow, type ThemeColors } from '../theme';
import type { DailyStat, DayHours, Garage } from '../types';

const MAX_PHOTOS = 12;

const SERVICE_OPTIONS = [
  'vidange',
  'freins',
  'moteur',
  'diagnostic',
  'pneus',
  'lavage',
  'lavage intérieur',
  'lavage extérieur',
  'climatisation',
  'batterie',
  'carrosserie',
  'suspension',
  'échappement',
  'boîte de vitesses',
  'pare-brise',
  'dépannage',
  '4x4',
  'électricité auto',
];

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
  const { t } = useI18n();
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
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<DailyStat[]>([]);

  const resetForm = () => {
    setEditing(null);
    setName('');
    setAddress('');
    setCity('Antananarivo');
    setPhone('');
    setServices([]);
    setPhotos([]);
    setPromo('');
    setPriceText('');
    setDescription('');
    setWeek(defaultWeek());
    setMobileService(false);
    setIsOpen(true);
  };

  const startEdit = (g: Garage) => {
    setEditing(g);
    setName(g.name);
    setAddress(g.address);
    setCity(g.city);
    setPhone(g.phone);
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
  };

  const toggleService = (s: string) => {
    setServices((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

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
      Alert.alert(t('error'), e instanceof Error ? e.message : t('fail'));
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
      Alert.alert(t('limit'), t('maxPhotos', { n: MAX_PHOTOS }));
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
      Alert.alert(t('offlineTitle'), t('needsConnection'));
      return;
    }
    if (!name.trim() || !address.trim()) {
      Alert.alert(t('requiredFields'), t('nameAddressRequired'));
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
        address: address.trim(),
        city: city.trim(),
        phone: phone.trim(),
        services: services.length ? services : ['entretien'],
        photos,
        promo: promo.trim(),
        priceList: parsePrices(),
        description: description.trim() || 'Garage inscrit via Mekano',
        openingHours:
          summarizeWeek(week, t('daysShort').split(',')) || t('closedDay'),
        hoursJson: week,
        mobileService,
        isOpen,
      };
      if (editing) {
        await updateGarage(editing.id, payload);
        Alert.alert(t('saved'), t('sheetUpdated'));
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        let latitude = -18.8792;
        let longitude = 47.5079;
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({});
          latitude = pos.coords.latitude;
          longitude = pos.coords.longitude;
        }
        await createGarage({
          ...payload,
          latitude,
          longitude,
        });
        Alert.alert(t('submittedTitle'), t('submittedText'));
      }
      resetForm();
      await reload();
    } catch (e) {
      Alert.alert(t('error'), e instanceof Error ? e.message : t('fail'));
    } finally {
      setBusy(false);
    }
  };

  const toggleOpenQuick = async (g: Garage) => {
    try {
      await updateGarage(g.id, { isOpen: !g.isOpen });
      await reload();
    } catch (e) {
      Alert.alert(t('error'), e instanceof Error ? e.message : t('fail'));
    }
  };

  const onDelete = () => {
    if (!editing) return;
    Alert.alert(t('delete'), t('deleteConfirm', { name: editing.name }), [
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
            Alert.alert(t('error'), e instanceof Error ? e.message : t('fail'));
          }
        },
      },
    ]);
  };

  const accountPending = user.status === 'pending';
  const hasGarage = mine.length >= 1;
  const showForm = !accountPending && (Boolean(editing) || !hasGarage);

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
            <Input
              icon="map-outline"
              placeholder={t('city')}
              value={city}
              onChangeText={setCity}
            />
            <Input
              icon="call-outline"
              placeholder={t('phone')}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            <Input
              icon="document-text-outline"
              placeholder={t('description')}
              value={description}
              onChangeText={setDescription}
            />
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

            {/* Services : multi-sélection */}
            <Text style={styles.sectionLabel}>
              {t('servicesSelected', { n: services.length })}
            </Text>
            <View style={styles.chipsWrap}>
              {[...new Set([...SERVICE_OPTIONS, ...services])].map((s) => {
                const on = services.includes(s);
                return (
                  <BouncyPressable
                    key={s}
                    onPress={() => toggleService(s)}
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
                      {s}
                    </Text>
                  </BouncyPressable>
                );
              })}
            </View>

            <Input
              icon="pricetag-outline"
              placeholder={t('promoPlaceholder')}
              value={promo}
              onChangeText={setPromo}
            />
            <Input
              icon="cash-outline"
              placeholder={t('pricesPlaceholder')}
              value={priceText}
              onChangeText={setPriceText}
            />

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
            </View>

            {/* Photos */}
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
                  <Text style={styles.photoAddText}>{t('photo')}</Text>
                </BouncyPressable>
              )}
            </ScrollView>

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

            {!accountPending && (
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
              <Text style={styles.stats}>
                👁 {item.views} · 📞 {item.calls}
                {item.rating != null ? ` · ★ ${item.rating}` : ''}
              </Text>
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
          </View>
        )}
      />
      </KeyboardAvoidingView>
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
  stats: { color: colors.muted, fontSize: 12 },
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
