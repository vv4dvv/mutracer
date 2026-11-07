import { useRef, useState } from 'react';
import { FileUp, ImagePlus, MousePointerClick, RotateCcw, X } from 'lucide-react';
import { setUi, showToast, useViewer, type SelectedMaterial } from '../../store';
import { MATERIALX_IMPORT, getEngine } from '../../engine/ViewerEngine';
import { thumbnailUrl } from '../../engine/presets';
import {
  MATERIAL_GROUPS, MATERIAL_PRESET_CATEGORIES, MATERIAL_PRESETS, TEXTURE_SLOTS, hexToLinear, linearToHex,
  type MaterialGroup, type MaterialPresetCategory, type MaterialParam, type MaterialValues, type TextureKey
} from '../../engine/materialParams';
import { ColorField, Hint, NumberField, Scrub, Section, Segmented, Select, Switch } from '../ui/controls';
import { PolyHavenLogo } from '../PolyHavenLogo';
import { toPathedFiles } from '../../engine/droppedFiles';
import { useT } from '../../i18n';

// Kept across material selections.
let lastPresetCategory: MaterialPresetCategory = 'basic';

export function MaterialPanel() {
  const material = useViewer((s) => s.material);
  const [presetCategory, setPresetCategory] = useState(lastPresetCategory);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const browsing = useViewer((s) => s.ui.textureBrowser);
  const webgl = useViewer((s) => s.backend?.name === 'WebGL 2');
  const t = useT();

  if (!material) {
    return (
      <div className="empty-panel">
        <MousePointerClick size={22} />
        <strong>{t('No material selected')}</strong>
        <span>{t('Click an object in the viewport or pick a material in the scene tree.')}</span>
      </div>
    );
  }

  const set = (values: MaterialValues, label: string, mergeKey?: string) =>
    getEngine()?.setMaterialValues(material.id, values, label, mergeKey);
  const textures = new Set(material.textures);
  const base = material.values.baseColor as [number, number, number];
  const isOpen = (group: MaterialGroup) => {
    if (openGroups[group.id] !== undefined) return openGroups[group.id];
    if (group.id === 'displacement') return true;
    if (!group.weight) return group.id !== 'advanced';
    return Number(material.values[group.weight]) > 0;
  };

  return (
    <>
      <div className="mat-card">
        <i className="mat-ball" style={{ '--c': linearToHex(base) } as React.CSSProperties} />
        <div>
          <strong>{material.name}</strong>
          <small>{material.meshName || t('Mesh')}{material.users > 1 ? ` · ${t('shared by {count} meshes', { count: material.users })}` : ''}</small>
        </div>
        <button className="icon-btn sm" title={t('Reset to loaded values')} aria-label={t('Reset material')} onClick={() => getEngine()?.resetMaterial(material.id)}>
          <RotateCcw size={13} />
        </button>
      </div>
      <div className="mat-presets">
        <Segmented label={t('Preset category')} value={presetCategory}
          options={MATERIAL_PRESET_CATEGORIES.map((category) => ({ value: category.value, label: t(category.label) }))}
          onChange={(v) => { lastPresetCategory = v; setPresetCategory(v); }} />
        <div className="preset-grid" aria-label={t('Material presets')}>
          {MATERIAL_PRESETS.filter((preset) => preset.category === presetCategory).map((preset) => (
            <button key={preset.id} className="preset" title={t('Apply {name}', { name: t(preset.label) })} onClick={() => set(preset.values, `${preset.label} preset`)}>
              <img src={thumbnailUrl(`material-${preset.id}`)} alt="" /><span>{t(preset.label)}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="tex-browse hide-m">
        <button className="btn btn--wide" aria-pressed={browsing} data-on={browsing || undefined}
          onClick={() => setUi({ textureBrowser: !browsing })}>
          <PolyHavenLogo />{browsing ? t('Hide Poly Haven textures') : t('Browse Poly Haven textures')}
        </button>
        {MATERIALX_IMPORT && <MaterialXImport materialId={material.id} />}
      </div>
      {MATERIAL_GROUPS.map((group) => {
        const weight = group.weight ? Number(material.values[group.weight]) : undefined;
        return (
          <Section
            key={group.id}
            title={t(group.label)}
            value={weight !== undefined ? formatWeight(weight) : undefined}
            open={isOpen(group)}
            onOpenChange={(open) => setOpenGroups((g) => ({ ...g, [group.id]: open }))}
          >
            {group.params.map((param) => (
              <ParamControl key={param.key} param={param.key === 'displacementScale'
                ? { ...param, ...material.displacementRange } : param.key === 'displacementBias'
                  ? { ...param, ...material.displacementRange, min: -material.displacementRange.max } : param} values={material.values} textures={textures}
                disabled={group.id === 'displacement' && webgl}
                onChange={(values) => set(values, paramLabel(group, param), `${material.id}:${param.key}`)} />
            ))}
            {group.id === 'displacement' && <Hint>{webgl ? t('Displacement requires WebGPU.') :
              t('Offset = texture × Scale + Bias, in mesh-local units. Sliders follow object size. Use the numeric inputs to enter any value. A displacement texture is required.')}</Hint>}
          </Section>
        );
      })}
      <Section
        title={t('Textures')}
        value={String(Object.keys(material.maps).length)}
        open={openGroups.textures ?? Object.keys(material.maps).length > 0}
        onOpenChange={(open) => setOpenGroups((g) => ({ ...g, textures: open }))}
      >
        <TextureSlots material={material} />
      </Section>
      {material.textures.length > 0 && <Hint>{t('Values marked with a texture swatch multiply the texture.')}</Hint>}
    </>
  );
}

/** Picks a MaterialX .zip, or a .mtlx with its textures; folders can be dropped on the viewport. */
function MaterialXImport({ materialId }: { materialId: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const t = useT();
  return (
    <>
      <button className="btn btn--wide" disabled={busy} title={t('A .zip package, or a .mtlx with its texture images. Folders can be dropped on the viewport.')}
        onClick={() => input.current?.click()}>
        <FileUp size={14} />{busy ? t('Importing MaterialX…') : t('Import MaterialX')}
      </button>
      <input ref={input} type="file" hidden multiple accept=".mtlx,.zip,image/png,image/jpeg,image/webp,image/avif"
        onChange={async (e) => {
          const files = toPathedFiles(e.currentTarget.files ?? []);
          e.currentTarget.value = '';
          if (!files.length) return;
          setBusy(true);
          await getEngine()?.importMaterialX(materialId, files);
          setBusy(false);
        }} />
    </>
  );
}

function ParamControl({
  param, values, textures, onChange, disabled
}: {
  param: MaterialParam;
  values: MaterialValues;
  textures: Set<string>;
  onChange: (values: MaterialValues) => void;
  disabled?: boolean;
}) {
  const t = useT();
  const label = t(param.label);
  const badge = 'texture' in param && param.texture && textures.has(param.texture)
    ? <i className="tex" title={t('Multiplied by a texture')} /> : null;
  if (param.kind === 'color') {
    const value = values[param.key] as [number, number, number];
    return <ColorField label={label} badge={badge} value={linearToHex(value)} onChange={(hex) => onChange({ [param.key]: hexToLinear(hex) })} />;
  }
  if (param.kind === 'boolean') {
    return (
      <Switch label={label} checked={Boolean(values[param.key])} onChange={(v) => onChange({ [param.key]: v })}>
        <span className="field-label">{label}</span>
      </Switch>
    );
  }
  return (
    <Scrub
      label={<>{label}{badge}</>}
      title={param.key === 'displacementScale' || param.key === 'displacementBias' ? param.key : label}
      value={Number(values[param.key])}
      min={param.min}
      max={param.max}
      step={param.step}
      unit={param.unit}
      format={param.key === 'displacementScale' || param.key === 'displacementBias' ? (value) => Number(value.toPrecision(6)).toString() : undefined}
      disabled={disabled}
      onChange={(v) => onChange({ [param.key]: v })}
    />
  );
}

function TextureSlots({ material }: { material: SelectedMaterial }) {
  const webgl = useViewer((s) => s.backend?.name === 'WebGL 2');
  const input = useRef<HTMLInputElement>(null);
  const target = useRef<TextureKey | null>(null);
  const [dropTarget, setDropTarget] = useState<TextureKey | null>(null);
  const t = useT();
  const wraps = [
    {value:'repeat' as const,label:t('Repeat')},
    {value:'clamp-to-edge' as const,label:t('Clamp to edge')},
    {value:'mirrored-repeat' as const,label:t('Mirrored repeat')}
  ];
  const label = (slot: TextureKey) => TEXTURE_SLOTS.find((s) => s.key === slot)!.label;
  const upload = (slot: TextureKey, file: File | undefined) => {
    if (slot === 'displacementMap' && webgl) return;
    if (!file) return;
    if (!file.type.startsWith('image/')) return showToast(t('{name} is not an image', { name: file.name }), 'error');
    void getEngine()?.setMaterialTexture(material.id, slot, file, `${label(slot)} texture`);
  };
  return (
    <div className="tex-slots">
      {TEXTURE_SLOTS.map(({ key, label, hint }) => {
        const thumb = material.maps[key];
        const has = thumb !== undefined;
        const sampling = material.sampling[key];
        const disabled = key === 'displacementMap' && webgl;
        const slotLabel = t(label);
        return (
          <div
            key={key}
            className="tex-slot"
            data-on={has || undefined}
            data-drop={dropTarget === key || undefined}
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes('Files')) return;
              e.preventDefault();
              e.stopPropagation();
              setDropTarget(key);
            }}
            onDragLeave={() => setDropTarget((current) => (current === key ? null : current))}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDropTarget(null);
              upload(key, e.dataTransfer.files[0]);
            }}
          >
            <button className="tex-slot__thumb" title={has ? t('Replace {name} texture', { name: slotLabel }) : t('Upload {name} texture', { name: slotLabel })}
              disabled={key === 'displacementMap' && webgl}
              aria-label={has ? t('Replace {name} texture', { name: slotLabel }) : t('Upload {name} texture', { name: slotLabel })}
              onClick={() => { target.current = key; input.current?.click(); }}>
              {thumb ? <img src={thumb} alt="" /> : has ? <i className="tex" /> : <ImagePlus size={14} />}
            </button>
            <span className="tex-slot__label"><b>{slotLabel}</b><small>{t(hint)}</small></span>
            {has && (
              <button className="icon-btn icon-btn--bare xs" title={t('Remove {name} texture', { name: slotLabel })} aria-label={t('Remove {name} texture', { name: slotLabel })}
                onClick={() => void getEngine()?.setMaterialTexture(material.id, key, null, `Remove ${label.toLowerCase()} texture`)}>
                <X size={12} />
              </button>
            )}
            {sampling && <details className="tex-slot__settings">
              <summary>{t('Wrap & repeat')}</summary>
              <div role="group" aria-label={t('{name} texture sampling', { name: slotLabel })}>
                <div className="tex-slot__wrap">
                  <div className="tex-slot__wrap-axis">
                    <span className="field-label">{t('Wrap S')}</span>
                    <Select label={t('{name} wrap S', { name: slotLabel })} value={sampling.wrapS} options={wraps} disabled={disabled}
                      onChange={wrapS => getEngine()?.setMaterialTextureSampling(material.id,key,{wrapS},`${label} wrap S`)} />
                  </div>
                  <div className="tex-slot__wrap-axis">
                    <span className="field-label">{t('Wrap T')}</span>
                    <Select label={t('{name} wrap T', { name: slotLabel })} value={sampling.wrapT} options={wraps} disabled={disabled}
                      onChange={wrapT => getEngine()?.setMaterialTextureSampling(material.id,key,{wrapT},`${label} wrap T`)} />
                  </div>
                </div>
                <div className="tex-slot__repeat">
                  {[0,1].map(axis => <NumberField key={axis} label={t('Repeat {axis}', { axis: axis === 0 ? 'S' : 'T' })} value={sampling.uvScale[axis]} step={.1} disabled={disabled}
                    onChange={value => {
                      const uvScale:[number,number]=[...sampling.uvScale]; uvScale[axis]=value;
                      getEngine()?.setMaterialTextureSampling(material.id,key,{uvScale},`${label} repeat ${axis===0?'S':'T'}`,`${material.id}:${key}:repeat:${axis}`);
                    }} />)}
                </div>
              </div>
            </details>}
          </div>
        );
      })}
      <input ref={input} type="file" hidden accept="image/png,image/jpeg,image/webp,image/avif"
        onChange={(e) => {
          if (target.current) upload(target.current, e.currentTarget.files?.[0]);
          e.currentTarget.value = '';
        }} />
      <Hint>{t('Drop an image on a slot to replace its texture. Edits are kept for this model until another model is opened.')}</Hint>
    </div>
  );
}

const paramLabel = (group: MaterialGroup, param: MaterialParam) =>
  group.id === 'base' || group.id === 'advanced' ? param.label : `${group.label} ${param.label.toLowerCase()}`;

const formatWeight = (w: number) => (w === 0 ? '0' : w.toFixed(2));
