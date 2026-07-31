import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Lang = 'fr' | 'mg';

const LANG_KEY = 'mekano:lang';

const STRINGS = {
  fr: {
    tabList: 'Liste',
    tabMap: 'Carte',
    tabRequests: 'Demandes',
    tabPublish: 'Publier',
    tabAccount: 'Garage',
    heroTitle1: 'Trouve le bon garage,',
    heroTitle2: 'où que tu sois.',
    searchPlaceholder: 'Nom, ville, service…',
    nearestLabel: 'Le plus proche de toi',
    found: 'trouvé',
    sortDistance: 'Distance',
    sortRating: 'Note',
    openNow: 'Ouverts',
    favorites: 'Favoris',
    open: 'Ouvert',
    closed: 'Fermé',
    sos: 'SOS Panne',
    sosNone: 'Aucun garage ouvert trouvé à proximité.',
    call: 'Appeler',
    route: 'Itinéraire',
    routeInApp: 'Itinéraire dans l’app',
    share: 'Partager',
    quote: 'Devis',
    booking: 'Rendez-vous',
    reviews: 'Avis',
    addReview: 'Laisser un avis',
    yourName: 'Ton nom',
    comment: 'Commentaire (optionnel)',
    send: 'Envoyer',
    prices: 'Prix indicatifs',
    movesAround: 'Se déplace',
    address: 'Adresse',
    hours: 'Horaires',
    services: 'Services',
    myRequests: 'Mes demandes',
    quotes: 'Devis',
    bookings: 'Rendez-vous',
    noRequests: 'Aucune demande pour l’instant',
    describeProblem: 'Décris ta panne ou ton besoin…',
    phone: 'Téléphone',
    slot: 'Date et heure souhaitées (ex : 02/08 à 14h)',
    notes: 'Remarque (optionnel)',
    pending: 'En attente',
    answered: 'Répondu',
    accepted: 'Accepté',
    declined: 'Refusé',
    writeMessage: 'Écrire un message…',
    offline: 'Mode hors ligne — données en cache',
    language: 'Langue',
  },
  mg: {
    tabList: 'Lisitra',
    tabMap: 'Sarintany',
    tabRequests: 'Fangatahana',
    tabPublish: 'Mamoaka',
    tabAccount: 'Garazy',
    heroTitle1: 'Tadiavo ny garazy mety,',
    heroTitle2: 'na aiza na aiza.',
    searchPlaceholder: 'Anarana, tanàna, tolotra…',
    nearestLabel: 'Akaiky anao indrindra',
    found: 'hita',
    sortDistance: 'Halavirana',
    sortRating: 'Naoty',
    openNow: 'Misokatra',
    favorites: 'Ankafiziko',
    open: 'Misokatra',
    closed: 'Mihidy',
    sos: 'SOS Vaky',
    sosNone: 'Tsy misy garazy misokatra akaiky.',
    call: 'Antsoy',
    route: 'Lalana',
    routeInApp: 'Lalana ao amin’ny app',
    share: 'Zarao',
    quote: 'Vidiny',
    booking: 'Fotoana',
    reviews: 'Hevitra',
    addReview: 'Manome hevitra',
    yourName: 'Ny anaranao',
    comment: 'Fanamarihana (tsy voatery)',
    send: 'Alefa',
    prices: 'Vidiny tombanana',
    movesAround: 'Mandeha any aminao',
    address: 'Adiresy',
    hours: 'Ora fisokafana',
    services: 'Tolotra',
    myRequests: 'Ny fangatahako',
    quotes: 'Vidiny',
    bookings: 'Fotoana',
    noRequests: 'Tsy misy fangatahana aloha',
    describeProblem: 'Lazao ny olana na ny ilainao…',
    phone: 'Telefaona',
    slot: 'Daty sy ora tianao (oh : 02/08 amin’ny 14h)',
    notes: 'Fanamarihana (tsy voatery)',
    pending: 'Miandry',
    answered: 'Voavaly',
    accepted: 'Nekena',
    declined: 'Nolavina',
    writeMessage: 'Manorata hafatra…',
    offline: 'Tsy misy tambajotra — angona voatahiry',
    language: 'Fiteny',
  },
} as const;

export type TKey = keyof (typeof STRINGS)['fr'];

type I18nValue = {
  lang: Lang;
  t: (key: TKey) => string;
  setLang: (lang: Lang) => void;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('fr');

  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY).then((saved) => {
      if (saved === 'mg' || saved === 'fr') setLangState(saved);
    });
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem(LANG_KEY, l);
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      setLang,
      t: (key) => STRINGS[lang][key] ?? STRINGS.fr[key],
    }),
    [lang, setLang]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n hors I18nProvider');
  return ctx;
}
