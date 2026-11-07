import { useEffect, useRef } from 'react';
import { Button, Dialog, DialogTrigger, Heading, Popover, Tabs, TabList, Tab, TabPanel } from 'react-aria-components';
import { ChevronDown, ExternalLink, Pin, PinOff, Sparkles, X } from 'lucide-react';
import { setUi, useViewer } from '../store';
import { getEngine } from '../engine/ViewerEngine';
import { MODEL_PRESETS } from '../engine/presets';
import { RESEARCH_SCENES_SOURCE } from '../engine/researchModelPresets';
import { useT } from '../i18n';

export function ExamplesMenu({ mobile }: { mobile: boolean }) {
  const ui = useViewer((s) => s.ui);
  const t = useT();
  if (ui.examplesPinned && !mobile) {
    return (
      <Button id="examples-trigger" className="btn" aria-label={t('Examples')} aria-controls="examples-panel"
        data-active={ui.right && !(ui.textureBrowser && ui.tab === 'material') || undefined}
        onPress={() => {
          setUi({ right: true, textureBrowser: false });
          requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('#examples-panel button')?.focus());
        }}>
        <Sparkles size={15} /><span className="hide-xs">{t('Examples')}</span><Pin size={13} />
      </Button>
    );
  }
  return (
    <DialogTrigger isOpen={ui.examplesOpen} onOpenChange={(examplesOpen) => setUi({ examplesOpen })}>
      <Button id="examples-trigger" className="btn" aria-label={t('Examples')}>
        <Sparkles size={15} /><span className="hide-xs">{t('Examples')}</span><ChevronDown size={13} className="chev" />
      </Button>
      <Popover className="popover examples" offset={8}>
        <Dialog aria-label={t('Examples')}>
          <div className="examples-head">
            <Heading slot="title">{t('Examples')}</Heading>
            {!mobile && <button className="icon-btn icon-btn--bare sm" aria-label={t('Pin to right panel')} title={t('Pin to right panel')}
              onClick={() => setUi({ examplesPinned: true, examplesOpen: false, right: true, textureBrowser: false })}>
              <Pin size={15} />
            </button>}
          </div>
          <ExamplesBrowser onChoose={() => setUi({ examplesOpen: false })} />
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

export function ExamplesPanel() {
  const unpin = useRef<HTMLButtonElement>(null);
  const t = useT();
  useEffect(() => { unpin.current?.focus(); }, []);
  return (
    <section id="examples-panel" className="panel examples-panel" aria-label={t('Examples')}>
      <div className="insp-head">
        <span className="badge"><Sparkles size={16} /></span>
        <div className="copy"><strong>{t('Examples')}</strong></div>
        <button ref={unpin} className="icon-btn icon-btn--bare sm" aria-label={t('Unpin examples')} title={t('Unpin examples')}
          onClick={() => setUi({ examplesPinned: false, examplesOpen: true })}><PinOff size={15} /></button>
        <button className="icon-btn icon-btn--bare sm" aria-label={t('Close examples')} title={t('Close examples')}
          onClick={() => {
            setUi({ examplesPinned: false, examplesOpen: false });
            requestAnimationFrame(() => document.getElementById('examples-trigger')?.focus());
          }}><X size={14} /></button>
      </div>
      <div className="examples-panel__body"><ExamplesBrowser /></div>
    </section>
  );
}

function ExamplesBrowser({ onChoose }: { onChoose?: () => void }) {
  const current = useViewer((s) => s.model?.presetId);
  const collection = useViewer((s) => s.ui.examplesCollection) ?? (current?.startsWith('research-') ? 'research' : 'models');
  const t = useT();
  return (
    <Tabs className="example-tabs" selectedKey={collection}
      onSelectionChange={(key) => setUi({ examplesCollection: key === 'research' ? 'research' : 'models' })}>
      <TabList aria-label={t('Example collections')} className="example-tabs__list">
        <Tab id="models">{t('MuTracer collection')}</Tab>
        <Tab id="research">
          <span title={t('Independently maintained by glTF Research Scenes contributors')}>glTF Research Scenes</span>
          <ExternalLink size={12} aria-hidden="true" />
        </Tab>
      </TabList>
      {(['models', 'research'] as const).map((category) => (
        <TabPanel key={category} id={category}>
          {category === 'research' && <p className="hint example-note">
            <a href={RESEARCH_SCENES_SOURCE} target="_blank" rel="noopener noreferrer">glTF Research Scenes ↗</a>
            {' · '}{t('Original scene lighting; large scenes need more memory.')}
          </p>}
          <div className="ex-grid">
            {MODEL_PRESETS.filter((preset) => (preset.category === 'research') === (category === 'research')).map((preset) => (
              <div key={preset.id} className="ex-entry">
                <button className="ex" data-on={current === preset.id || undefined} aria-pressed={current === preset.id}
                  onClick={() => { void getEngine()?.loadPreset(preset.id); onChoose?.(); }}>
                  <span className="thumb"><img src={preset.thumbnail} alt="" loading="lazy" /></span>
                  <div>
                    <b>{preset.name}</b>
                    <small><span className="tag">{t(preset.tag)}</span><span>{preset.license}{preset.sizeMB ? ` · ${preset.sizeMB} MB` : ''}</span></small>
                  </div>
                </button>
                {category === 'research' && <div className="ex-links">
                  <a href={preset.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={t('{name} source', { name: preset.name })}>{t('Source ↗')}</a>
                  <a href={preset.licenseUrl} target="_blank" rel="noopener noreferrer" aria-label={t('{name} license', { name: preset.name })}>{t('License ↗')}</a>
                </div>}
              </div>
            ))}
          </div>
        </TabPanel>
      ))}
    </Tabs>
  );
}
