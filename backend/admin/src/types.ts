export type Subtype = { id: string; label: string; labelMg: string; active: boolean };

export type Category = {
  id: string;
  emoji: string;
  label: string;
  labelMg: string;
  keywords: string[];
  active: boolean;
  subtypes: Subtype[];
};

export type LocalizedText = { fr: string; mg: string };
export type FieldRule = { visible: boolean; required: boolean };

export const FORM_FIELDS = [
  'phone',
  'city',
  'description',
  'hours',
  'promo',
  'prices',
  'photos',
  'mobileService',
] as const;
export type FormField = (typeof FORM_FIELDS)[number];

export const FEATURES = ['quotes', 'appointments', 'reviews', 'sos', 'whatsapp', 'share'] as const;
export type Feature = (typeof FEATURES)[number];

export type AppConfig = {
  appName: string;
  colors: { primary: string; accent: string };
  texts: {
    heroTitle1: LocalizedText;
    heroTitle2: LocalizedText;
    searchPlaceholder: LocalizedText;
  };
  features: Record<Feature, boolean>;
  garageForm: {
    maxPhotos: number;
    minCategories: number;
    fields: Record<FormField, FieldRule>;
  };
  approval: { accounts: boolean; garages: boolean };
  support: { phone: string; email: string };
};

export type GarageStatus = 'pending' | 'approved' | 'hidden';
export type UserStatus = 'pending' | 'approved' | 'suspended';

export type GarageListItem = {
  id: string;
  ownerId: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  categories: string[];
  services: string[];
  status: GarageStatus;
  isOpen: boolean;
  views: number;
  calls: number;
  createdAt: string;
  photoCount: number;
  ownerEmail: string;
  ownerName: string;
  ownerStatus: UserStatus;
  rating: number | null;
};

export type PriceItem = { service: string; price: string };

export type GarageDetail = {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  address: string;
  city: string;
  phone: string;
  latitude: number;
  longitude: number;
  categories: string[];
  services: string[];
  photos: string[];
  mobileService: boolean;
  promo: string;
  priceList: PriceItem[];
  openingHours: string;
  isOpen: boolean;
  status: GarageStatus;
  ownerEmail?: string;
  ownerName?: string;
};

export type UserItem = {
  id: string;
  email: string;
  fullName: string;
  status: UserStatus;
  createdAt: string;
  garageId: string | null;
  garageName: string | null;
  garageStatus: GarageStatus | null;
};

export type Stats = {
  totals: Record<string, number>;
  daily: { day: string; views: number; calls: number; searches: number }[];
  top: { id: string; name: string; city: string; views: number; calls: number }[];
  byCategory: { id: string; count: number }[];
};

export type Review = {
  id: string;
  authorName: string;
  rating: number;
  comment: string;
  createdAt: string;
  garageId: string;
  garageName: string;
};

export type Quote = {
  id: string;
  clientName: string;
  clientPhone: string;
  description: string;
  status: string;
  createdAt: string;
  garageId: string;
  garageName: string;
  messageCount: number;
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
  clientName: string;
  clientPhone: string;
  slot: string;
  note: string;
  status: string;
  createdAt: string;
  garageId: string;
  garageName: string;
};
