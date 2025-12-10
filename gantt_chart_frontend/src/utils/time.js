import { differenceInDays, addDays, startOfDay, startOfWeek, endOfWeek, format } from "date-fns";
import * as d3 from "d3";

/**
 * PUBLIC_INTERFACE
 * makeTimeScale
 * Returns a d3 scale for time -> pixel, given domain and width.
 */
export function makeTimeScale(domainStart, domainEnd, width) {
  return d3.scaleTime().domain([domainStart, domainEnd]).range([0, Math.max(1, width)]);
}

/**
 * PUBLIC_INTERFACE
 * zoomDomain
 * Returns a new domain zoomed by factor around centerDate.
 * factor > 1 zooms in, 0 < factor < 1 zooms out.
 */
export function zoomDomain([start, end], factor, centerDate) {
  const msStart = start.getTime();
  const msEnd = end.getTime();
  const center = centerDate ? centerDate.getTime() : (msStart + msEnd) / 2;
  const halfSpan = (msEnd - msStart) / 2 / factor;
  const newStart = new Date(center - halfSpan);
  const newEnd = new Date(center + halfSpan);
  return [newStart, newEnd];
}

/**
 * PUBLIC_INTERFACE
 * fitDomainToTasks
 * Expands domain to fit all tasks with padding days.
 * Domain is rounded to whole weeks (Mon-Sun) to match reference weekly grid.
 */
export function fitDomainToTasks(tasks, paddingDays = 2) {
  if (!tasks || tasks.length === 0) {
    const today = startOfDay(new Date());
    const s = addDays(today, -7);
    const e = addDays(today, 7);
    return roundDomainToWeeks([s, e]);
  }
  let min = tasks[0].start;
  let max = tasks[0].end;
  for (const t of tasks) {
    if (t.start < min) min = t.start;
    if (t.end > max) max = t.end;
  }
  const padded = [addDays(min, -paddingDays), addDays(max, paddingDays)];
  return roundDomainToWeeks(padded);
}

/**
 * PUBLIC_INTERFACE
 * daysBetweenInclusive
 * Count of days (rounded) between dates inclusive of start.
 */
export function daysBetweenInclusive(a, b) {
  return differenceInDays(b, a) + 1;
}

/**
 * PUBLIC_INTERFACE
 * roundDomainToWeeks
 * Rounds [start,end] to align to full weeks with Monday as the start.
 */
export function roundDomainToWeeks([start, end]) {
  const s = startOfWeek(startOfDay(start), { weekStartsOn: 1 });
  const e = endOfWeek(startOfDay(end), { weekStartsOn: 1 });
  return [s, e];
}

/**
 * PUBLIC_INTERFACE
 * buildWeeklyTicks
 * Returns an array of week-start dates between domain (inclusive).
 */
export function buildWeeklyTicks([start, end]) {
  const ticks = [];
  let d = startOfWeek(start, { weekStartsOn: 1 });
  const last = endOfWeek(end, { weekStartsOn: 1 });
  while (d <= last) {
    ticks.push(d);
    d = addDays(d, 7);
  }
  return ticks;
}
