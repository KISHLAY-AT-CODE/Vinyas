export const VINYAS_APP_VERSION = '1.2.5';
export const VINYAS_EXTENSION_VERSION = '1.2.2';

export const WHATS_NEW_CHANGELOG = {
  version: '1.2.5',
  date: 'May 28, 2026',
  coreChanges: [],
  clientChanges: [
    '⚡ Syllabus Scroll Optimization: Scroll event listeners have been optimized to avoid expensive layout recalculations, providing a buttery-smooth scrolling experience.',
    '💾 Real-Time LocalStorage Sync: Toggling questions in the interactive module tracker now updates your local storage in real-time, preventing loss of marked question states.',
    '🛡️ Mismatch Auto-Recovery: Locking in progress now compares states to automatically detect and restore any mismatches from LocalStorage backup before saving, alerting you via yellow warnings if recovery occurred.',
    '📊 Dynamic Extension Info: Extension setup page now displays active Chrome Extension and Android APK versions and file sizes directly from the server dynamically.',
    '📜 Scrollable Setup Slides: Fully scrollable Extension setup layout on all screen sizes to prevent tutorial content from clipping.',
    '🔗 Smarter Extension Prompts: Outdated or unconfigured extensions will no longer pop up empty overlays, and already synced chapters are automatically bypassed.'
  ],
  actionRequired: [
    'Update to Vinyas Extension (v1.2.2) to enable real-time local storage sync, smart bypass filters, and prompt-free navigation.'
  ]
};
