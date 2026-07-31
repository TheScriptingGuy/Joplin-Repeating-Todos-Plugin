import {
	Recurrence,
	recurrenceFromObject,
	recurrenceToObject,
	recurrenceToJSON,
	recurrenceFromJSON,
} from '../src/model/recurrence';

/** Helper: build a Recurrence and apply a set of overrides in one step. */
function makeRecurrence(overrides: Partial<Recurrence>): Recurrence {
	const r = new Recurrence();
	Object.assign(r, overrides);
	return r;
}

describe('Recurrence.getNextDate - simple interval increments', () => {
	const initial = new Date(2026, 0, 1, 9, 0); // Thu Jan 1 2026 09:00

	it('advances by one minute (intervalNumber 1)', () => {
		const r = makeRecurrence({ enabled: true, interval: 'minute', intervalNumber: 1 });
		const next = r.getNextDate(initial)!;
		expect(next.getTime()).toBe(new Date(2026, 0, 1, 9, 1).getTime());
	});

	it('advances by several minutes (intervalNumber > 1)', () => {
		const r = makeRecurrence({ enabled: true, interval: 'minute', intervalNumber: 5 });
		const next = r.getNextDate(initial)!;
		expect(next.getTime()).toBe(new Date(2026, 0, 1, 9, 5).getTime());
	});

	it('advances by one hour', () => {
		const r = makeRecurrence({ enabled: true, interval: 'hour', intervalNumber: 1 });
		const next = r.getNextDate(initial)!;
		expect(next.getTime()).toBe(new Date(2026, 0, 1, 10, 0).getTime());
	});

	it('advances by three hours (intervalNumber > 1)', () => {
		const r = makeRecurrence({ enabled: true, interval: 'hour', intervalNumber: 3 });
		const next = r.getNextDate(initial)!;
		expect(next.getTime()).toBe(new Date(2026, 0, 1, 12, 0).getTime());
	});

	it('advances by one day', () => {
		const r = makeRecurrence({ enabled: true, interval: 'day', intervalNumber: 1 });
		const next = r.getNextDate(initial)!;
		expect(next.getTime()).toBe(new Date(2026, 0, 2, 9, 0).getTime());
	});

	it('advances by ten days (intervalNumber > 1)', () => {
		const r = makeRecurrence({ enabled: true, interval: 'day', intervalNumber: 10 });
		const next = r.getNextDate(initial)!;
		expect(next.getTime()).toBe(new Date(2026, 0, 11, 9, 0).getTime());
	});

	it('advances by one year', () => {
		const r = makeRecurrence({ enabled: true, interval: 'year', intervalNumber: 1 });
		const next = r.getNextDate(initial)!;
		expect(next.getTime()).toBe(new Date(2027, 0, 1, 9, 0).getTime());
	});

	it('advances by two years (intervalNumber > 1)', () => {
		const r = makeRecurrence({ enabled: true, interval: 'year', intervalNumber: 2 });
		const next = r.getNextDate(initial)!;
		expect(next.getTime()).toBe(new Date(2028, 0, 1, 9, 0).getTime());
	});
});

describe('Recurrence.getNextDate - weekly', () => {
	const initial = new Date(2026, 0, 1, 9, 0); // Thursday

	it('with no weekdays set advances by 7 * intervalNumber days, preserving weekday', () => {
		const r = makeRecurrence({ enabled: true, interval: 'week', intervalNumber: 1 });
		const next = r.getNextDate(initial)!;
		expect(next.getTime()).toBe(new Date(2026, 0, 8, 9, 0).getTime());
		expect(next.getDay()).toBe(initial.getDay());
	});

	it('with no weekdays set and intervalNumber > 1 advances by 14 days', () => {
		const r = makeRecurrence({ enabled: true, interval: 'week', intervalNumber: 2 });
		const next = r.getNextDate(initial)!;
		expect(next.getTime()).toBe(new Date(2026, 0, 15, 9, 0).getTime());
		expect(next.getDay()).toBe(initial.getDay());
	});

	it('with specific weekdays (Mon/Wed/Fri) returns the soonest valid weekday strictly after initial', () => {
		// Thu Jan 1 2026 -> soonest of Mon/Wed/Fri after it is Fri Jan 2 2026.
		const r = makeRecurrence({
			enabled: true,
			interval: 'week',
			intervalNumber: 1,
			weekMonday: true,
			weekWednesday: true,
			weekFriday: true,
		});
		const next = r.getNextDate(initial)!;
		expect(next.getDay()).toBe(5); // Friday
		expect(next.getTime()).toBe(new Date(2026, 0, 2, 9, 0).getTime());
		expect(next.getTime()).toBeGreaterThan(initial.getTime());
	});

	it('with a single weekday earlier in the week rolls into the following week', () => {
		// Initial Thu; only Monday selected -> next valid Monday is Jan 5 2026.
		const r = makeRecurrence({
			enabled: true,
			interval: 'week',
			intervalNumber: 1,
			weekMonday: true,
		});
		const next = r.getNextDate(initial)!;
		expect(next.getDay()).toBe(1); // Monday
		expect(next.getTime()).toBe(new Date(2026, 0, 5, 9, 0).getTime());
	});
});

