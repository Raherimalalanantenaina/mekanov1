import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useI18n } from './i18n';
import { mdiCrosshairsGps } from '@mdi/js';
import { MdiIcon } from './CategoryIcon';

type Props = {
  latitude: number;
  longitude: number;
  onChange: (latitude: number, longitude: number) => void;
};

type SearchResult = { display_name: string; lat: string; lon: string };

const pinIcon = L.divIcon({
  className: 'map-pin',
  html: '<div class="map-pin-head"></div>',
  iconSize: [30, 42],
  iconAnchor: [15, 42],
});

/** Carte OpenStreetMap : clic ou glisser l'épingle pour placer le garage. */
export function MapPicker({ latitude, longitude, onChange }: Props) {
  const { t } = useI18n();
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!container.current || map.current) return;
    const m = L.map(container.current).setView([latitude, longitude], 16);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      subdomains: 'abcd',
      attribution: '© OpenStreetMap © CARTO',
    }).addTo(m);
    const mk = L.marker([latitude, longitude], { draggable: true, icon: pinIcon }).addTo(m);
    mk.on('dragend', () => {
      const p = mk.getLatLng();
      onChangeRef.current(p.lat, p.lng);
    });
    m.on('click', (e: L.LeafletMouseEvent) => {
      mk.setLatLng(e.latlng);
      onChangeRef.current(e.latlng.lat, e.latlng.lng);
    });
    map.current = m;
    marker.current = mk;
    // La carte est créée dans une modale : recalcul de la taille après affichage
    setTimeout(() => m.invalidateSize(), 150);
    return () => {
      m.remove();
      map.current = null;
      marker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !marker.current) return;
    const current = marker.current.getLatLng();
    if (current.lat === latitude && current.lng === longitude) return;
    marker.current.setLatLng([latitude, longitude]);
    map.current?.panTo([latitude, longitude]);
  }, [latitude, longitude]);

  const moveTo = (lat: number, lng: number) => {
    marker.current?.setLatLng([lat, lng]);
    map.current?.setView([lat, lng], 17);
    onChange(lat, lng);
  };

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=mg&q=${encodeURIComponent(query)}`,
        { headers: { 'Accept-Language': 'fr' } }
      );
      setResults(await res.json());
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="map-picker">
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <input
          placeholder={t('searchAddress')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              search();
            }
          }}
        />
        <button type="button" className="btn btn-sm" disabled={searching} onClick={search}>
          {searching ? '…' : t('searchBtn')}
        </button>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() =>
            navigator.geolocation?.getCurrentPosition((p) => moveTo(p.coords.latitude, p.coords.longitude))
          }
        >
          <MdiIcon path={mdiCrosshairsGps} size={15} /> {t('myPosition')}
        </button>
      </div>
      {results.length > 0 && (
        <div className="map-results">
          {results.map((r) => (
            <button
              type="button"
              key={`${r.lat},${r.lon}`}
              onClick={() => {
                moveTo(Number(r.lat), Number(r.lon));
                setResults([]);
              }}
            >
              {r.display_name}
            </button>
          ))}
        </div>
      )}
      <div ref={container} className="map-box" />
      <div className="field-hint">{t('mapHint')}</div>
    </div>
  );
}
