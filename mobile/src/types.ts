export type PriceItem = { service: string; price: string };

/** Horaires d'une journée (lundi = index 0). */
export type DayHours = { open: string; close: string; closed: boolean };

/** Statistique journalière d'un garage. */
export type DailyStat = {
  day: string;
  views: number;
  calls: number;
  searches: number;
};

export type Garage = {
  id: string;
  ownerId?: string;
  name: string;
  description: string;
  address: string;
  city: string;
  phone: string;
  latitude: number;
  longitude: number;
  services: string[];
  photos: string[];
  mobileService: boolean;
  promo: string;
  priceList: PriceItem[];
  views: number;
  calls: number;
  openingHours: string;
  /** Horaires structurés par jour (lundi = index 0), null si non renseignés */
  hoursJson?: DayHours[] | null;
  isOpen: boolean;
  /** 'pending' = en attente de validation par l'administrateur */
  status?: 'pending' | 'approved';
  updatedAt?: string;
  createdAt?: string;
  distanceKm?: number;
  rating: number | null;
  reviewCount: number;
};

export type Review = {
  id: string;
  authorName: string;
  rating: number;
  comment: string;
  createdAt: string;
};

export type Quote = {
  id: string;
  garageId: string;
  garageName?: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  description: string;
  photo: string;
  status: 'pending' | 'answered' | 'closed';
  createdAt: string;
  messageCount: number;
  lastMessageAt: string | null;
};

export type QuoteMessage = {
  id: string;
  sender: 'client' | 'garage';
  body: string;
  photo: string;
  createdAt: string;
};

export type Appointment = {
  id: string;
  garageId: string;
  garageName?: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  slot: string;
  note: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
};

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  role: 'garage';
  /** 'pending' = compte en attente de validation par l'administrateur */
  status?: 'pending' | 'approved';
};

export type GaragesResponse = {
  syncedAt: string;
  offline: boolean;
  garages: Garage[];
};
