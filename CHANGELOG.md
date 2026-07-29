# Unreleased
- Fix recurrence settings typed into a field being discarded on mobile: changing e.g. the interval from every 1 minute to every 5 minutes now persists. The dialog saved a field only once it was committed (blur/Enter), which never happens on mobile because the OK button is a native control outside the dialog's WebView
- Add end-to-end coverage for the mobile dialog hosting model, alongside the existing real-app desktop tests
- Reset the alarm of a repeating to-do that was never marked done: when an occurrence passes, the alarm is re-armed on the next one, the to-do stays open and its sub-tasks keep their progress. Controlled by the new "Reset the alarm even when the to-do is not done" setting, which is on by default — turn it off for the previous completion-only behaviour
- Store recurrence settings in Joplin note userData (synchronised, invisible) instead of YAML frontmatter in the note body; one-time automatic migration of existing frontmatter
- Drive recurrence from Joplin's to-do alarm: advance the alarm/due date on completion via note-change and alarm-trigger events, with a periodic sweep as a safety net
- Fix `getNextDateAfter` (it never returned a value) and overdue-todo handling
- Add a Jest test suite (model date-math, userData storage + migration, recurrence engine)

# 0.11.0
- Add Changelog
- Add menu option to reschedule overdue todos to today