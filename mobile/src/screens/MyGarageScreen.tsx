import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import {
  createGarage,
  deleteGarage,
  fetchMyGarages,
  updateGarage,
} from '../api/client';
import { GarageCard } from '../components/GarageCard';
import { OfflineBanner } from '../components/OfflineBanner';
import { BouncyPressable } from '../components/Pressable';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { font, radii, shadow, type ThemeColors } from '../theme';
import type { Garage } from '../types';

const MAX_PHOTOS = 12;

const SERVICE_OPTIONS = [
  'vidange',
  'freins',
  'moteur',
  'diagnostic',
  'pneus',
  'climatisation',
  'batterie',
  'carrosserie',
  'suspension',
  'échappement',
  'boîte de vitesses',
  'pare-brise',
  'lavage',
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
  const [openingHours, setOpeningHours] = useState('Lun–Sam 8h–18h');
  const [mobileService, setMobileService] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [busy, setBusy] = useState(false);

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
    setOpeningHours('Lun–Sam 8h–18h');
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
    setOpeningHours(g.openingHours ?? 'Lun–Sam 8h–18h');
    setMobileService(!!g.mobileService);
    setIsOpen(g.isOpen);
  };

  const toggleService = (s: string) => {
    setServices((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const reload = useCallback(async () => {
    if (!user || offline) return;
    try {
      await refreshUser();
      setMine(await fetchMyGarages());
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Échec');
    }
  }, [user, offline, refreshUser]);

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
          <Text style={styles.emptyTitle}>Espace réservé</Text>
          <Text style={styles.hint}>
            Connecte-toi dans l’onglet Garage pour publier et gérer tes
            fiches.
          </Text>
        </View>
      </View>
    );
  }

  const pickPhoto = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Limite', `Maximum ${MAX_PHOTOS} photos.`);
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
      Alert.alert('Hors ligne', 'Cette action nécessite une connexion.');
      return;
    }
    if (!name.trim() || !address.trim()) {
      Alert.alert('Champs requis', 'Nom et adresse sont obligatoires.');
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
        openingHours: openingHours.trim() || 'Lun–Sam 8h–18h',
        mobileService,
        isOpen,
      };
      if (editing) {
        await updateGarage(editing.id, payload);
        Alert.alert('Enregistré', 'Fiche mise à jour.');
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
        Alert.alert(
          'Envoyé pour validation',
          'Ton garage a été soumis à l’administrateur Mekano. Il sera visible par les clients dès sa validation.'
        );
      }
      resetForm();
      await reload();
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Échec');
    } finally {
      setBusy(false);
    }
  };

  const toggleOpenQuick = async (g: Garage) => {
    try {
      await updateGarage(g.id, { isOpen: !g.isOpen });
      await reload();
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Échec');
    }
  };

  const onDelete = () => {
    if (!editing) return;
    Alert.alert('Supprimer', `Supprimer « ${editing.name} » ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteGarage(editing.id);
            resetForm();
            await reload();
          } catch (e) {
            Alert.alert('Erreur', e instanceof Error ? e.message : 'Échec');
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
        <Text style={styles.heroTitle}>Mon garage</Text>
        <Text style={styles.heroSub}>
          Un compte = un garage · publie et gère ta fiche
        </Text>
      </View>

      <OfflineBanner offline={offline} />

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
                  Compte en attente de validation
                </Text>
                <Text style={styles.noticeText}>
                  Ton compte doit d’abord être validé par l’administrateur
                  Mekano. Dès qu’il aura confirmé, tu pourras publier ton
                  garage — reviens sur cet écran pour vérifier.
                </Text>
              </View>
            )}

            {!accountPending && hasGarage && !editing && (
              <View style={[styles.notice, shadow.card]}>
                <View style={styles.noticeIcon}>
                  <Ionicons name="business-outline" size={22} color={colors.teal} />
                </View>
                <Text style={styles.noticeTitle}>Ta fiche garage</Text>
                <Text style={styles.noticeText}>
                  Un seul garage par compte. Touche ta fiche ci-dessous pour
                  modifier son nom, ses services, ses photos ou ses tarifs.
                </Text>
              </View>
            )}

            {showForm && (
          <View style={[styles.form, shadow.card]}>
            <View style={styles.formHead}>
              <Text style={styles.formTitle}>
                {editing ? `Modifier · ${editing.name}` : 'Publier mon garage'}
              </Text>
              {editing && (
                <Text style={styles.cancelLink} onPress={resetForm}>
                  Annuler
                </Text>
              )}
            </View>

            <Input
              icon="business-outline"
              placeholder="Nom du garage"
              value={name}
              onChangeText={setName}
            />
            <Input
              icon="location-outline"
              placeholder="Adresse"
              value={address}
              onChangeText={setAddress}
            />
            <Input
              icon="map-outline"
              placeholder="Ville"
              value={city}
              onChangeText={setCity}
            />
            <Input
              icon="call-outline"
              placeholder="Téléphone"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            <Input
              icon="document-text-outline"
              placeholder="Description du garage"
              value={description}
              onChangeText={setDescription}
            />
            <Input
              icon="time-outline"
              placeholder="Horaires (ex : Lun–Sam 8h–18h)"
              value={openingHours}
              onChangeText={setOpeningHours}
            />

            {/* Services : multi-sélection */}
            <Text style={styles.sectionLabel}>
              Services proposés ({services.length} sélectionné
              {services.length > 1 ? 's' : ''})
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
              placeholder="Promo (ex : -20% vidange cette semaine)"
              value={promo}
              onChangeText={setPromo}
            />
            <Input
              icon="cash-outline"
              placeholder="Prix (ex : vidange:50 000 Ar, freins:80 000 Ar)"
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
                  {isOpen ? 'Ouvert' : 'Fermé'}
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
                <Text style={styles.toggleText}>Se déplace</Text>
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
                  <Text style={styles.photoAddText}>Photo</Text>
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
                    ? 'Envoi…'
                    : editing
                      ? 'Enregistrer les modifications'
                      : 'Publier mon garage'}
                </Text>
              </View>
            </BouncyPressable>

            {editing && (
              <BouncyPressable onPress={onDelete} style={styles.deleteBtn}>
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
                <Text style={styles.deleteText}>Supprimer ce garage</Text>
              </BouncyPressable>
            )}
          </View>
            )}

            {!accountPending && (
              <Text style={styles.listLabel}>
                {hasGarage
                  ? 'Ma fiche — touche-la pour la modifier'
                  : 'Aucune fiche publiée pour l’instant'}
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
                  En attente de validation — pas encore visible par les clients
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
                  {item.isOpen ? 'Passer fermé' : 'Passer ouvert'}
                </Text>
              </BouncyPressable>
            </View>
          </View>
        )}
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
