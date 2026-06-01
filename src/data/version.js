export const VINYAS_APP_VERSION = '2.0.0';
export const VINYAS_EXTENSION_VERSION = '2.0.0';

export const WHATS_NEW_CHANGELOG = {
  version: '2.0.0',
  date: 'June 1, 2026',
  coreChanges: [
    '⚡ Real-Time Tab Synchronization Bridge: Background worker dynamically broadcasts live overlay status updates to all open Vinyas dashboard tabs, eliminating stale overwrite race conditions.',
    '📦 Aligned key generation formulas between content script scanners and backend processors to ensure consistent question mappings.',
    '🛡️ Cryptographically secure prefix validations in all telemetry routes.'
  ],
  clientChanges: [
    '🎯 Integrated Interactive Widget Overlay: No need to do split screen to track your question states! Beautiful glassmorphic overlay matches your active chapter practice pages directly.',
    '👑 Draggable & Bounded Widget Layout: Drag and reposition the floating question tracker anywhere on your viewport, bounded safely inside browser borders.',
    '🎥 Immediate Glassmorphic Loading State: Features an instant animated loading spinner overlay showing feedback immediately while data loads.',
    '🚪 Sidebar Toggle Shortcut: Click on the Vinyas Logo in the header to instantly collapse or expand the navigation sidebar dock!',
    '🛑 Native Submit Button Hiding: The browser automatically hides native PW quiz submit buttons using active styling overrides to keep layout clean.',
    '🔥 Programmatic Submit Redirection: Submitting on the Vinyas widget acts as a proxy, clicking and completing the native PW submission programmatically.',
    '📚 Multi-Textbook Modules Support: Sync multiple textbook modules per subject and toggle between them using a gorgeous glassy dropdown in the subject matrix.',
    '🔗 Smarter Chapter Reading Links: Chapter rows render Phosphorus icons directing you to synced book chapter pages in a single click, or prompting a map utility if unlinked.'
  ],
  actionRequired: [
    'Update to Vinyas Extension (v2.0.0) to enable real-time tab sync, embedded draggable widgets, native submit overrides, and multi-textbook auto-discovery.'
  ]
};
