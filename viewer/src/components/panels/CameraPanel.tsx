import { Camera, Crosshair, Maximize } from 'lucide-react';
import { setSettings, setUi, useViewer } from '../../store';
import { DEFAULT_F_STOP, getEngine } from '../../engine/ViewerEngine';
import { Hint, Scrub, Section, Segmented, Select, Switch } from '../ui/controls';
import { useT } from '../../i18n';

export function CameraPanel() {
  const s = useViewer((state) => state.settings);
  const orbit = s.cameraIndex < 0;
  const orthographic = orbit && s.projection === 'orthographic';
  const t = useT();
  return (
    <>
      <Section title={t('View')} icon={<Camera size={14} />}>
        <Segmented
          label={t('Projection')}
          value={s.projection}
          disabled={!orbit}
          options={[
            { value: 'perspective', label: t('Perspective') },
            { value: 'orthographic', label: t('Orthographic') }
          ]}
          onChange={(v) => setSettings({ projection: v })}
        />
        <Scrub label={t('Field of view')} value={s.fov} min={10} max={100} step={1} unit="°" disabled={!orbit || orthographic} onChange={(v) => setSettings({ fov: v })} />
        <Switch label={t('Auto-rotate')} checked={s.autoRotate} onChange={(v) => setSettings({ autoRotate: v })}>
          <span className="field-label">{t('Auto-rotate')}</span>
        </Switch>
        <button className="btn btn--wide" onClick={() => getEngine()?.fit()}>
          <Maximize size={15} />{t('Fit to model')}<kbd>F</kbd>
        </button>
        {!orbit && <Hint>{t('Drag, pan or zoom to continue from this camera in Orbit.')}</Hint>}
      </Section>

      <Section
        title={t('Depth of field')}
        icon={<Crosshair size={14} />}
        actions={<Switch label={t('Depth of field')} checked={s.fStop > 0} disabled={orthographic} onChange={(on) => setSettings({ fStop: on ? DEFAULT_F_STOP : 0 })} />}
      >
        {orthographic && <Hint>{t('Orthographic views have no depth of field.')}</Hint>}
        {s.fStop > 0 && !orthographic && <DepthOfField />}
      </Section>
    </>
  );
}

const UNITS = [
  { value: '0.001', label: 'Millimetres' },
  { value: '0.01', label: 'Centimetres' },
  { value: '0.0254', label: 'Inches' },
  { value: '1', label: 'Metres' }
];

const unitName = (metersPerUnit: number) =>
  UNITS.find((unit) => Number(unit.value) === metersPerUnit)?.label ?? `${metersPerUnit} m`;

/** Metres as "35 cm" or "2.40 m". */
const formatMeters = (meters: number) =>
  meters < 1 ? `${(meters * 100).toPrecision(3).replace(/\.?0+$/, '')} cm` : `${meters.toFixed(meters < 10 ? 2 : 1)} m`;

function DepthOfField() {
  const s = useViewer((state) => state.settings);
  const picking = useViewer((state) => state.pickingFocus);
  const lens = useViewer((state) => state.lens);
  const radius = useViewer((state) => state.modelRadius);
  const focusFrame = useViewer((state) => state.ui.focusFrame);
  const t = useT();
  const metersPerUnit = s.metersPerUnit ?? lens.guessedMetersPerUnit;
  // Focus range follows the model so the slider stays usable at any scale.
  const focusMin = radius * 0.05 * metersPerUnit;
  const focusMax = Math.max(radius * 60, s.focusDistance * 2) * metersPerUnit;
  const aperture = lens.focalLength / s.fStop;
  return (
    <>
      <Scrub label={t('f-number')} value={s.fStop} min={0.7} max={22} step={0.1} log format={(v) => `f/${v}`}
        onChange={(v) => setSettings({ fStop: v })} />
      <Switch label={t('Autofocus')} checked={s.autoFocus} onChange={(v) => setSettings({ autoFocus: v })}>
        <span className="field-label">{t('Area autofocus')}</span>
      </Switch>
      <Switch label={t('Show focus frame')} checked={focusFrame} disabled={!s.autoFocus} onChange={(v) => setUi({ focusFrame: v })}>
        <span className="field-label">{t('Show focus frame')}</span>
      </Switch>
      <div className={s.autoFocus ? undefined : 'row-with-button'}>
        <Scrub label={t('Focus')} value={s.focusDistance * metersPerUnit} min={focusMin} max={focusMax} step={0.0001} log format={formatMeters}
          title={s.autoFocus ? t('Dragging turns autofocus off') : undefined}
          onChange={(v) => setSettings({ focusDistance: v / metersPerUnit, autoFocus: false })} />
        {!s.autoFocus && <button className="btn" data-active={picking || undefined} onClick={() => useViewer.setState({ pickingFocus: !picking })}>
          <Crosshair size={14} />{t('Pick')}
        </button>}
      </div>
      <Select
        label={t('Scene unit')}
        prefix={t('Unit')}
        value={s.metersPerUnit === null ? 'auto' : String(s.metersPerUnit)}
        options={[
          { value: 'auto', label: t('Auto · {unit}', { unit: t(unitName(lens.guessedMetersPerUnit)) }) },
          ...UNITS.map((unit) => ({ value: unit.value, label: t(unit.label) }))
        ]}
        onChange={(v) => setSettings({ metersPerUnit: v === 'auto' ? null : Number(v) })}
      />
      <Hint>
        {picking
          ? t('Click the model to focus on that point.')
          : <>
            {t('{focalLength} mm lens, {aperture} mm aperture.', { focalLength: lens.focalLength.toFixed(0), aperture: aperture.toFixed(1) })}
            {s.autoFocus && focusFrame ? t(' Hover over the frame, then drag its center to move the focus area.') : ''}
          </>}
      </Hint>
    </>
  );
}
