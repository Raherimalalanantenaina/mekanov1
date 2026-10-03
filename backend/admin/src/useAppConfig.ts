import { useEffect, useState } from 'react';
import { api } from './api';
import type { AppConfig } from './types';
import { useAction } from './ui';

/** Charge la config de l'app et l'enregistre (PUT /config renvoie la version validée). */
export function useAppConfig() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const { run, busy } = useAction();

  useEffect(() => {
    api<{ config: AppConfig; logoUrl: string | null }>('/config').then((res) => {
      setConfig(res.config);
      setLogoUrl(res.logoUrl);
    });
  }, []);

  const save = (next: AppConfig) =>
    run(async () => {
      const res = await api<{ config: AppConfig }>('/config', { method: 'PUT', body: next });
      setConfig(res.config);
    });

  return { config, setConfig, logoUrl, setLogoUrl, save, busy, run };
}