describe('Recurrence.getNextDate - monthly', () => {
	const initial = new Date(2026, 0, 1, 9, 0); // Thu Jan 1 2026

	it('plain monthly advances by one month', () => {
		const r = makeRecurrence({ enabled: true, interval: 'month', intervalNumber: 1 });
		const next = r.getNextDate(initial)!;
		expect(next.getTime()).toBe(new Date(2026, 1, 1, 9, 0).getTime());
	});

	it('plain monthly with intervalNumber > 1 advances by several months', () => {
		const r = makeRecurrence({ enabled: true, interval: 'month', intervalNumber: 3 });
		const next = r.getNextDate(initial)!;
		expect(next.getTime()).toBe(new Date(2026, 3, 1, 9, 0).getTime());
	});

	it('ordinal + weekday: second Friday', () => {
		// Second Friday of Jan 2026 is Jan 9 2026.
		const r = makeRecurrence({
			enabled: true,
			interval: 'month',
			intervalNumber: 1,
			monthOrdinal: 'second',
			monthWeekday: 'friday',
		});
		const next = r.getNextDate(initial)!;
		expect(next.getDay()).toBe(5); // Friday
		expect(next.getTime()).toBe(new Date(2026, 0, 9, 9, 0).getTime());
		expect(next.getTime()).toBeGreaterThan(initial.getTime());
	});

	it('ordinal + weekday: last Monday', () => {
		// Last Monday of Jan 2026 is Jan 26 2026.
		const r = makeRecurrence({
			enabled: true,
			interval: 'month',
			intervalNumber: 1,
			monthOrdinal: 'last',
			monthWeekday: 'monday',
		});
		const next = r.getNextDate(initial)!;
		expect(next.getDay()).toBe(1); // Monday
		expect(next.getTime()).toBe(new Date(2026, 0, 26, 9, 0).getTime());
	});
});

describe('Recurrence.getNextDate - disabled', () => {
	it('returns null when disabled', () => {
		const r = makeRecurrence({ enabled: false, interval: 'day', intervalNumber: 1 });
		expect(r.getNextDate(new Date(2026, 0, 1, 9, 0))).toBeNull();
	});
});

