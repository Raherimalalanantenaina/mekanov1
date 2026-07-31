import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {
  createAppointment,
  createQuote,
  fetchGarageById,
  fetchReviews,
  getFavorites,
  postReview,
  toggleFavorite,
  trackGarage,
} from '../api/client';
import { HeroDecor } from '../components/HeroDecor';
import { BouncyPressable } from '../components/Pressable';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import { font, gradients, radii, shadow, type ThemeColors } from '../theme';
import type { Garage, Review } from '../types';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'GarageDetail'>;

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={[styles.infoCard, shadow.card]}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={19} color={colors.teal} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

export function GarageDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const pad = width < 360 ? 14 : 20;

  const [garage, setGarage] = useState<Garage | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isFav, setIsFav] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Review modal
  const [showReview, setShowReview] = useState(false);
  const [rName, setRName] = useState('');
  const [rRating, setRRating] = useState(5);
  const [rComment, setRComment] = useState('');

  // Quote modal
  const [showQuote, setShowQuote] = useState(false);
  const [qName, setQName] = useState('');
  const [qPhone, setQPhone] = useState('');
  const [qDesc, setQDesc] = useState('');
  const [qPhoto, setQPhoto] = useState('');

  // Booking modal
  const [showBooking, setShowBooking] = useState(false);
  const [bName, setBName] = useState('');
  const [bPhone, setBPhone] = useState('');
  const [bDate, setBDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d;
  });
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  const [bNote, setBNote] = useState('');

  useEffect(() => {
    Promise.all([
      fetchGarageById(id),
      fetchReviews(id).catch(() => [] as Review[]),
      getFavorites(),
    ])
      .then(([g, revs, favs]) => {
        setGarage(g);
        setReviews(revs);
        setIsFav(favs.includes(id));
        trackGarage(id, 'view');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erreur'));
  }, [id]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.danger }}>{error}</Text>
      </View>
    );
  }
  if (!garage) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.teal} />
      </View>
    );
  }

  const onCall = () => {
    if (!garage.phone) return;
    trackGarage(garage.id, 'call');
    Linking.openURL(`tel:${garage.phone}`);
  };

  const onWhatsApp = () => {
    if (!garage.phone) return;
    const digits = garage.phone.replace(/[^\d]/g, '');
    Linking.openURL(
      `https://wa.me/${digits}?text=${encodeURIComponent(
        `Bonjour ${garage.name}, je vous contacte via Mekano.`
      )}`
    );
  };

  const onShare = async () => {
    await Share.share({
      message: `${garage.name} — ${garage.address}, ${garage.city}${
        garage.phone ? ` · ${garage.phone}` : ''
      }\nTrouvé sur Mekano`,
    });
  };

  const onSubmitReview = async () => {
    if (!rName.trim()) {
      Alert.alert('Nom requis');
      return;
    }
    try {
      await postReview(id, {
        authorName: rName.trim(),
        rating: rRating,
        comment: rComment.trim(),
      });
      setReviews(await fetchReviews(id));
      setGarage(await fetchGarageById(id));
      setShowReview(false);
      setRComment('');
      Alert.alert('Merci', 'Ton avis a été publié.');
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Échec');
    }
  };

  const onSubmitQuote = async () => {
    if (!qName.trim() || !qDesc.trim()) {
      Alert.alert('Champs requis', 'Nom et description sont obligatoires.');
      return;
    }
    try {
      await createQuote({
        garageId: id,
        clientName: qName.trim(),
        clientPhone: qPhone.trim(),
        description: qDesc.trim(),
        photo: qPhoto,
      });
      setShowQuote(false);
      setQDesc('');
      setQPhoto('');
      Alert.alert('Envoyé', 'Le garage a reçu ta demande de devis.');
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Échec');
    }
  };

  const onSubmitBooking = async () => {
    if (!bName.trim()) {
      Alert.alert('Champs requis', 'Ton nom est obligatoire.');
      return;
    }
    const slot = `${bDate.toLocaleDateString('fr-FR')} à ${bDate.toLocaleTimeString(
      'fr-FR',
      { hour: '2-digit', minute: '2-digit' }
    )}`;
    try {
      await createAppointment({
        garageId: id,
        clientName: bName.trim(),
        clientPhone: bPhone.trim(),
        slot,
        note: bNote.trim(),
      });
      setShowBooking(false);
      setBNote('');
      Alert.alert('Envoyé', 'Demande de rendez-vous transmise au garage.');
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Échec');
    }
  };

  const pickQuotePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.35,
      base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      setQPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + 10, paddingHorizontal: pad }]}
      >
        <HeroDecor />
        <View style={styles.heroTop}>
          <BouncyPressable onPress={() => navigation.goBack()} style={styles.back}>
            <Ionicons name="arrow-back" size={20} color={colors.white} />
          </BouncyPressable>
          <BouncyPressable
            onPress={async () => {
              const next = await toggleFavorite(id);
              setIsFav(next.includes(id));
            }}
            style={styles.back}
          >
            <Ionicons
              name={isFav ? 'heart' : 'heart-outline'}
              size={20}
              color={isFav ? '#FF8A80' : colors.white}
            />
          </BouncyPressable>
        </View>

        <View style={styles.heroIcon}>
          <Ionicons name="construct" size={30} color={colors.amber} />
        </View>
        <Text style={styles.name}>{garage.name}</Text>
        <View style={styles.heroMeta}>
          <Ionicons name="location" size={13} color="rgba(255,255,255,0.8)" />
          <Text style={styles.city}>{garage.city}</Text>
          {garage.rating != null && (
            <Text style={styles.ratingPill}>
              ★ {garage.rating.toFixed(1)} ({garage.reviewCount})
            </Text>
          )}
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: garage.isOpen
                  ? 'rgba(30,158,106,0.3)'
                  : 'rgba(214,69,65,0.3)',
              },
            ]}
          >
            <Text
              style={{
                color: garage.isOpen ? '#8FEFC2' : '#FFB3AF',
                fontSize: 11.5,
                fontWeight: font.bold,
              }}
            >
              {garage.isOpen ? `● ${t('open')}` : `● ${t('closed')}`}
            </Text>
          </View>
        </View>
        {!!garage.promo && (
          <View style={styles.promoBanner}>
            <Ionicons name="pricetag" size={13} color={colors.tealDeep} />
            <Text style={styles.promoText}>{garage.promo}</Text>
          </View>
        )}
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: pad, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {garage.photos?.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.photosRow}
            contentContainerStyle={{ gap: 10 }}
          >
            {garage.photos.map((uri, i) => (
              <Image
                key={i}
                source={{ uri }}
                style={[styles.photo, { width: width * 0.62 }]}
                resizeMode="cover"
              />
            ))}
          </ScrollView>
        )}

        {garage.description ? (
          <Text style={styles.desc}>{garage.description}</Text>
        ) : null}

        {garage.mobileService && (
          <View style={styles.mobileRow}>
            <Ionicons name="car" size={16} color={colors.teal} />
            <Text style={styles.mobileText}>{t('movesAround')}</Text>
          </View>
        )}

        <InfoRow icon="location-outline" label={t('address')} value={garage.address} />
        <InfoRow icon="time-outline" label={t('hours')} value={garage.openingHours} />
        <InfoRow
          icon="build-outline"
          label={t('services')}
          value={
            garage.services?.length
              ? garage.services.join(' · ')
              : 'Non renseignés'
          }
        />

        {garage.priceList?.length > 0 && (
          <View style={[styles.infoCard, shadow.card]}>
            <Text style={styles.infoLabel}>{t('prices')}</Text>
            {garage.priceList.map((p, i) => (
              <View key={i} style={styles.priceRow}>
                <Text style={styles.priceService}>{p.service}</Text>
                <Text style={styles.priceValue}>{p.price}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Actions principales */}
        {garage.phone ? (
          <BouncyPressable
            onPress={onCall}
            style={styles.btnWrap}
          >
            <LinearGradient
              colors={gradients.brand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.btn}
            >
              <Ionicons name="call" size={18} color={colors.white} />
              <Text style={styles.btnText}>
                {t('call')} {garage.phone}
              </Text>
            </LinearGradient>
          </BouncyPressable>
        ) : null}

        <BouncyPressable
          onPress={() =>
            navigation.navigate('Route', {
              garageId: garage.id,
              name: garage.name,
              latitude: garage.latitude,
              longitude: garage.longitude,
            })
          }
          style={styles.btnWrap}
        >
          <LinearGradient
            colors={gradients.amber}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.btn}
          >
            <Ionicons name="navigate" size={18} color={colors.tealDeep} />
            <Text style={[styles.btnText, { color: colors.tealDeep }]}>
              {t('routeInApp')}
            </Text>
          </LinearGradient>
        </BouncyPressable>

        <View style={styles.actionGrid}>
          {garage.phone ? (
            <BouncyPressable onPress={onWhatsApp} style={styles.actionCell}>
              <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
              <Text style={styles.actionLabel}>WhatsApp</Text>
            </BouncyPressable>
          ) : null}
          <BouncyPressable onPress={onShare} style={styles.actionCell}>
            <Ionicons name="share-social" size={18} color={colors.teal} />
            <Text style={styles.actionLabel}>{t('share')}</Text>
          </BouncyPressable>
          <BouncyPressable
            onPress={() => setShowQuote(true)}
            style={styles.actionCell}
          >
            <Ionicons name="document-text" size={18} color={colors.amberDark} />
            <Text style={styles.actionLabel}>{t('quote')}</Text>
          </BouncyPressable>
          <BouncyPressable
            onPress={() => setShowBooking(true)}
            style={styles.actionCell}
          >
            <Ionicons name="calendar" size={18} color={colors.teal} />
            <Text style={styles.actionLabel}>{t('booking')}</Text>
          </BouncyPressable>
        </View>

        {/* Avis */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>
            {t('reviews')} ({reviews.length})
          </Text>
          <Text style={styles.link} onPress={() => setShowReview(true)}>
            {t('addReview')}
          </Text>
        </View>
        {reviews.length === 0 ? (
          <Text style={styles.emptyReviews}>Aucun avis pour l’instant</Text>
        ) : (
          reviews.map((r) => (
            <View key={r.id} style={[styles.reviewCard, shadow.card]}>
              <View style={styles.reviewTop}>
                <Text style={styles.reviewAuthor}>{r.authorName}</Text>
                <Text style={styles.reviewStars}>
                  {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                </Text>
              </View>
              {!!r.comment && (
                <Text style={styles.reviewComment}>{r.comment}</Text>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* ===== Modal Avis ===== */}
      <Modal visible={showReview} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{t('addReview')}</Text>
            <TextInput
              style={styles.field}
              placeholder={t('yourName')}
              placeholderTextColor={colors.faint}
              value={rName}
              onChangeText={setRName}
            />
            <View style={styles.starsPick}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Ionicons
                  key={i}
                  name={i <= rRating ? 'star' : 'star-outline'}
                  size={28}
                  color={colors.amberDark}
                  onPress={() => setRRating(i)}
                />
              ))}
            </View>
            <TextInput
              style={[styles.field, { height: 80, textAlignVertical: 'top' }]}
              placeholder={t('comment')}
              placeholderTextColor={colors.faint}
              value={rComment}
              onChangeText={setRComment}
              multiline
            />
            <BouncyPressable onPress={onSubmitReview} style={styles.modalBtn}>
              <Text style={styles.modalBtnText}>{t('send')}</Text>
            </BouncyPressable>
            <Text style={styles.cancel} onPress={() => setShowReview(false)}>
              Annuler
            </Text>
          </View>
        </View>
      </Modal>

      {/* ===== Modal Devis ===== */}
      <Modal visible={showQuote} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{t('quote')}</Text>
            <TextInput
              style={styles.field}
              placeholder={t('yourName')}
              placeholderTextColor={colors.faint}
              value={qName}
              onChangeText={setQName}
            />
            <TextInput
              style={styles.field}
              placeholder={t('phone')}
              placeholderTextColor={colors.faint}
              value={qPhone}
              onChangeText={setQPhone}
              keyboardType="phone-pad"
            />
            <TextInput
              style={[styles.field, { height: 90, textAlignVertical: 'top' }]}
              placeholder={t('describeProblem')}
              placeholderTextColor={colors.faint}
              value={qDesc}
              onChangeText={setQDesc}
              multiline
            />
            <BouncyPressable onPress={pickQuotePhoto} style={styles.photoPick}>
              <Ionicons name="camera-outline" size={16} color={colors.teal} />
              <Text style={{ color: colors.teal, fontWeight: font.bold }}>
                {qPhoto ? 'Photo ajoutée' : 'Ajouter une photo'}
              </Text>
            </BouncyPressable>
            <BouncyPressable onPress={onSubmitQuote} style={styles.modalBtn}>
              <Text style={styles.modalBtnText}>{t('send')}</Text>
            </BouncyPressable>
            <Text style={styles.cancel} onPress={() => setShowQuote(false)}>
              Annuler
            </Text>
          </View>
        </View>
      </Modal>

      {/* ===== Modal RDV ===== */}
      <Modal visible={showBooking} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{t('booking')}</Text>
            <TextInput
              style={styles.field}
              placeholder={t('yourName')}
              placeholderTextColor={colors.faint}
              value={bName}
              onChangeText={setBName}
            />
            <TextInput
              style={styles.field}
              placeholder={t('phone')}
              placeholderTextColor={colors.faint}
              value={bPhone}
              onChangeText={setBPhone}
              keyboardType="phone-pad"
            />
            <View style={styles.dtRow}>
              <BouncyPressable
                onPress={() => setPicker('date')}
                style={styles.dtBtn}
              >
                <Ionicons name="calendar-outline" size={16} color={colors.teal} />
                <Text style={styles.dtText}>
                  {bDate.toLocaleDateString('fr-FR')}
                </Text>
              </BouncyPressable>
              <BouncyPressable
                onPress={() => setPicker('time')}
                style={styles.dtBtn}
              >
                <Ionicons name="time-outline" size={16} color={colors.teal} />
                <Text style={styles.dtText}>
                  {bDate.toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </BouncyPressable>
            </View>
            {picker && (
              <DateTimePicker
                value={bDate}
                mode={picker}
                minimumDate={new Date()}
                onChange={(_event, date) => {
                  setPicker(null);
                  if (date) setBDate(date);
                }}
              />
            )}
            <TextInput
              style={styles.field}
              placeholder={t('notes')}
              placeholderTextColor={colors.faint}
              value={bNote}
              onChangeText={setBNote}
            />
            <BouncyPressable onPress={onSubmitBooking} style={styles.modalBtn}>
              <Text style={styles.modalBtnText}>{t('send')}</Text>
            </BouncyPressable>
            <Text style={styles.cancel} onPress={() => setShowBooking(false)}>
              Annuler
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  hero: {
    paddingBottom: 22,
    borderBottomLeftRadius: radii.xl,
    borderBottomRightRadius: radii.xl,
    overflow: 'hidden',
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  name: {
    color: colors.white,
    fontSize: 26,
    fontWeight: font.black,
    letterSpacing: -0.4,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  city: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13.5,
    fontWeight: font.semibold,
  },
  ratingPill: {
    color: colors.amber,
    fontWeight: font.bold,
    fontSize: 12,
    marginLeft: 4,
  },
  statusPill: {
    marginLeft: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  promoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    backgroundColor: colors.amber,
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  promoText: {
    color: colors.tealDeep,
    fontWeight: font.extrabold,
    fontSize: 12.5,
  },
  photosRow: { marginBottom: 16 },
  photo: {
    height: 150,
    borderRadius: radii.lg,
    backgroundColor: colors.line,
  },
  desc: {
    color: colors.muted,
    lineHeight: 21,
    fontSize: 14.5,
    marginBottom: 12,
  },
  mobileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.tealSoft,
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 12,
  },
  mobileText: { color: colors.teal, fontWeight: font.bold, fontSize: 12.5 },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: 15,
    marginBottom: 10,
  },
  infoIcon: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    backgroundColor: colors.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: font.bold,
    color: colors.faint,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  infoValue: { marginTop: 3, color: colors.ink, fontSize: 14.5, lineHeight: 20 },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    width: '100%',
  },
  priceService: { color: colors.ink, fontSize: 14 },
  priceValue: { color: colors.teal, fontWeight: font.extrabold, fontSize: 14 },
  btnWrap: { marginTop: 10, borderRadius: radii.lg, overflow: 'hidden' },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingVertical: 16,
    borderRadius: radii.lg,
  },
  btnText: { color: colors.white, fontWeight: font.extrabold, fontSize: 15 },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  actionCell: {
    width: '30%',
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.line,
  },
  actionLabel: { fontSize: 11.5, fontWeight: font.bold, color: colors.ink },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 22,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: font.extrabold, color: colors.ink },
  link: { color: colors.teal, fontWeight: font.bold, fontSize: 13 },
  emptyReviews: { color: colors.muted, fontSize: 13 },
  reviewCard: {
    backgroundColor: colors.field,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 10,
  },
  reviewTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewAuthor: { fontWeight: font.extrabold, color: colors.ink },
  reviewStars: { color: colors.amberDark, letterSpacing: 1 },
  reviewComment: { marginTop: 6, color: colors.muted, lineHeight: 19 },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: 22,
    paddingBottom: 36,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: font.black,
    color: colors.ink,
    marginBottom: 14,
  },
  field: {
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    color: colors.ink,
    fontSize: 14.5,
    borderWidth: 1,
    borderColor: colors.line,
  },
  dtRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  dtBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.tealSoft,
    borderRadius: radii.md,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.teal,
  },
  dtText: { color: colors.tealDark, fontWeight: font.bold, fontSize: 14 },
  starsPick: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    justifyContent: 'center',
  },
  photoPick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  modalBtn: {
    backgroundColor: colors.teal,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalBtnText: { color: colors.white, fontWeight: font.extrabold },
  cancel: {
    textAlign: 'center',
    marginTop: 14,
    color: colors.muted,
    fontWeight: font.semibold,
  },
});
