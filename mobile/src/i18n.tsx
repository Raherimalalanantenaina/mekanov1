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
    // Commun
    error: 'Erreur',
    fail: 'Échec',
    requiredFields: 'Champs requis',
    cancel: 'Annuler',
    delete: 'Supprimer',
    offlineTitle: 'Hors ligne',
    loading: 'Chargement…',
    sending: 'Envoi…',
    // Carte
    garagesCount: '{n} garage(s)',
    garagesWithin: '{n} garage(s) à moins de {km} km',
    allRadius: 'Tous',
    noGarageFor: 'Aucun garage pour « {q} »',
    noGarageWithin: 'Aucun garage à moins de {km} km — élargis le rayon',
    // Itinéraire
    towards: 'Vers {name}',
    routeSummary: '{km} km · {min} min en voiture',
    straightLineNote: '(estimation à vol d’oiseau)',
    calculatingRoute: 'Calcul de l’itinéraire…',
    routeError: 'Impossible de calculer l’itinéraire pour le moment.',
    locationNeeded: 'Autorise la localisation pour tracer l’itinéraire.',
    // Accueil
    noGarageFound: 'Aucun garage trouvé',
    // Fiche garage
    nameRequired: 'Nom requis',
    thanks: 'Merci',
    reviewPublished: 'Ton avis a été publié.',
    nameDescRequired: 'Nom et description sont obligatoires.',
    sent: 'Envoyé',
    quoteSent: 'Le garage a reçu ta demande de devis.',
    yourNameRequired: 'Ton nom est obligatoire.',
    bookingSent: 'Demande de rendez-vous transmise au garage.',
    noReviews: 'Aucun avis pour l’instant',
    noReviewsShort: 'Aucun avis',
    notProvided: 'Non renseignés',
    photoAdded: 'Photo ajoutée',
    addPhoto: 'Ajouter une photo',
    // Chat
    photoReady: 'Photo prête à envoyer',
    // Boîte de réception garage
    inboxTitle: 'Boîte de réception',
    replyToClient: 'Répondre au client…',
    noQuoteRequests: 'Aucune demande de devis',
    noAppointments: 'Aucun rendez-vous',
    accept: 'Accepter',
    decline: 'Refuser',
    inboxLoginHint: 'Connecte-toi pour voir les devis et rendez-vous reçus.',
    // Mon garage
    myGarageTitle: 'Mon garage',
    myGarageSub: 'Un compte = un garage · publie et gère ta fiche',
    reservedTitle: 'Espace réservé',
    reservedText:
      'Connecte-toi dans l’onglet Garage pour publier et gérer tes fiches.',
    limit: 'Limite',
    maxPhotos: 'Maximum {n} photos.',
    needsConnection: 'Cette action nécessite une connexion.',
    nameAddressRequired: 'Nom et adresse sont obligatoires.',
    saved: 'Enregistré',
    sheetUpdated: 'Fiche mise à jour.',
    submittedTitle: 'Envoyé pour validation',
    submittedText:
      'Ton garage a été soumis à l’administrateur Mekano. Il sera visible par les clients dès sa validation.',
    deleteConfirm: 'Supprimer « {name} » ?',
    accountPendingTitle: 'Compte en attente de validation',
    accountPendingText:
      'Ton compte doit d’abord être validé par l’administrateur Mekano. Dès qu’il aura confirmé, tu pourras publier ton garage — reviens sur cet écran pour vérifier.',
    yourSheetTitle: 'Ta fiche garage',
    yourSheetText:
      'Un seul garage par compte. Touche ta fiche ci-dessous pour modifier son nom, ses services, ses photos ou ses tarifs.',
    editPrefix: 'Modifier',
    publishMyGarage: 'Publier mon garage',
    garageName: 'Nom du garage',
    city: 'Ville',
    description: 'Description du garage',
    hoursPlaceholder: 'Horaires (ex : Lun–Sam 8h–18h)',
    servicesSelected: 'Services proposés ({n} sélectionnés)',
    promoPlaceholder: 'Promo (ex : -20% vidange cette semaine)',
    pricesPlaceholder: 'Prix (ex : vidange:50 000 Ar, freins:80 000 Ar)',
    photo: 'Photo',
    saveChanges: 'Enregistrer les modifications',
    deleteThisGarage: 'Supprimer ce garage',
    mySheetTouch: 'Ma fiche — touche-la pour la modifier',
    noSheetYet: 'Aucune fiche publiée pour l’instant',
    pendingNotVisible:
      'En attente de validation — pas encore visible par les clients',
    setClosed: 'Passer fermé',
    setOpen: 'Passer ouvert',
    // Compte
    appearance: 'Apparence',
    light: 'Clair',
    dark: 'Sombre',
    garageSpace: 'Espace garage',
    loginTitle: 'Connexion garage',
    registerTitle: 'Créer un compte',
    ownersOnly: 'Réservé aux propriétaires de garage',
    managerName: 'Nom du responsable',
    email: 'Email',
    password: 'Mot de passe',
    signIn: 'Se connecter',
    createAccountBtn: 'Créer le compte',
    switchToRegister: 'Pas encore de compte ? S’inscrire',
    switchToLogin: 'Déjà un compte ? Se connecter',
    logout: 'Se déconnecter',
    accountPendingPill: 'Compte en attente de validation',
    accountApprovedPill: 'Compte garage validé',
    loginNeedsNet: 'La connexion garage nécessite Internet.',
    accountCreatedTitle: 'Compte créé',
    accountCreatedText:
      'Ton compte a été envoyé à l’administrateur Mekano pour validation. Tu pourras publier ton garage dès qu’il sera validé.',
    // Itinéraire hors ligne
    cachedRouteNote: '(itinéraire enregistré)',
    // Horaires par jour
    daysShort: 'Lun,Mar,Mer,Jeu,Ven,Sam,Dim',
    hoursPerDay: 'Horaires par jour',
    closedDay: 'Fermé',
    openNowBadge: 'Ouvert',
    closedNowBadge: 'Fermé',
    // Statistiques
    statsTitle: '7 derniers jours',
    statViews: 'Vues',
    statCalls: 'Appels',
    statSearches: 'Recherches',
    // Réponses rapides (séparées par |)
    quickReplies:
      'Bonjour, comment puis-je vous aider ?|Envoyez une photo du problème svp|Oui, c’est disponible|Vous pouvez passer au garage demain matin|Le devis est prêt, je vous l’envoie',
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
    // Commun
    error: 'Nisy olana',
    fail: 'Tsy nahomby',
    requiredFields: 'Misy banga tsy voafeno',
    cancel: 'Aoka ihany',
    delete: 'Fafao',
    offlineTitle: 'Tsy misy tambajotra',
    loading: 'Miandry kely…',
    sending: 'Alefa…',
    // Carte
    garagesCount: 'Garazy {n}',
    garagesWithin: 'Garazy {n} ao anatin’ny {km} km',
    allRadius: 'Rehetra',
    noGarageFor: 'Tsy misy garazy amin’ny « {q} »',
    noGarageWithin:
      'Tsy misy garazy ao anatin’ny {km} km — halehibiazo ny faritra',
    // Itinéraire
    towards: 'Mankany {name}',
    routeSummary: '{km} km · {min} min amin’ny fiara',
    straightLineNote: '(tombana mahitsy)',
    calculatingRoute: 'Manisa ny lalana…',
    routeError: 'Tsy afaka manisa ny lalana amin’izao fotoana izao.',
    locationNeeded: 'Alefaso ny fitadiavana toerana hanaovana ny lalana.',
    // Accueil
    noGarageFound: 'Tsy nisy garazy hita',
    // Fiche garage
    nameRequired: 'Ilaina ny anarana',
    thanks: 'Misaotra',
    reviewPublished: 'Voarakitra ny hevitrao.',
    nameDescRequired: 'Ilaina ny anarana sy ny famaritana.',
    sent: 'Lasa',
    quoteSent: 'Voarain’ny garazy ny fangatahanao vidiny.',
    yourNameRequired: 'Ilaina ny anaranao.',
    bookingSent: 'Lasa any amin’ny garazy ny fangatahana fotoana.',
    noReviews: 'Mbola tsy misy hevitra',
    noReviewsShort: 'Tsy misy hevitra',
    notProvided: 'Tsy voalaza',
    photoAdded: 'Tafiditra ny sary',
    addPhoto: 'Hampiditra sary',
    // Chat
    photoReady: 'Vonona halefa ny sary',
    // Boîte de réception garage
    inboxTitle: 'Hafatra voaray',
    replyToClient: 'Valio ny mpanjifa…',
    noQuoteRequests: 'Tsy misy fangatahana vidiny',
    noAppointments: 'Tsy misy fotoana',
    accept: 'Ekena',
    decline: 'Lavina',
    inboxLoginHint:
      'Midira raha hijery ny fangatahana vidiny sy ny fotoana voaray.',
    // Mon garage
    myGarageTitle: 'Ny garaziko',
    myGarageSub: 'Kaonty iray = garazy iray · avoahy sy tantano ny fichenao',
    reservedTitle: 'Natokana ho an’ny garazy',
    reservedText:
      'Midira ao amin’ny fizarana Garazy raha hamoaka sy hitantana ny fichenao.',
    limit: 'Fetra',
    maxPhotos: 'Sary {n} no fetra.',
    needsConnection: 'Mila tambajotra ity.',
    nameAddressRequired: 'Ilaina ny anarana sy ny adiresy.',
    saved: 'Voatahiry',
    sheetUpdated: 'Voaova ny fiche.',
    submittedTitle: 'Nalefa hankatoavina',
    submittedText:
      'Nalefa any amin’ny mpandrindra Mekano ny garazinao. Ho hitan’ny mpanjifa izy rehefa voamarina.',
    deleteConfirm: 'Hofafana ve « {name} » ?',
    accountPendingTitle: 'Miandry fankatoavana ny kaonty',
    accountPendingText:
      'Tsy maintsy ankatoavin’ny mpandrindra Mekano aloha ny kaontinao. Rehefa nekeny dia afaka mamoaka ny garazinao ianao — miverena eto hijery.',
    yourSheetTitle: 'Ny fiche garazinao',
    yourSheetText:
      'Garazy iray isaky ny kaonty. Tsindrio ny fichenao etsy ambany raha hanova ny anarany, ny tolotra, ny sary na ny vidiny.',
    editPrefix: 'Ovaina',
    publishMyGarage: 'Avoahy ny garaziko',
    garageName: 'Anaran’ny garazy',
    city: 'Tanàna',
    description: 'Famaritana ny garazy',
    hoursPlaceholder: 'Ora fisokafana (oh : Alt–Sab 8h–18h)',
    servicesSelected: 'Tolotra atolotra ({n} voafidy)',
    promoPlaceholder: 'Promo (oh : -20% vidange amin’ity herinandro ity)',
    pricesPlaceholder: 'Vidiny (oh : vidange:50 000 Ar, freins:80 000 Ar)',
    photo: 'Sary',
    saveChanges: 'Tehirizo ny fanovana',
    deleteThisGarage: 'Fafao ity garazy ity',
    mySheetTouch: 'Ny ficheko — tsindrio raha hanova azy',
    noSheetYet: 'Mbola tsy misy fiche navoaka',
    pendingNotVisible:
      'Miandry fankatoavana — mbola tsy hitan’ny mpanjifa',
    setClosed: 'Ataovy mihidy',
    setOpen: 'Ataovy misokatra',
    // Compte
    appearance: 'Endrika',
    light: 'Mazava',
    dark: 'Maizina',
    garageSpace: 'Sehatry ny garazy',
    loginTitle: 'Fidirana garazy',
    registerTitle: 'Mamorona kaonty',
    ownersOnly: 'Natokana ho an’ny tompon’ny garazy',
    managerName: 'Anaran’ny tompon’andraikitra',
    email: 'Mailaka',
    password: 'Teny miafina',
    signIn: 'Hiditra',
    createAccountBtn: 'Hamorona ny kaonty',
    switchToRegister: 'Mbola tsy manana kaonty ? Misorata anarana',
    switchToLogin: 'Efa manana kaonty ? Midira',
    logout: 'Hivoaka',
    accountPendingPill: 'Miandry fankatoavana ny kaonty',
    accountApprovedPill: 'Voamarina ny kaonty garazy',
    loginNeedsNet: 'Mila Internet ny fidirana garazy.',
    accountCreatedTitle: 'Voaforona ny kaonty',
    accountCreatedText:
      'Nalefa any amin’ny mpandrindra Mekano ny kaontinao mba hankatoavina. Afaka mamoaka ny garazinao ianao rehefa voamarina izy.',
    // Itinéraire hors ligne
    cachedRouteNote: '(lalana voatahiry)',
    // Horaires par jour
    daysShort: 'Alats,Tal,Alar,Alak,Zom,Asab,Alah',
    hoursPerDay: 'Ora isan’andro',
    closedDay: 'Mihidy',
    openNowBadge: 'Misokatra',
    closedNowBadge: 'Mihidy',
    // Statistiques
    statsTitle: '7 andro farany',
    statViews: 'Fijerena',
    statCalls: 'Antso',
    statSearches: 'Fikarohana',
    // Réponses rapides (séparées par |)
    quickReplies:
      'Miarahaba, inona no azoko atao ho anao ?|Mba alefaso sary ny olana azafady|Eny, misy izany|Afaka mandalo eto amin’ny garazy ianao rahampitso maraina|Vonona ny tombam-bidy, alefako anao',
  },
} as const;

export type TKey = keyof (typeof STRINGS)['fr'];

type TParams = Record<string, string | number>;

type I18nValue = {
  lang: Lang;
  t: (key: TKey, params?: TParams) => string;
  setLang: (lang: Lang) => void;
};

function interpolate(text: string, params?: TParams): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, name) =>
    params[name] !== undefined ? String(params[name]) : m
  );
}

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
      t: (key, params) =>
        interpolate(STRINGS[lang][key] ?? STRINGS.fr[key], params),
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
