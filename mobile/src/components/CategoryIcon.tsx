import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DEFAULT_CATALOG, type ServiceCategory } from '../serviceCatalog';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

function iconName(category: Pick<ServiceCategory, 'id' | 'icon'> | undefined): IconName {
  const name = category?.icon ?? DEFAULT_CATALOG.find((c) => c.id === category?.id)?.icon;
  return name && name in MaterialCommunityIcons.glyphMap ? (name as IconName) : 'wrench';
}

/** Icône d'un type de service (repli : clé à molette). */
export function CategoryIcon({
  category,
  size = 20,
  color,
}: {
  category: Pick<ServiceCategory, 'id' | 'icon'> | undefined;
  size?: number;
  color: string;
}) {
  return <MaterialCommunityIcons name={iconName(category)} size={size} color={color} />;
}
