export const VINYAS_APP_VERSION = '1.2.2';
export const VINYAS_EXTENSION_VERSION = '1.2.1';

export const WHATS_NEW_CHANGELOG = {
  version: '1.2.2',
  date: 'May 27, 2026',
  coreChanges: [
    '👤 Integrated Account Profile editing and instant local/cloud synchronization of custom usernames.',
    '🔒 Strengthened api/data endpoint to dynamically accept and sync profile updates across multiple linked sessions.'
  ],
  clientChanges: [
    '🎨 Upgraded brand logo typography to Space Grotesk with a stunning 5-color logo-themed gradient.',
    '🔍 Optimized horizontal header layout with a collapsable search bar (collapses to icon on mobile) and responsive username text truncation.',
    '📅 Portaled Target Date picker modal to body to prevent overflow clipping in sticky header container.',
    '💾 Added a backup warning recommendation overlay on dismiss of What\'s New to secure user state via secure GCM-AES JSON files.',
    '🛠️ Added a developer sandbox shortcut button to simulate the "What\'s New" popups inside DevToolsOverlay.'
  ],
  actionRequired: [
    'Vinyas Extension (v1.2.1) is fully compatible. No extension updates are required for this release.'
  ]
};
