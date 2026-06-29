export const VINYAS_APP_VERSION = '2.3.2';
export const VINYAS_EXTENSION_VERSION = '2.3.2';

export const WHATS_NEW_CHANGELOG = {
  version: '2.3.2',
  date: 'June 29, 2026',
  coreChanges: [
    '📚 Multi-Book Support: You can now configure multiple textbooks per subject. Each book maintains its own set of chapter-to-URL mappings independently.',
    '⚙️ Book Settings Panel: New gear icon next to each subject header opens a dedicated configuration modal — add new textbooks, view mapped chapter counts, and delete books with cascading chapter link cleanup.',
    '🔗 Bulk Chapter Link Editor: Clicking the book icon on any chapter now opens a unified editor showing all configured textbooks, letting you set or clear reading URLs for that chapter across all books in one go.'
  ],
  clientChanges: [
    '📖 Active Book Selector: When multiple books are configured, a dropdown lets you switch the active textbook view without navigating away. Your choice is remembered across sessions via localStorage.',
    '🔄 Textbook Sync from Extension: The SYNC and Add Chapter buttons on PW Books pages now support linking to any of your configured textbooks, not just a single default book.',
    '🛠️ UI Overflow Fix: Fixed dropdown menus getting clipped inside sticky subject headers by dynamically toggling overflow visibility.'
  ],
  actionRequired: [
    'Please refresh your dashboard and update your Chrome extension to version 2.3.2 to get the new multi-book configuration features.'
  ]
};
