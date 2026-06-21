export const VINYAS_APP_VERSION = '2.1.2';
export const VINYAS_EXTENSION_VERSION = '2.1.2';

export const WHATS_NEW_CHANGELOG = {
  version: '2.1.2',
  date: 'June 21, 2026',
  coreChanges: [
    '🎯 User Requested Features Updated: Even after project closure, user-requested features and improvements continue to be entertained and shipped.',
    '📊 Vercel Analytics: Integrated Vercel Analytics for real-time usage insights and performance monitoring.',
    '🔗 Direct Assignment Mapping: Re-initializing an assignment now directly edits the database entry without creating unresolved submissions.'
  ],
  clientChanges: [
    '🔄 Initialize Again: The extension widget now shows an "Initialize Again" button when you modify assignment name or type, letting you re-link assignments to different chapters instantly.',
    '🛡️ Save Safety Net: Unsaved progress is now automatically flushed on tab close or background, preventing data loss via keepalive requests.',
    '⚡ Duplicate Prevention: Save operations are now queued to prevent race conditions from concurrent database writes.',
    '🧹 Cleaner UI: Removed emoji icons from extension buttons, removed backdrop-click dismissal on overlays, and polished button loading states.'
  ],
  actionRequired: [
    'Please update your Chrome extension to 2.1.2 for the latest widget improvements.'
  ]
};
