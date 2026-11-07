import { Crosshair, Focus, Maximize } from 'lucide-react';
import { setSettings, setUi, useViewer } from '../store';
import { getEngine } from '../engine/ViewerEngine';
import { Select } from './ui/controls';
import { useT } from '../i18n';

export function ViewControls() {
  const picking = useViewer((s) => s.pickingFocus);
  const autoFocus = useViewer((s) => s.settings.autoFocus);
  const focusFrame = useViewer((s) => s.ui.focusFrame);
  const depthOfField = useViewer((s) => s.settings.fStop > 0 &&
    !(s.settings.cameraIndex < 0 && s.settings.projection === 'orthographic'));
  const t = useT();
  if (!depthOfField) return null;
  return (
    <>
      <div className="viewport-tools" role="group" aria-label={t('Focus controls')}>
        {!autoFocus && <button className="icon-btn icon-btn--bare" title={t('Pick focus point')} aria-label={t('Pick focus point')} data-active={picking || undefined}
          onClick={() => useViewer.setState({ pickingFocus: !picking })}><Crosshair size={16} /></button>}
        {autoFocus && <button className="icon-btn icon-btn--bare" aria-label={t('Show focus frame')} aria-pressed={focusFrame}
          title={focusFrame ? t('Hide focus frame') : t('Show focus frame')} data-active={focusFrame || undefined}
          onClick={() => setUi({ focusFrame: !focusFrame })}><Focus size={16}>{!focusFrame && <path d="m3 3 18 18" />}</Focus></button>}
      </div>
      <span className="sep" />
    </>
  );
}

/** Authored views stay separate from render and focus controls. */
export function CameraControls() {
  const cameras = useViewer((s) => s.cameras);
  const cameraIndex = useViewer((s) => s.settings.cameraIndex);
  const t = useT();
  return (
    <div className="float camera-controls" role="group" aria-label={t('Camera controls')}>
      {cameras.length > 0 && <div className="viewport-camera">
        <Select label={t('Camera')} prefix={t('Camera')} value={String(cameraIndex)} placement="top"
          options={[{ value: '-1', label: t('Orbit') }, ...cameras.map((name, i) => ({ value: String(i), label: name }))]}
          onChange={(v) => setSettings({ cameraIndex: Number(v) })} />
      </div>}
      <button className="icon-btn icon-btn--bare" title={t('Fit to model (F)')} aria-label={t('Fit to model')}
        onClick={() => getEngine()?.fit()}><Maximize size={16} /></button>
    </div>
  );
}
