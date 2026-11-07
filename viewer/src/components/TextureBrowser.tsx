import { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { setUi, useViewer } from '../store';
import { getEngine } from '../engine/ViewerEngine';
import {
  TEXTURE_RESOLUTIONS, filterTextures, listPolyHavenTextures, polyHavenMaps, polyHavenThumbnail, topCategories,
  type PolyHavenTexture, type TextureResolution
} from '../engine/polyHaven';
import { Segmented, Switch } from './ui/controls';
import { PolyHavenLogo } from './PolyHavenLogo';
import { useT } from '../i18n';

const PAGE = 48;
const formatMB = (bytes: number) => (bytes / 1048576).toFixed(1);

// Kept for the session so the panel reopens where it was.
let lastResolution: TextureResolution = '1k';
let lastDisplacement = false;
let lastQuery = '';
let lastCategory: string | null = null;
/** The set last applied to each material, to mark it in the grid. */
const appliedSets = new Map<string, string>();
/** The pick in flight. It outlives the panel, so a set finishes on its material when the panel closes. */
let current: { materialId: string; id: string; controller: AbortController } | null = null;
let progress: { loaded: number; total: number } = { loaded: 0, total: 0 };
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/**
 * Poly Haven texture sets, docked beside the inspector. A click applies the
 * set to the selected material and keeps the panel open, so sets can be
 * compared one after another. Maps apply as they arrive, and a new click
 * cancels the download in flight.
 */
export function TextureBrowser() {
  const material = useViewer((s) => s.material);
  const [textures, setTextures] = useState<PolyHavenTexture[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState(lastQuery);
  const [category, setCategory] = useState(lastCategory);
  const [resolution, setResolution] = useState(lastResolution);
  const [displacement, setDisplacement] = useState(lastDisplacement);
  const webgpu = useViewer((s) => s.backend?.name === 'WebGPU');
  const [limit, setLimit] = useState(PAGE);
  const [, rerender] = useState(0);
  const materialId = material?.id;
  const t = useT();

  useEffect(() => {
    if (textures) return;
    let cancelled = false;
    listPolyHavenTextures().then(
      (list) => { if (!cancelled) setTextures(list); },
      (e: Error) => { if (!cancelled) setError(e.message); }
    );
    return () => { cancelled = true; };
  }, [textures]);

  useEffect(() => {
    const listener = () => rerender((n) => n + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  useEffect(() => {
    lastQuery = query;
    lastCategory = category;
    setLimit(PAGE);
  }, [query, category]);

  const categories = useMemo(() => (textures ? topCategories(textures, 12) : []), [textures]);
  const shown = useMemo(() => (textures ? filterTextures(textures, query, category) : []), [textures, query, category]);

  const loading = current && current.materialId === materialId ? { id: current.id, ...progress } : null;
  const applied = materialId ? appliedSets.get(materialId) : undefined;

  const apply = async (texture: PolyHavenTexture) => {
    if (!materialId) return;
    current?.controller.abort();
    const pick = { materialId, id: texture.id, controller: new AbortController() };
    current = pick;
    progress = { loaded: 0, total: 0 };
    notify();
    const { signal } = pick.controller;
    const ok = await getEngine()?.applyPolyHavenTexture(materialId, texture.id, texture.name, resolution, (loaded, total) => {
      if (signal.aborted) return;
      progress = { loaded, total };
      notify();
    }, signal, displacement && webgpu);
    if (signal.aborted) return;
    current = null;
    if (ok) appliedSets.set(materialId, texture.id);
    notify();
  };

  return (
    <section className="panel tex-browser" aria-label={t('Poly Haven textures')}>
      <div className="insp-head">
        <a className="badge" href="https://polyhaven.com" target="_blank" rel="noreferrer" title="Poly Haven" aria-label={t('Poly Haven website')}>
          <PolyHavenLogo size={18} />
        </a>
        <div className="copy">
          <strong>{t('Poly Haven textures')}</strong>
          <small>{material ? t('Click to apply to {name}', { name: material.name }) : t('Select a material to apply textures')}</small>
        </div>
        <button className="icon-btn icon-btn--bare sm" aria-label={t('Close textures')} title={t('Close')}
          onClick={() => setUi({ textureBrowser: false })}><X size={14} /></button>
      </div>
      <div className="tex-browser__filters">
        <label className="search">
          <Search size={13} />
          <input placeholder={t('Search wood, brick, fabric…')} value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
          {query && <button className="icon-btn icon-btn--bare xs" aria-label={t('Clear search')} onClick={() => setQuery('')}><X size={12} /></button>}
        </label>
        <Segmented
          label={t('Texture resolution')}
          value={resolution}
          options={TEXTURE_RESOLUTIONS.map((r) => ({ value: r.value, label: <span title={r.size}>{r.label}</span> }))}
          onChange={(v) => { lastResolution = v; setResolution(v); }}
        />
        <Switch label={t('Download displacement map')} checked={displacement && webgpu} disabled={!webgpu}
          onChange={(v) => { lastDisplacement = v; setDisplacement(v); }}>
          <span className="field-label">{t('Download displacement map')}</span>
        </Switch>
        {categories.length > 0 && (
          <div className="ph-cats" role="radiogroup" aria-label={t('Category')}>
            {[null, ...categories].map((c) => (
              <button key={c ?? 'all'} role="radio" aria-checked={category === c} data-on={category === c || undefined}
                onClick={() => setCategory(c)}>{c ?? t('All')}</button>
            ))}
          </div>
        )}
      </div>
      <div className="ph-grid" onScroll={(e) => {
        const el = e.currentTarget;
        if (el.scrollTop + el.clientHeight > el.scrollHeight - 300 && limit < shown.length) setLimit((l) => l + PAGE);
      }}>
        {error && <div className="ph-empty">{t('Could not reach Poly Haven: {error}', { error })}
          {' '}<button className="hint__link" onClick={() => { setError(null); setTextures(null); }}>{t('Retry')}</button></div>}
        {!error && !textures && <div className="ph-empty">{t('Loading the catalog…')}</div>}
        {textures && shown.length === 0 && <div className="ph-empty">{t('No matching textures')}</div>}
        {shown.slice(0, limit).map((texture) => {
          const busy = loading?.id === texture.id;
          const fraction = busy && loading.total ? loading.loaded / loading.total : 0;
          return (
            <button key={texture.id} className="ph-card" title={texture.name} disabled={!material}
              data-busy={busy || undefined} data-on={applied === texture.id || undefined} aria-pressed={applied === texture.id}
              onPointerEnter={() => void polyHavenMaps(texture.id, resolution).catch(() => {})}
              onClick={() => void apply(texture)}>
              <img src={polyHavenThumbnail(texture.id)} alt="" loading="lazy" />
              <span>{busy ? `${formatMB(loading.loaded)}${loading.total ? ` / ${formatMB(loading.total)}` : ''} MB` : texture.name}</span>
              {busy && <i className="ph-card__bar" style={{ width: `${Math.max(4, fraction * 100)}%` }} />}
            </button>
          );
        })}
      </div>
    </section>
  );
}
