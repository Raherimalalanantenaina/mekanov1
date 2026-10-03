import React from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import { fetchMyAppointments } from '../api/client';
import { useAppConfig } from '../appConfig';
import { useI18n } from '../i18n';
import { useSync } from '../sync';
import type { RootStackParamList } from '../navigation/types';
import type { Appointment } from '../types';
import { notify } from './Notifier';

const ASKED_KEY = 'mekano-review-asked';
/** Délai après l'heure du rendez-vous avant de demander un avis */
const AFTER_MS = 2 * 60 * 60 * 1000;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** Créneau enregistré au format « 03/10/2026 à 09:00 ». */
export function parseSlot(slot: string): Date | null {
  const m = slot.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\D+(\d{1,2})[:h](\d{2})/);
  if (!m) return null;
  const [, d, mo, y, h, mi] = m.map(Number);
  const date = new Date(y, mo - 1, d, h, mi);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function readAsked(): Promise<string[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(ASKED_KEY)) ?? '[]');
  } catch {
    return [];
  }
}

/**
 * Après un rendez-vous accepté dont l'heure est passée, propose une fois
 * au client de laisser un avis sur le garage.
 */
export function ReviewPrompter({
  navigation,
}: {
  navigation: NavigationContainerRefWithCurrent<RootStackParamList>;
}) {
  const { t } = useI18n();
  const { config } = useAppConfig();
  const enabled = config.features.reviews && config.features.appointments;
  const busy = React.useRef(false);

  const check = React.useCallback(async () => {
    if (!enabled || busy.current || !navigation.isReady()) return;
    busy.current = true;
    try {
      const [appts, asked] = await Promise.all([fetchMyAppointments(), readAsked()]);
      const now = Date.now();
      const due = appts.find((a: Appointment) => {
        if (a.status !== 'accepted' || asked.includes(a.id)) return false;
        const at = parseSlot(a.slot)?.getTime();
        return at != null && now - at > AFTER_MS && now - at < MAX_AGE_MS;
      });
      if (!due) return;
      await AsyncStorage.setItem(ASKED_KEY, JSON.stringify([...asked, due.id].slice(-200)));
      notify.alert(
        t('reviewAskTitle'),
        t('reviewAskText', { name: due.garageName ?? 'le garage' }),
        [
          { text: t('reviewAskLater'), style: 'cancel' },
          {
            text: t('reviewAskYes'),
            onPress: () =>
              navigation.navigate('GarageDetail', {
                id: due.garageId,
                review: true,
                reviewName: due.clientName,
              }),
          },
        ],
        { kind: 'info', icon: 'star' }
      );
    } catch {
      /* hors ligne : on réessaiera plus tard */
    } finally {
      busy.current = false;
    }
  }, [enabled, navigation, t]);

  React.useEffect(() => {
    const first = setTimeout(check, 5000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check();
    });
    return () => {
      clearTimeout(first);
      sub.remove();
    };
  }, [check]);

  useSync(['client'], () => {
    check();
  });

  return null;
}
