# Unreleased
- Add a "Remove all recurrence settings from all to-dos" toggle to the plugin settings: a confirmed one-shot action that clears the recurrence settings of every to-do at once and then switches itself back off. To-dos keep their alarms, contents and completion state - they just stop repeating
- Reset the alarm of a repeating to-do that was never marked done: when an occurrence passes, the alarm is re-armed on the next one, the to-do stays open and its sub-tasks keep their progress. This is a per-to-do option ("Move the alarm on even when this To-Do is not done") in the recurrence dialog and is off by default, so it never changes to-dos you did not tick it on — including every recurrence created before the option existed
- Store recurrence settings in Joplin note userData (synchronised, invisible) instead of YAML frontmatter in the note body; one-time automatic migration of existing frontmatter
- Drive recurrence from Joplin's to-do alarm: advance the alarm/due date on completion via note-change and alarm-trigger events, with a periodic sweep as a safety net
- Fix `getNextDateAfter` (it never returned a value) and overdue-todo handling
- Add a Jest test suite (model date-math, userData storage + migration, recurrence engine)

# 0.11.0
- Add Changelog
- Add menu option to reschedule overdue todos to today