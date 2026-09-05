# CalBot UI context

The existing runtime source of truth is `app/globals.css`; this document records its direction without generating or duplicating tokens.

The admin interface is a compact Ukrainian-language activity dashboard. Preserve the existing paper surfaces (`--paper`, `--paper-strong`), dark text (`--ink`, `--text`), muted captions (`--muted`), thin borders (`--line`, `--line-strong`), and blue data bars (`--blue`). Inherit application typography; use tabular numbers for daily data. Admin cards and controls use the existing 8px radius, with a 1180px maximum shell and mobile gutters.

Notification statistics use native date inputs: calendar popup language and geometry belong to the browser. Period buttons reuse the admin filter appearance; arrow buttons have accessible labels. Weeks run Monday–Sunday; months cover calendar months. Date-only arithmetic is independent of browser timezone; server boundaries and grouping use `DASHBOARD_TIME_ZONE` (default Europe/Kyiv). The selected range applies to summary, daily chart, and paginated events. Committed dates and period mode are restored from URL parameters. Empty days remain visible with zero counts; charts show exact counts and dates without relying on hover. Long charts scroll within their panel. Loading and failures replace chart data, with retry on failure.

Reference workflows: `app/admin/notification-stats/NotificationStatsClient.tsx`, `app/stats/StatsClient.tsx`. Preserve existing product styling rather than introducing a new visual system for an admin feature.
