export const VINYAS_APP_VERSION = '1.2.1';
export const VINYAS_EXTENSION_VERSION = '1.2.1';

export const WHATS_NEW_CHANGELOG = {
  version: '1.2.1',
  date: 'May 26, 2026',
  coreChanges: [
    '🔒 Highly optimized and secured login/logout credentials system utilizing Sync ID as password.',
    '📧 Session tokens are cancelled on user login, preventing account deletion after 6 days, with warning emails sent at day 5.',
    '🗄️ Enhanced background auto-sync capability for Vinyas Extension connecting to the dashboard.',
    '🔄 Added server-side validation to avoid routing conflicts for duplicate chapter names.'
  ],
  clientChanges: [
    '🆕 Added the version-aware "What\'s New" modal popup on app updates.',
    '🧩 Integrated active browser extension version detection.',
    '🚨 Pinned a persistent red header warning if an outdated Vinyas extension is detected.'
  ],
  actionRequired: [
    'Please download and load the latest Vinyas Extension (v1.2.1) in your browser to maintain correct activity tracking.'
  ]
};
