export const VINYAS_APP_VERSION = '2.2.2';
export const VINYAS_EXTENSION_VERSION = '2.2.2';

export const WHATS_NEW_CHANGELOG = {
  version: '2.2.2',
  date: 'June 23, 2026',
  coreChanges: [
    '🐛 Assignment Submission Fixed: Resolved a critical bug where the "Finalize & Submit" button in the extension widget would get permanently stuck in a "Submitting..." state and never complete.',
    '⚡ Zero-Flash Input: Eliminated the entire-widget flickering/flashing that occurred on every keystroke inside the self-analysis form, making editing buttery-smooth.',
    '🔁 Infinite Re-render Loop Eliminated: Removed the root cause — a premature full DOM rebuild inside the save routine that orphaned callbacks and caused cyclic re-renders.',
  ],
  clientChanges: [
    '🎯 Dedicated Submit State Flag: The "Finalize & Submit" button now tracks its loading state independently of the background auto-save lock, so background saves never corrupt the button UI.',
    '🛡️ Runtime Error Handling: Extension message errors (e.g. service worker sleeping) now properly surface as user-facing toast errors instead of silently getting swallowed.',
    '⏱️ Extended Safety Timeout: The save operation watchdog timeout has been extended to 8 seconds and now correctly triggers a failure callback to unlock the UI if the network hangs.',
    '💾 Instant Overlay Close: The "Save & Pause Timer" overlay now closes immediately on click while the save continues in the background, making the UX feel instant.',
  ],
  actionRequired: [
    'Please update your Chrome extension to 2.2.2 for the assignment submission fixes.'
  ]
};
