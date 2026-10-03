import {
  mdiCar,
  mdiCarBattery,
  mdiCarBrakeAlert,
  mdiCarCog,
  mdiCarDoor,
  mdiCarWash,
  mdiCarWindshield,
  mdiCarWrench,
  mdiCog,
  mdiEngine,
  mdiGarage,
  mdiKeyVariant,
  mdiLightningBolt,
  mdiMotorbike,
  mdiOil,
  mdiSnowflake,
  mdiSpray,
  mdiTire,
  mdiTools,
  mdiTowTruck,
  mdiWrench,
} from '@mdi/js';

/** Mêmes noms que l'app mobile (MaterialCommunityIcons) et la liste du serveur. */
export const CATEGORY_ICONS: { name: string; path: string; label: string }[] = [
  { name: 'wrench', path: mdiWrench, label: 'Clé (mécanique)' },
  { name: 'car-wrench', path: mdiCarWrench, label: 'Voiture + clé' },
  { name: 'tools', path: mdiTools, label: 'Outils' },
  { name: 'tire', path: mdiTire, label: 'Pneu' },
  { name: 'car-battery', path: mdiCarBattery, label: 'Batterie' },
  { name: 'lightning-bolt', path: mdiLightningBolt, label: 'Électricité' },
  { name: 'spray', path: mdiSpray, label: 'Peinture' },
  { name: 'car-door', path: mdiCarDoor, label: 'Carrosserie' },
  { name: 'snowflake', path: mdiSnowflake, label: 'Climatisation' },
  { name: 'motorbike', path: mdiMotorbike, label: 'Moto' },
  { name: 'car-wash', path: mdiCarWash, label: 'Lavage' },
  { name: 'car-cog', path: mdiCarCog, label: 'Diagnostic' },
  { name: 'car-windshield', path: mdiCarWindshield, label: 'Pare-brise' },
  { name: 'key-variant', path: mdiKeyVariant, label: 'Clés / serrurerie' },
  { name: 'cog', path: mdiCog, label: 'Pièces' },
  { name: 'tow-truck', path: mdiTowTruck, label: 'Dépanneuse' },
  { name: 'oil', path: mdiOil, label: 'Huile / vidange' },
  { name: 'engine', path: mdiEngine, label: 'Moteur' },
  { name: 'car-brake-alert', path: mdiCarBrakeAlert, label: 'Freins' },
  { name: 'garage', path: mdiGarage, label: 'Garage' },
  { name: 'car', path: mdiCar, label: 'Voiture' },
];

export function MdiIcon({ path, size = 16 }: { path: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ verticalAlign: 'middle', flexShrink: 0 }} aria-hidden>
      <path d={path} fill="currentColor" />
    </svg>
  );
}

export function CategoryIcon({ name, size = 18 }: { name?: string; size?: number }) {
  const icon = CATEGORY_ICONS.find((i) => i.name === name) ?? CATEGORY_ICONS[0];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ verticalAlign: 'middle', flexShrink: 0 }} aria-hidden>
      <path d={icon.path} fill="currentColor" />
    </svg>
  );
}
