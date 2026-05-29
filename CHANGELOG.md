# Unreleased
- Store recurrence settings in Joplin note userData (synchronised, invisible) instead of YAML frontmatter in the note body; one-time automatic migration of existing frontmatter
- Drive recurrence from Joplin's to-do alarm: advance the alarm/due date on completion via note-change and alarm-trigger events, with a periodic sweep as a safety net
- Fix `getNextDateAfter` (it never returned a value) and overdue-todo handling
- Add a Jest test suite (model date-math, userData storage + migration, recurrence engine)

# 0.11.0
- Add Changelog
- Add menu option to reschedule overdue todos to today