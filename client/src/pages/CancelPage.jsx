import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n';

export default function CancelPage() {
  const { t } = useLanguage();
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
      <div className="glass-card p-8 sm:p-12">
        <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6 backdrop-blur-sm border border-yellow-500/20">
          <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">{t('Payment Cancelled')}</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-2">{t('Your payment was not processed.')}</p>
        <p className="text-gray-500 dark:text-gray-400 mb-8">{t("No charges were made. You can try again whenever you're ready.")}</p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/cart" className="btn-primary">
            {t('Return to Cart')}
          </Link>
          <Link to="/products" className="btn-secondary">
            {t('Continue Shopping')}
          </Link>
        </div>
      </div>
    </div>
  );
}
