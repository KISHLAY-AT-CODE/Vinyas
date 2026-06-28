export const VINYAS_APP_VERSION = '2.3.1';
export const VINYAS_EXTENSION_VERSION = '2.3.1';

export const WHATS_NEW_CHANGELOG = {
  version: '2.3.1',
  date: 'June 28, 2026',
  coreChanges: [
    '📊 Standalone Recent Activity Dashboard: Introduced a consolidated recent activity card listing the 5 latest active chapters from each subject based on automatic study tracker triggers and manual status overrides.',
    '🔁 Segmented View Switcher Navbar: Added a premium glassmorphic navbar switcher at the top of the workspace to toggle between the main syllabus Chapter Table and the Recent Activity dashboard like separate pages.',
    '🔍 Search-to-Chapter Page Routing: Selecting a chapter from search query suggestions or overlays automatically redirects you to the Chapter Table view tab and scrolls/highlights the corresponding row.'
  ],
  clientChanges: [
    '🎯 Subject Chapter sorting: Added a custom sort selector in the subject table headers to sort chapters alphabetically (A-Z) or by Master Score (Ascending/Descending).',
    '💾 Persistent Sorting Preferences: Your chosen sort criteria is automatically saved in browser local storage and loaded when you return to the app or switch subjects.',
    '🗂️ Categorized Section Grouping: Chapters are divided into "Active Chapters" (those with progress) and "No Data Available" (unstarted chapters) divider rows, where score-sorting only reorganizes started chapters.',
    '🛡️ Thicker Master Status Bar Outline: The row segmented progress bars are now 3.5px thick and have a dark top-border outline to guarantee sharp contrast on light dashboard backgrounds.'
  ],
  actionRequired: [
    'Please refresh your dashboard page and verify that your browser Chrome extension has updated to version 2.3.1 to get these dashboard routing and sorting upgrades.'
  ]
};