describe('Recurrence.getNextDateAfter', () => {
	it('advances past an after date several intervals ahead and returns a Date strictly greater than after (regression for the never-returned bug)', () => {
		const initial = new Date(2026, 0, 1, 9, 0);
		const after = new Date(2026, 0, 1, 9, 3, 30); // 3.5 minutes ahead
		const r = makeRecurrence({ enabled: true, interval: 'minute', intervalNumber: 1 });
		const result = r.getNextDateAfter(initial, after);
		expect(result).not.toBeNull();
		expect(result!.getTime()).toBeGreaterThan(after.getTime());
		// First minute strictly after 09:03:30 is 09:04.
		expect(result!.getTime()).toBe(new Date(2026, 0, 1, 9, 4).getTime());
	});

	it('returns a date strictly after when after is many days ahead (daily interval)', () => {
		const initial = new Date(2026, 0, 1, 9, 0);
		const after = new Date(2026, 0, 20, 9, 0);
		const r = makeRecurrence({ enabled: true, interval: 'day', intervalNumber: 1 });
		const result = r.getNextDateAfter(initial, after);
		expect(result).not.toBeNull();
		expect(result!.getTime()).toBeGreaterThan(after.getTime());
		expect(result!.getTime()).toBe(new Date(2026, 0, 21, 9, 0).getTime());
	});

	it('does not hang and returns null when disabled', () => {
		const initial = new Date(2026, 0, 1, 9, 0);
		const after = new Date(2030, 0, 1, 9, 0);
		const r = makeRecurrence({ enabled: false, interval: 'minute', intervalNumber: 1 });
		expect(r.getNextDateAfter(initial, after)).toBeNull();
	});

	it('returns a date even when initial is already after the after date', () => {
		const initial = new Date(2026, 0, 10, 9, 0);
		const after = new Date(2026, 0, 1, 9, 0);
		const r = makeRecurrence({ enabled: true, interval: 'day', intervalNumber: 1 });
		const result = r.getNextDateAfter(initial, after);
		expect(result).not.toBeNull();
		expect(result!.getTime()).toBeGreaterThan(after.getTime());
	});

	it('always moves at least one interval on, even when initial is already past after', () => {
		// Returning `initial` untouched here would mean a completed to-do keeps the alarm it just had.
		const initial = new Date(2026, 0, 10, 9, 0);
		const after = new Date(2026, 0, 1, 9, 0);
		const r = makeRecurrence({ enabled: true, interval: 'day', intervalNumber: 1 });
		const result = r.getNextDateAfter(initial, after);
		expect(result!.getTime()).toBe(new Date(2026, 0, 11, 9, 0).getTime());
	});

	it('skips the minute occurrences that already passed (short-interval case)', () => {
		// A to-do that repeats every 5 minutes, ticked off 12 minutes after it was due.
		const initial = new Date(2026, 0, 10, 9, 0);
		const after = new Date(2026, 0, 10, 9, 12);
		const r = makeRecurrence({ enabled: true, interval: 'minute', intervalNumber: 5 });
		const result = r.getNextDateAfter(initial, after);
		expect(result!.getTime()).toBe(new Date(2026, 0, 10, 9, 15).getTime());
	});
});

describe('Recurrence.getNextDate - unusable interval numbers', () => {
	const initial = new Date(2026, 0, 1, 9, 30);

	it('adds a minute interval given as a string instead of concatenating it', () => {
		const r = makeRecurrence({ enabled: true, interval: 'minute' });
		// The dialog's number field reads back as a string: '30' + '5' would be minute 305.
		(r as any).intervalNumber = '5';
		expect(r.getNextDate(initial)!.getTime()).toBe(new Date(2026, 0, 1, 9, 35).getTime());
	});

	it('treats a zero or blank interval number as one, so the date always advances', () => {
		for (const value of [0, '', null, undefined, NaN, -3, 1.7]) {
			const r = makeRecurrence({ enabled: true, interval: 'minute' });
			(r as any).intervalNumber = value;
			// One minute on, whatever nonsense the field held: never standing still.
			expect(r.getNextDate(initial)!.getTime()).toBe(new Date(2026, 0, 1, 9, 31).getTime());
		}
	});
});

describe('Recurrence.updateStopStatus', () => {
	it('number type decrements while above 1', () => {
		const r = makeRecurrence({ enabled: true, stopType: 'number', stopNumber: 3 });
		r.updateStopStatus();
		expect(r.stopNumber).toBe(2);
		expect(r.enabled).toBe(true);
	});

	it('number type disables when stopNumber is 1', () => {
		const r = makeRecurrence({ enabled: true, stopType: 'number', stopNumber: 1 });
		r.updateStopStatus();
		expect(r.enabled).toBe(false);
	});

	it('number type sequence: 2 -> 1 -> disabled', () => {
		const r = makeRecurrence({ enabled: true, stopType: 'number', stopNumber: 2 });
		r.updateStopStatus();
		expect(r.stopNumber).toBe(1);
		expect(r.enabled).toBe(true);
		r.updateStopStatus();
		expect(r.enabled).toBe(false);
	});

	it('date type disables when stopDate is in the past', () => {
		const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
		const r = makeRecurrence({ enabled: true, stopType: 'date', stopDate: past });
		r.updateStopStatus();
		expect(r.enabled).toBe(false);
	});

	it('date type stays enabled when stopDate is in the future', () => {
		const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
		const r = makeRecurrence({ enabled: true, stopType: 'date', stopDate: future });
		r.updateStopStatus();
		expect(r.enabled).toBe(true);
	});

	it('never type leaves recurrence unchanged', () => {
		const r = makeRecurrence({ enabled: true, stopType: 'never', stopNumber: 5 });
		r.updateStopStatus();
		expect(r.enabled).toBe(true);
		expect(r.stopNumber).toBe(5);
	});
});

