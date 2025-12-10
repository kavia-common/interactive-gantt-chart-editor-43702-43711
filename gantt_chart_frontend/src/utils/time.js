import { differenceInDays, addDays } from "date-fns";
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
 */
export function fitDomainToTasks(tasks, paddingDays = 2) {
  if (!tasks || tasks.length === 0) {
    const today = new Date();
    return [addDays(today, -7), addDays(today, 7)];
  }
  let min = tasks[0].start;
  let max = tasks[0].end;
  for (const t of tasks) {
    if (t.start < min) min = t.start;
    if (t.end > max) max = t.end;
  }
  return [addDays(min, -paddingDays), addDays(max, paddingDays)];
}

/**
 * PUBLIC_INTERFACE
 * daysBetweenInclusive
 * Count of days (rounded) between dates inclusive of start.
 */
export function daysBetweenInclusive(a, b) {
  return differenceInDays(b, a) + 1;
}
