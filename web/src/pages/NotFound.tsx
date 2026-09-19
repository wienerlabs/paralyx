import { Link } from 'react-router-dom'
import { useT } from '../lib/i18n'

export function NotFound() {
  const { t } = useT()
  return (
    <div className="card mx-auto mt-10 max-w-md text-center">
      <div className="text-5xl tracking-tight text-ink">404</div>
      <p className="mt-2 text-sm text-mute">{t('notFound')}</p>
      <Link to="/" className="btn mt-5">
        {t('backHome')}
      </Link>
    </div>
  )
}