describe('Object round-trip (recurrenceToObject / recurrenceFromObject)', () => {
	it('preserves all fields', () => {
		const r = makeRecurrence({
			enabled: true,
			interval: 'week',
			intervalNumber: 4,
			weekSunday: true,
			weekMonday: false,
			weekTuesday: true,
			weekWednesday: false,
			weekThursday: true,
			weekFriday: false,
			weekSaturday: true,
			monthOrdinal: 'third',
			monthWeekday: 'wednesday',
			stopType: 'date',
			stopDate: '2027-06-15',
			stopNumber: 9,
			resetAlarmWhenNotDone: true,
		});
		const round = recurrenceFromObject(recurrenceToObject(r));
		expect(recurrenceToObject(round)).toEqual(recurrenceToObject(r));
	});

	it('preserves a null stopDate', () => {
		const r = makeRecurrence({ enabled: true, stopType: 'never', stopDate: null });
		const round = recurrenceFromObject(recurrenceToObject(r));
		expect(round.stopDate).toBeNull();
	});

	it('recurrenceFromObject is null-safe and applies defaults', () => {
		const r = recurrenceFromObject(null);
		expect(r).toBeInstanceOf(Recurrence);
		expect(r.enabled).toBe(false);
		expect(r.interval).toBe('minute');
		expect(r.intervalNumber).toBe(1);
		expect(r.monthOrdinal).toBe('first');
		expect(r.monthWeekday).toBe('');
		expect(r.stopType).toBe('never');
		expect(r.stopDate).toBeNull();
		expect(r.stopNumber).toBe(1);
		expect(r.resetAlarmWhenNotDone).toBe(false);
	});

	it('recurrenceFromObject is undefined-safe', () => {
		const r = recurrenceFromObject(undefined);
		expect(r).toBeInstanceOf(Recurrence);
		expect(r.enabled).toBe(false);
	});

	it('recurrenceFromObject applies defaults for missing partial fields', () => {
		const r = recurrenceFromObject({ enabled: true, interval: 'hour' });
		expect(r.enabled).toBe(true);
		expect(r.interval).toBe('hour');
		// Unspecified fields fall back to class defaults.
		expect(r.intervalNumber).toBe(1);
		expect(r.stopType).toBe('never');
	});

	it('normalises an interval number that arrives as a string or a blank', () => {
		// The dialog stores whatever its number field holds, and that is a string - or nothing at all
		// while it is being retyped.
		expect(recurrenceFromObject({ intervalNumber: '5' as any }).intervalNumber).toBe(5);
		expect(recurrenceFromObject({ intervalNumber: '' as any }).intervalNumber).toBe(1);
		expect(recurrenceFromObject({ intervalNumber: 0 }).intervalNumber).toBe(1);
		expect(recurrenceFromObject({ intervalNumber: -2 }).intervalNumber).toBe(1);
	});

	it('leaves the alarm reset off for recurrences stored before the option existed', () => {
		// Recurrences written by an older version carry no resetAlarmWhenNotDone key, so they must
		// keep the default: an open to-do stays overdue until it is ticked off.
		const r = recurrenceFromObject({ enabled: true, interval: 'day', intervalNumber: 1 });
		expect(r.resetAlarmWhenNotDone).toBe(false);
	});
});

