import { ChevronRight, Info } from 'lucide-react';
import { useApp } from '../context';
import { Diagnostics } from '../diagnostics/Diagnostics';
import { helpText } from './text';
import notices from './third-party-notices.txt?raw';

/** Read-only guidance: opening it never changes consent, account or journey state. */
export function Help() {
  const { state } = useApp(), t = helpText(state.life.language);
  const release = document.querySelector('meta[name="rise-release"]')?.getAttribute('content');
  const sections = [
    ['privacy', ['privateData', 'accountData', 'sharing', 'device', 'measurement']],
    ['retention', ['controls', 'deletion', 'periods']],
    ['use', ['audience', 'conduct']],
    ['reminders', ['limits', 'recovery']],
    ['support', ['contact', 'safety']],
    ['rights', ['credits']],
  ] as const;
  return <details className="settings-disclosure help-settings">
    <summary><Info size={20} /><span><strong>{t('title')}</strong><small>{t('detail')}</small></span><ChevronRight size={18} /></summary>
    <p className="fine-print">{t('status')}</p>
    <p className="fine-print help-release">{t('version')}: {release && /^[a-f0-9]{20}$/.test(release) ? release : t('unavailable')}</p>
    {sections.map(([title, paragraphs]) => <details key={title} className="settings-disclosure" data-help={title}>
      <summary><span><strong>{t(title)}</strong></span><ChevronRight size={18} /></summary>
      {paragraphs.map(key => <p className="fine-print" key={key}>{t(key)}</p>)}
      {title === 'support' && <Diagnostics />}
      {title === 'rights' && <pre className="fine-print help-notices">{notices}</pre>}
    </details>)}
  </details>;
}
