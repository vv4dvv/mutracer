import { useState } from 'react';
import { Aperture, Palette, RotateCcw, Sparkles, Sun } from 'lucide-react';
import { MAX_PATH_EVENTS_WEBGL, MAX_PATH_EVENTS_WGPU } from '../../../../src/renderer/pathLimits';
import type { OIDNModel } from '@meimu/mutracer';
import { DEFAULT_SETTINGS, setSettings, useViewer, type Settings } from '../../store';
import { ResolutionSelect } from '../ResolutionSelect';
import { Field, Hint, Scrub, Section, Segmented, Select, Switch } from '../ui/controls';
import { useT } from '../../i18n';


export function RenderPanel() {
  const s = useViewer((state) => state.settings);
  const backend = useViewer((state) => state.backend.name);
  const bvhBusy = useViewer((state) => state.stats.phase === 'preparing' || state.loading !== null || state.export !== null);
  const webgl = backend === 'WebGL 2';
  const jnlm = webgl || s.denoiseModel === 'jnlm';
  const [open, setOpen] = useState({ effects: false, jnlm: false });
  const update = (patch: Partial<Settings>) => setSettings(patch);
  const t = useT();

  return (
    <>
      <Section title={t('Quality')} icon={<Aperture size={14} />}>
        <Scrub label={t('Max samples')} value={s.maxSamples} min={4} max={16384} log onChange={(v) => update({ maxSamples: v })} />
        <Scrub label={t('Bounces')} value={s.bounces} min={1} max={webgl ? MAX_PATH_EVENTS_WEBGL : MAX_PATH_EVENTS_WGPU} step={1} onChange={(v) => update({ bounces: v })} />
        <Field label={t('Resolution')}>
          <ResolutionSelect />
        </Field>
        <Field label={t('Sampling')}>
          <Select
            label={t('Sampling pattern')}
            value={s.samplingPattern}
            options={[
              { value: 'sobol', label: 'Sobol', hint: t('Default') },
              { value: 'zsobol', label: 'Z-Sobol', hint: t('Low spp, no denoiser') },
              { value: 'random', label: t('Random') }
            ]}
            onChange={(v) => update({ samplingPattern: v })}
          />
        </Field>
        <Field label={t('BVH builder')}>
          <Segmented
            label={t('BVH builder')}
            value={s.bvhBuilder}
            options={[{ value: 'tinybvh', label: 'tinybvh' }, { value: 'builtin', label: t('builtin') }]}
            disabled={bvhBusy}
            onChange={(v) => update({ bvhBuilder: v })}
          />
        </Field>
        <Scrub label={t('Clamping')} value={s.clamping} min={0} max={100} step={1} format={(v) => (v === 0 ? t('Off') : String(v))} onChange={(v) => update({ clamping: v })} />
      </Section>

      <Section title={t('Caustics')} icon={<Sun size={14} />} actions={<Switch label={t('Caustics')} checked={s.caustics} onChange={v=>update({caustics:v})}/> }>
        {s.caustics&&<>
          <Switch label={t('Light tracing')} checked={s.causticLightTracing} disabled={webgl} onChange={v=>update({causticLightTracing:v})}><span className="field-label">{t('Light tracing')}</span></Switch>
          <Switch label={t('Photon mapping')} checked={s.causticPhotonMapping} disabled={webgl} onChange={v=>update({causticPhotonMapping:v})}><span className="field-label">{t('Photon mapping')}</span></Switch>
          {webgl&&<Hint>{t('Light tracing and photon mapping require WebGPU.')}</Hint>}
        </>}
      </Section>

      <Section
        title={t('Denoiser')}
        icon={<Sparkles size={14} />}
        actions={<>
          {s.denoise && <button className="icon-btn sm" title={t('Reset selected denoiser parameters')} aria-label={t('Reset {denoiser} settings', { denoiser: jnlm ? 'JNLM' : 'OIDN' })} onClick={() => update(jnlm ? {
            jnlmStrength: DEFAULT_SETTINGS.jnlmStrength,
            jnlmSearchRadius: DEFAULT_SETTINGS.jnlmSearchRadius,
            jnlmPatchRadius: DEFAULT_SETTINGS.jnlmPatchRadius,
            jnlmAlbedoBandwidth: DEFAULT_SETTINGS.jnlmAlbedoBandwidth,
            jnlmNormalBandwidth: DEFAULT_SETTINGS.jnlmNormalBandwidth,
            jnlmIterations: DEFAULT_SETTINGS.jnlmIterations
          } : { denoiseModel: 'standard', oidnModel: 'standard', oidnMaxTileSize: 0 })}>
            <RotateCcw size={12} />
          </button>}
          <Switch label={t('Denoiser')} checked={s.denoise} onChange={(v) => update({ denoise: v })} />
        </>}
      >
        {s.denoise && <>
          <Segmented
            label={t('Denoiser type')}
            value={jnlm ? 'jnlm' : 'oidn'}
            options={[{ value: 'jnlm', label: 'JNLM' }, { value: 'oidn', label: 'OIDN', disabled: webgl }]}
            onChange={(v) => update({ denoiseModel: v === 'jnlm' ? 'jnlm' : s.oidnModel })}
          />
          {webgl && <Hint>{t('OIDN requires WebGPU.')}</Hint>}
          {jnlm && <Scrub label={t('Strength')} title={t('Higher values remove more lighting noise')} value={s.jnlmStrength} min={0.1} max={3} step={0.1} onChange={(v) => update({ jnlmStrength: v })} />}
          {jnlm ? <Section
            title={t('More parameters')}
            open={open.jnlm}
            onOpenChange={(v) => setOpen((o) => ({ ...o, jnlm: v }))}
          >
            <Scrub label={t('Search radius')} title={t('Search a larger neighborhood for similar pixels; higher values cost more')} value={s.jnlmSearchRadius} min={1} max={16} step={1} unit="px" onChange={(v) => update({ jnlmSearchRadius: v })} />
            <Scrub label={t('Patch radius')} title={t('Radius of the color comparison patch; smaller patches preserve small details')} value={s.jnlmPatchRadius} min={0} max={3} step={1} unit="px" onChange={(v) => update({ jnlmPatchRadius: v })} />
            <Scrub label={t('Albedo tolerance')} title={t('Lower values protect texture more; higher values smooth more')} value={s.jnlmAlbedoBandwidth} min={0.01} max={1} step={0.01} onChange={(v) => update({ jnlmAlbedoBandwidth: v })} />
            <Scrub label={t('Normal tolerance')} title={t('Lower values protect geometric detail; higher values smooth across surface changes')} value={s.jnlmNormalBandwidth} min={0.005} max={0.5} step={0.005} onChange={(v) => update({ jnlmNormalBandwidth: v })} />
            <Scrub label={t('Filter passes')} title={t('More passes remove broader noise patches; may soften detail')} value={s.jnlmIterations} min={1} max={4} step={1} onChange={(v) => update({ jnlmIterations: v })} />
          </Section> : <>
            <Select<OIDNModel>
              label={t('OIDN model')}
              prefix={t('Model')}
              value={s.oidnModel}
              options={[
                { value: 'standard', label: t('Standard'), hint: t('Balanced') },
                { value: 'small', label: t('Small'), hint: t('Faster') },
                { value: 'cleanAuxLarge', label: t('Large'), hint: t('Prefilters albedo and normals') }
              ]}
              onChange={(v) => update({ denoiseModel: v, oidnModel: v })}
            />
            <Select
              label={t('OIDN tile size')}
              prefix={t('Max tile')}
              value={String(s.oidnMaxTileSize)}
              options={[{ value: '0', label: t('Auto') }, ...[256, 512, 1024, 2048].map((v) => ({ value: String(v), label: `${v} px` }))]}
              onChange={(v) => update({ oidnMaxTileSize: Number(v) })}
            />
          </>}
        </>}
      </Section>

      <Section title={t('Color')} icon={<Palette size={14} />}>
        <Switch label={t('HDR output')} checked={!webgl && s.hdrOutputEnabled} disabled={backend !== 'WebGPU'} onChange={(v) => update({ hdrOutputEnabled: v })}>
          <span className="field-label">{t('HDR output')}</span>
        </Switch>
        <Hint>{webgl ? t('HDR output requires WebGPU.') : t('Requires an HDR display and a compatible browser; falls back to SDR when unsupported.')}</Hint>
        <Select
          label={t('Tone mapping')}
          prefix={t('Tone mapping')}
          value={s.toneMapping}
          disabled={!webgl && s.hdrOutputEnabled}
          options={[
            { value: 'agx', label: 'AgX' },
            { value: 'aces', label: 'ACES' },
            { value: 'cineon', label: 'Cineon' },
            { value: 'reinhard', label: 'Reinhard' },
            { value: 'linear', label: t('Linear') }
          ]}
          onChange={(v) => update({ toneMapping: v })}
        />
        <Scrub label={t('Exposure')} value={s.exposure} min={0} max={4} onChange={(v) => update({ exposure: v })} />
        <div className="grid2">
          <Scrub label={t('Contrast')} value={s.contrast} min={0.5} max={1.5} onChange={(v) => update({ contrast: v })} />
          <Scrub label={t('Saturation')} value={s.saturation} min={0} max={2} onChange={(v) => update({ saturation: v })} />
          <Scrub label={t('Temp')} title={t('Temperature')} value={s.temperature} min={-1} max={1} onChange={(v) => update({ temperature: v })} />
          <Scrub label={t('Tint')} value={s.tint} min={-1} max={1} onChange={(v) => update({ tint: v })} />
        </div>
      </Section>

      <Section
        title={t('Effects')}
        icon={<Sun size={14} />}
        value={s.bloomIntensity > 0 ? 'bloom' : s.vignette > 0 ? 'vignette' : 'off'}
        open={open.effects}
        onOpenChange={(v) => setOpen((o) => ({ ...o, effects: v }))}
      >
        <Scrub label={t('Bloom')} value={s.bloomIntensity} min={0} max={1} onChange={(v) => update({ bloomIntensity: v })} />
        {s.bloomIntensity > 0 && (
          <div className="grid2">
            <Scrub label={t('Threshold')} value={s.bloomThreshold} min={0} max={4} onChange={(v) => update({ bloomThreshold: v })} />
            <Scrub label={t('Radius')} value={s.bloomRadius} min={0} max={1} onChange={(v) => update({ bloomRadius: v })} />
          </div>
        )}
        <Scrub label={t('Vignette')} value={s.vignette} min={0} max={1} onChange={(v) => update({ vignette: v })} />
      </Section>

    </>
  );
}
