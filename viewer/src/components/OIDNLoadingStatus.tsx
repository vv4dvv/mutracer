import { LoaderCircle } from 'lucide-react';
import { useViewer } from '../store';
import { useT } from '../i18n';

export function OIDNLoadingStatus() {
  const loading = useViewer((s) => s.oidnLoading);
  const t = useT();
  if (!loading) return null;
  return (
    <div className="float oidn-loading" role="status">
      <LoaderCircle size={14} aria-hidden="true" />
      <span>{t('Loading OIDN…')}</span>
    </div>
  );
}
