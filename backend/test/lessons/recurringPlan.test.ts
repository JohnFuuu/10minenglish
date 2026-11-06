import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import { planRecurringOccurrences } from '../../src/services/lessonBooking.js';

const TZ = 'Pacific/Auckland';
// Wed 4 Nov 2099, 3pm in Auckland.
const anchor = DateTime.fromObject({ year: 2099, month: 11, day: 4, hour: 15 }, { zone: TZ });
const days = (dates: Date[]) => dates.map((d) => DateTime.fromJSDate(d).setZone(TZ).toFormat('ccc d'));

describe('planRecurringOccurrences — daily with chosen weekdays', () => {
  it('uses every day when all seven are ticked', () => {
    const plan = planRecurringOccurrences(anchor.toJSDate(), { type: 'daily', weekdays: [1, 2, 3, 4, 5, 6, 7] }, false, 5, TZ);
    expect(days(plan)).toEqual(['Wed 4', 'Thu 5', 'Fri 6', 'Sat 7', 'Sun 8']);
  });

  it('only uses the ticked weekdays after the first date', () => {
    // Mon + Fri only.
    const plan = planRecurringOccurrences(anchor.toJSDate(), { type: 'daily', weekdays: [1, 5] }, false, 4, TZ);
    expect(days(plan)).toEqual(['Wed 4', 'Fri 6', 'Mon 9', 'Fri 13']);
  });

  it('always keeps the original date, even when its weekday is not ticked', () => {
    const plan = planRecurringOccurrences(anchor.toJSDate(), { type: 'daily', weekdays: [6, 7] }, false, 3, TZ);
    expect(days(plan)).toEqual(['Wed 4', 'Sat 7', 'Sun 8']);
  });

  it('keeps the same clock time across a daylight-saving change', () => {
    // Auckland DST starts last Sunday of Sept; plan across it.
    const sept = DateTime.fromObject({ year: 2099, month: 9, day: 24, hour: 15 }, { zone: TZ });
    const plan = planRecurringOccurrences(sept.toJSDate(), { type: 'daily', weekdays: [1, 2, 3, 4, 5, 6, 7] }, false, 7, TZ);
    expect(plan.map((d) => DateTime.fromJSDate(d).setZone(TZ).hour)).toEqual([15, 15, 15, 15, 15, 15, 15]);
  });

  it('with no weekdays ticked, plans just the original date instead of looping forever', () => {
    const plan = planRecurringOccurrences(anchor.toJSDate(), { type: 'daily', weekdays: [] }, false, 4, TZ);
    expect(days(plan)).toEqual(['Wed 4']);
  });
});

describe('planRecurringOccurrences — every X weeks', () => {
  it('steps by the chosen number of weeks, weekends included', () => {
    const sat = anchor.plus({ days: 3 });
    const plan = planRecurringOccurrences(sat.toJSDate(), { type: 'weekly', everyWeeks: 2 }, false, 3, TZ);
    expect(days(plan)).toEqual(['Sat 7', 'Sat 21', 'Sat 5']);
  });

  it('every 4 weeks', () => {
    const plan = planRecurringOccurrences(anchor.toJSDate(), { type: 'weekly', everyWeeks: 4 }, false, 3, TZ);
    expect(plan.map((d) => DateTime.fromJSDate(d).setZone(TZ).toISODate())).toEqual(['2099-11-04', '2099-12-02', '2099-12-30']);
  });
});

describe('planRecurringOccurrences — requests from the previous app version', () => {
  it('daily with weekends off still skips Sat/Sun', () => {
    const fri = anchor.plus({ days: 2 });
    const plan = planRecurringOccurrences(fri.toJSDate(), { type: 'daily' }, false, 3, TZ);
    expect(days(plan)).toEqual(['Fri 6', 'Mon 9', 'Tue 10']);
  });

  it('weekly with no week count means every week', () => {
    const plan = planRecurringOccurrences(anchor.toJSDate(), { type: 'weekly' }, true, 2, TZ);
    expect(days(plan)).toEqual(['Wed 4', 'Wed 11']);
  });
});