describe('JSON round-trip (recurrenceToJSON / recurrenceFromJSON)', () => {
	it('preserves all fields (dialog serialization contract)', () => {
		const r = makeRecurrence({
			enabled: true,
			interval: 'month',
			intervalNumber: 2,
			weekSunday: true,
			weekMonday: true,
			weekTuesday: false,
			weekWednesday: true,
			weekThursday: false,
			weekFriday: true,
			weekSaturday: false,
			monthOrdinal: 'last',
			monthWeekday: 'friday',
			stopType: 'number',
			stopDate: '2026-12-31',
			stopNumber: 7,
		});
		const json = recurrenceToJSON(r);
		expect(typeof json).toBe('string');
		const round = recurrenceFromJSON(json);
		expect(round.enabled).toBe(r.enabled);
		expect(round.interval).toBe(r.interval);
		expect(round.intervalNumber).toBe(r.intervalNumber);
		expect(round.weekSunday).toBe(r.weekSunday);
		expect(round.weekMonday).toBe(r.weekMonday);
		expect(round.weekTuesday).toBe(r.weekTuesday);
		expect(round.weekWednesday).toBe(r.weekWednesday);
		expect(round.weekThursday).toBe(r.weekThursday);
		expect(round.weekFriday).toBe(r.weekFriday);
		expect(round.weekSaturday).toBe(r.weekSaturday);
		expect(round.monthOrdinal).toBe(r.monthOrdinal);
		expect(round.monthWeekday).toBe(r.monthWeekday);
		expect(round.stopType).toBe(r.stopType);
		expect(round.stopDate).toBe(r.stopDate);
		expect(round.stopNumber).toBe(r.stopNumber);
		expect(round.resetAlarmWhenNotDone).toBe(r.resetAlarmWhenNotDone);
	});

	it('reads back an interval number the dialog wrote as a string', () => {
		// What the dialog's hidden form field actually carries: number inputs are strings.
		const r = recurrenceFromJSON(
			JSON.stringify({ enabled: true, interval: 'minute', intervalNumber: '5' })
		);
		expect(r.intervalNumber).toBe(5);
		expect(r.getNextDate(new Date(2026, 0, 1, 9, 30))!.getTime()).toBe(
			new Date(2026, 0, 1, 9, 35).getTime()
		);
	});

	it('falls back to every 1 interval when the number field was left empty', () => {
		const r = recurrenceFromJSON(
			JSON.stringify({ enabled: true, interval: 'minute', intervalNumber: '' })
		);
		expect(r.intervalNumber).toBe(1);
	});

	it('JSON shape contains exactly the persisted field set', () => {
		const r = new Recurrence();
		const parsed = JSON.parse(recurrenceToJSON(r));
		expect(Object.keys(parsed).sort()).toEqual(
			[
				'enabled',
				'interval',
				'intervalNumber',
				'monthOrdinal',
				'monthWeekday',
				'resetAlarmWhenNotDone',
				'stopDate',
				'stopNumber',
				'stopType',
				'weekFriday',
				'weekMonday',
				'weekSaturday',
				'weekSunday',
				'weekThursday',
				'weekTuesday',
				'weekWednesday',
			].sort(),
		);
	});
});

describe('Recurrence.getString', () => {
	it('returns "Never" when disabled', () => {
		const r = makeRecurrence({ enabled: false });
		expect(r.getString()).toBe('Never');
	});

	it('singular interval (every minute)', () => {
		const r = makeRecurrence({ enabled: true, interval: 'minute', intervalNumber: 1 });
		expect(r.getString()).toBe('Every minute');
	});

	it('plural interval (every 3 days)', () => {
		const r = makeRecurrence({ enabled: true, interval: 'day', intervalNumber: 3 });
		expect(r.getString()).toBe('Every 3 days');
	});

	it('weekly on a single day', () => {
		const r = makeRecurrence({ enabled: true, interval: 'week', intervalNumber: 1, weekSunday: true });
		expect(r.getString()).toBe('Every week on Sunday');
	});

	it('weekly on two days', () => {
		const r = makeRecurrence({
			enabled: true,
			interval: 'week',
			intervalNumber: 1,
			weekMonday: true,
			weekFriday: true,
		});
		expect(r.getString()).toBe('Every week on Monday and Friday');
	});

	it('weekly on three days', () => {
		const r = makeRecurrence({
			enabled: true,
			interval: 'week',
			intervalNumber: 1,
			weekMonday: true,
			weekWednesday: true,
			weekFriday: true,
		});
		expect(r.getString()).toBe('Every week on Monday, Wednesday and Friday');
	});

	it('monthly on the nth weekday', () => {
		const r = makeRecurrence({
			enabled: true,
			interval: 'month',
			intervalNumber: 1,
			monthOrdinal: 'first',
			monthWeekday: 'wednesday',
		});
		expect(r.getString()).toBe('Every month on the first Wednesday');
	});

	it('plural weeks with weekdays', () => {
		const r = makeRecurrence({
			enabled: true,
			interval: 'week',
			intervalNumber: 2,
			weekSunday: true,
		});
		expect(r.getString()).toBe('Every 2 weeks on Sunday');
	});
});
