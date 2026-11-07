import { useEffect, useRef, useState } from 'react';
import { Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { Download, X } from 'lucide-react';
import { VIEWER_AOVS, setSettings, setUi, useViewer, showToast } from '../store';
import { getEngine } from '../engine/ViewerEngine';
import { Field, Scrub, Segmented, Switch } from './ui/controls';
import { useT } from '../i18n';

type SizePreset = 'viewport' | '1080p' | '2k' | '4k' | 'square' | 'custom';

const validDimension = (value: number, max: number) => Number.isInteger(value) && value >= 1 && value <= max;

export function ExportDialog() {
  const open = useViewer((s) => s.ui.exportOpen);
  const progress = useViewer((s) => s.export);
  const stats = useViewer((s) => s.stats);
  const maxSamples = useViewer((s) => s.settings.maxSamples);
  const output = useViewer((s) => s.settings.output);
  const denoise = useViewer((s) => s.settings.denoise);
  const background = useViewer((s) => s.settings.background);
  const [size, setSize] = useState<SizePreset>('viewport');
  const [customWidth, setCustomWidth] = useState('1920');
  const [customHeight, setCustomHeight] = useState('1080');
  const [samples, setSamples] = useState(maxSamples);
  const [transparent, setTransparent] = useState(background === 'transparent');
  const [downloading, setDownloading] = useState(false);
  const preview = useRef<HTMLCanvasElement>(null);
  const t = useT();

  useEffect(() => {
    if (!open) return;
    setSamples(maxSamples);
    setTransparent(background === 'transparent');
    // Snapshot the current frame for the preview.
    let cancelled = false;
    const id = requestAnimationFrame(() => {
      const engine = getEngine();
      const target = preview.current;
      if (!engine || !target) return;
      const source = engine.engine.display.canvas;
      target.width = 480;
      target.height = Math.round((480 * source.height) / Math.max(1, source.width));
      void engine.captureImage().then(createImageBitmap).then(image => {
        if (!cancelled) target.getContext('2d')?.drawImage(image, 0, 0, target.width, target.height);
        image.close();
      }).catch(error => { if (!cancelled) showToast(t('Could not capture preview: {message}', { message: error.message }), 'error'); });
    });
    return () => { cancelled = true; cancelAnimationFrame(id); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const dims = size === '1080p' ? [1920, 1080] : size === '2k' ? [2560, 1440] : size === '4k' ? [3840, 2160] : size === 'square' ? [2048, 2048] : size === 'custom' ? [Number(customWidth), Number(customHeight)] : [stats.width, stats.height];
  const maxDimension = getEngine()?.engine.info?.limits.maxTextureDimension2D ?? 8192;
  const validSize = size !== 'custom' || dims.every(value => validDimension(value, maxDimension));
  const estimate = !VIEWER_AOVS.some(kind => kind === output) && stats.msPerSample > 0 && validSize ? (stats.msPerSample * samples * (dims[0] * dims[1])) / Math.max(1, stats.width * stats.height) / 1000 : 0;
  const busy = progress !== null || downloading;
  const close = () => {
    if (progress) getEngine()?.cancelExport();
    setUi({ exportOpen: false });
  };

  return (
    <ModalOverlay className="scrim" isOpen={open} onOpenChange={(v) => !v && close()} isDismissable={!busy}>
      <Modal className="dialog">
        <Dialog aria-label={t('Export image')}>
          <Heading slot="title" className="dialog__title">{t('Export image')}
            <button className="icon-btn icon-btn--bare sm" aria-label={t('Close')} onClick={close}><X size={14} /></button>
          </Heading>
          <div className="preview" data-checker={transparent || undefined}><canvas ref={preview} /></div>
          <button className="btn btn--wide" disabled={busy || stats.samples === 0} onClick={async () => {
            setDownloading(true);
            try {
              await getEngine()?.downloadViewportImage();
            } finally {
              setDownloading(false);
            }
          }}>
            <Download size={15} />{downloading ? t('Downloading…') : t('Download viewport PNG')}
          </button>
          <p className="hint">{t('Save the current {width} × {height} image as displayed, without re-rendering.', { width: stats.width, height: stats.height })}</p>
          <Field label={t('Size')}>
            <Segmented label={t('Image size')} value={size} disabled={busy} onChange={setSize} options={[
              { value: 'viewport', label: t('Viewport') }, { value: '1080p', label: '1080p' },
              { value: '2k', label: '2K' }, { value: '4k', label: '4K' }, { value: 'square', label: t('Square') }, { value: 'custom', label: t('Custom') }
            ]} />
          </Field>
          {size === 'custom' && <div className="export-size">
            <label><span className="field-label">{t('Width')}</span>
              <input className="text-input mono" type="number" min={1} max={maxDimension} step={1} value={customWidth} disabled={busy}
                aria-invalid={!validDimension(dims[0], maxDimension)} onChange={(e) => setCustomWidth(e.currentTarget.value)} />
            </label>
            <label><span className="field-label">{t('Height')}</span>
              <input className="text-input mono" type="number" min={1} max={maxDimension} step={1} value={customHeight} disabled={busy}
                aria-invalid={!validDimension(dims[1], maxDimension)} onChange={(e) => setCustomHeight(e.currentTarget.value)} />
            </label>
          </div>}
          {!validSize && <p className="hint hint--warn">{t('Use whole numbers from 1 to {max}.', { max: maxDimension })}</p>}
          <Scrub label={t('Samples')} value={samples} min={16} max={16384} log disabled={busy} onChange={setSamples} />
          <Switch label={t('Denoise')} checked={denoise} disabled={busy} onChange={(v) => setSettings({ denoise: v })}>
            <span className="field-label">{t('Denoise')}</span>
          </Switch>
          <Switch label={t('Transparent background')} checked={transparent} disabled={busy} onChange={setTransparent}>
            <span className="field-label">{t('Transparent background')}</span>
          </Switch>
          {progress && (
            <div className="export-progress">
              <div className="progress"><i style={{ width: `${(progress.samples / Math.max(1, progress.target)) * 100}%` }} /></div>
              <span className="mono">{progress.stage === 'denoising' ? t('Denoising…') : `${progress.samples} / ${progress.target} spp`}</span>
            </div>
          )}
          <div className="actions">
            <span className="est mono">{validSize && `${dims[0]} × ${dims[1]}`}{estimate > 0 && !busy ? ` · ≈ ${Math.max(1, Math.round(estimate))} s` : ''}</span>
            <button className="btn" onClick={close}>{progress ? t('Cancel render') : t('Cancel')}</button>
            <button className="btn btn--primary" disabled={busy || !validSize} onClick={async () => {
              await getEngine()?.exportImage({ width: dims[0], height: dims[1], samples, transparent });
              setUi({ exportOpen: false });
            }}>
              <Download size={15} />{progress ? t('Rendering…') : t('Render PNG')}
            </button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
