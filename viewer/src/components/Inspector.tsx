import { Aperture, Camera, Globe, Palette } from 'lucide-react';
import { setUi, useViewer, type InspectorTab } from '../store';
import { EnvironmentPanel } from './panels/EnvironmentPanel';
import { MaterialPanel } from './panels/MaterialPanel';
import { CameraPanel } from './panels/CameraPanel';
import { RenderPanel } from './panels/RenderPanel';
import { SceneTree } from './SceneTree';
import { useT } from '../i18n';

export const TABS: { id: InspectorTab; label: string; Icon: typeof Globe }[] = [
  { id: 'environment', label: 'Lighting', Icon: Globe },
  { id: 'material', label: 'Material', Icon: Palette },
  { id: 'camera', label: 'Camera', Icon: Camera },
  { id: 'render', label: 'Render', Icon: Aperture }
];

const PANELS: Record<InspectorTab, () => JSX.Element> = {
  environment: EnvironmentPanel,
  material: MaterialPanel,
  camera: CameraPanel,
  render: RenderPanel
};

export function Inspector({ mobile }: { mobile: boolean }) {
  const ui = useViewer((s) => s.ui);
  const t = useT();
  if (mobile) {
    const tab = ui.mobileTab;
    const Panel = tab === 'scene' ? null : PANELS[tab];
    return (
      <section className="panel inspector inspector--sheet" aria-label={t('Inspector')}>
        <div className="sheet-tabs" role="tablist">
          {[{ id: 'scene' as const, label: 'Scene' }, ...TABS].map((item) => (
            <button key={item.id} role="tab" aria-selected={tab === item.id} data-on={tab === item.id || undefined}
              onClick={() => setUi({ mobileTab: item.id })}>{t(item.label)}</button>
          ))}
        </div>
        {Panel ? <div className="insp-body">{<Panel />}</div> : <SceneTree />}
      </section>
    );
  }
  const current = TABS.find((item) => item.id === ui.tab)!;
  const Panel = PANELS[ui.tab];
  return (
    <section className="panel inspector" aria-label={t(current.label)}>
      <div className="insp-head">
        <span className="badge"><current.Icon size={16} /></span>
        <div className="copy"><strong>{t(current.label)}</strong></div>
      </div>
      <div className="insp-body" role="tabpanel"><Panel /></div>
    </section>
  );
}

export function InspectorRail() {
  const tab = useViewer((s) => s.ui.tab);
  const open = useViewer((s) => s.ui.right);
  const t = useT();
  return (
    <nav className="panel rail" role="tablist" aria-label={t('Inspector')} aria-orientation="vertical">
      {TABS.map(({ id, label, Icon }, i) => (
        <button key={id} role="tab" aria-selected={tab === id} data-on={(open && tab === id) || undefined} title={`${t(label)} (${i + 1})`}
          onClick={() => setUi(tab === id && open ? { right: false } : { tab: id, right: true })}>
          <Icon size={18} />{t(label)}
        </button>
      ))}
    </nav>
  );
}
