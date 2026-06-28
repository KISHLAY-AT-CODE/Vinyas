# Changelog

All notable changes to Vinyas are documented here.  
Versions follow [Semantic Versioning](https://semver.org/).

---

## [2.3.1] — June 28, 2026 · Dynamic Dashboard Pages & Interactive Sorting

### Added
- Standalone Recent Activity view listing the 5 most recently active chapters per subject, based on extension triggers and manual status overrides.
- Glassmorphic segmented navbar switcher to toggle between the Chapter Table and Recent Activity views as separate pages.
- Search-to-chapter routing: selecting a chapter from search suggestions redirects to the Chapter Table and scrolls to the matched row.
- Sort selector per subject header: alphabetical (A–Z) or Master Score (ascending/descending), persisted in localStorage.
- Active and unstarted chapters divided into separate grouping rows; score-sort only reorders started chapters.

### Changed
- Master Status progress bars thickened to 3.5px with a dark top-border outline for guaranteed contrast on light backgrounds.

---

## [2.2.2] — June 23, 2026 · Critical Extension Bug Fixes

### Fixed
- "Finalize & Submit" permanently stuck in a submitting state — required a page reload to recover.
- Full-widget flicker on every keystroke inside the self-analysis form, caused by premature Shadow DOM rebuilds.
- Root cause of infinite re-render loop: `autoSaveProgress()` was calling `render()` before `sendMessage`, orphaning all callbacks.
- `isSubmittingAnalysis` flag added separate from the shared `isSaving` lock so background auto-saves cannot corrupt the submit button state.
- Extension message errors now surface as toast notifications instead of being silently swallowed.
- Save watchdog timeout extended to 8 seconds with clean UI recovery on indefinite network hangs.
- "Save & Pause Timer" overlay now closes immediately on click while the save continues in the background.

---

## [2.1.2] — June 21, 2026 · User-Requested Features

### Added
- Vercel Analytics for real-time usage insights and performance monitoring.
- Re-initializing an assignment now directly edits the database entry (name, type, chapter linkage) without creating entries in the Resolve Submissions queue.
- "Initialize Again" button on the extension widget when assignment name or type is modified — re-links assignments to different chapters instantly.

### Fixed
- Unsaved syllabus state is now flushed on tab close or visibility change via `keepalive` fetch requests, preventing data loss.
- Database save operations queued with `isSavingRef` / `pendingSaveRef` guards — prevents race conditions from overlapping writes.
- Removed emoji icons from extension overlay buttons and backdrop-click dismissal on resolve/sync overlays.
- Removed unreachable code branch in the assignment URL lookup handler.

---

## [2.1.1] — June 2, 2026 · Feature Freeze

### Fixed
- Critical: interactive question states (Difficult / Later) were resetting to Completed on app reload.
- Extension now adapts dynamically to any module practice page without getting stuck on incorrect question counts.

### Changed
- Removed the redundant Leave button from the native PW page and unused diagnostic tools.
- **Project milestone:** Feature development closed at v2.1.1. Further releases are bug fixes, achievements, and user-requested improvements only.

---

## [2.1.0] — June 2, 2026 · Feedback & Reporting

### Added
- Suggest Feature modal: propose ideas or feedback directly to the developer via secure SMTP routing.
- Multi-screenshot attachment: up to 5 screenshots simultaneously in both Bug Report and Suggest Feature modals.

### Changed
- Removed technical terms ("logs", "console") from user-facing popup alerts.
- Removed unused log-clearing options from the diagnostic settings dropdown.

---

## [2.0.0] — June 1, 2026 · Major Update

### Added
- Integrated glassmorphic overlay widget injected directly into PW module practice pages — no split-screen required.
- Draggable, viewport-bounded floating question tracker widget.
- Animated loading spinner overlay with immediate feedback while data loads.
- Sidebar collapse/expand toggle via the Vinyas logo in the header, persisted in localStorage.
- Chrome Extension hides native PW submit buttons via active styling overrides.
- Extension submit button acts as a proxy — programmatically clicks and completes the native PW submission.
- Multi-textbook module support per subject with a glassy dropdown switcher in the subject matrix.
- Chapter rows render direct links to synced PW textbook pages, or prompt a chapter map utility if unlinked.
- Background Service Worker broadcasts live overlay status to all open Vinyas dashboard tabs — eliminates stale-overwrite race conditions.
- Aligned key generation formulas between content script scanners and backend processors for consistent question mappings.
- Cryptographically secure prefix validation on all telemetry routes.

---

## [1.2.5] — May 28, 2026 · Performance & Extension Polish

### Added
- Extension setup page fetches and displays Chrome Extension and Android APK versions and file sizes dynamically from the server.
- Scrollable layout on the extension setup page across all viewport sizes.

### Fixed
- Scroll event handler optimized to eliminate layout thrashing on the syllabus view.
- Module question status now syncs to localStorage in real-time on every click, protecting against accidental progress loss.
- Extension now bypasses already-synced chapters and suppresses prompts on unconfigured pages.

---

## [1.2.4] — May 28, 2026 · UI & Theming

### Added
- Branded loading animation with Vinyas logo and animated progress bar while app data loads.
- Save and Cancel buttons pinned at the bottom of all settings panels — always accessible without scrolling.
- Background image drag-to-position inside the settings preview panel.
- Opacity and blur sliders for custom background images.

### Fixed
- Uploaded background images load at full resolution without automatic blur or zoom.

---

## [1.2.3] — May 28, 2026 · Bug Report & Custom Content

### Added
- Quick-access bug report button beside the Vinyas logo for in-app issue reporting with screenshot attachment.
- Custom chapters: add user-defined chapters to any subject directly from the subject header.

### Fixed
- Progress bar shine animations now only render on hover — no constant flashing.
- Removed stray horizontal scrollbar on the syllabus page.
- Popups and dropdowns no longer clip at viewport edges.

---

## [1.2.2] — May 27, 2026 · Profile & Search

### Added
- Custom username that syncs across all devices via the database profile.
- Collapsible search bar collapses to an icon on narrow viewports.
- Backup prompt surfaces after dismissing the What's New popup.

### Changed
- Vinyas logo updated to a premium gradient font style.

---

## [1.2.1] — May 26, 2026 · Security & Sync Reliability

### Added
- Sync ID used as a secure login passphrase.
- What's New modal on app update showing a summary of new features.
- Outdated extension warning banner in the dashboard header.

### Fixed
- Inactivity countdown now resets correctly on re-login.
- Duplicate chapter names no longer silently drop incoming data — events queue in the Resolve Submissions modal instead.

---

## [1.2.0] — May 25, 2026 · Planning & Privacy

### Added
- Duplicate detection on sync: confirmation prompt to overwrite or skip when duplicate results arrive.
- Empty-state illustrations for new sections before first use.
- Direct "Open in PW" links from progress logs to the source DPP or module.
- Lecture and DPP goals merged into a single card with checkboxes.
- Manual module completion and accuracy tracking in nightly wrap-up.
- In-app bug reporter with description and screenshot — sent securely via SMTP.
- Inactivity warnings at 5 days; account auto-deletion at 6 days (IST calendar days).

---

## [1.1.0] — May 10, 2026 · Sync & Focus

### Added
- Cryptographically secure Sync IDs via `crypto.getRandomValues()`.
- Automated weekly encrypted email backups.
- Pomodoro timer with break cycles and XP rewards.

---

## [1.0.0] — April 20, 2026 · Initial Release

### Added
- Core gamified syllabus tracker dashboard with XP, streaks, and chapter-level progress tracking.
- Chrome Extension companion for automatic PW activity tracking.
