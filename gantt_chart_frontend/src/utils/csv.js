import Papa from "papaparse";
import { addDays, addWeeks, isValid, parse, parseISO } from "date-fns";

/**
 * PUBLIC_INTERFACE
 * parseCsvToTasks
 * Parses CSV text into normalized task objects.
 */
export function parseCsvToTasks(csvText) {
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  const rows = parsed.data || [];
  let idCounter = 1;

  const tasks = rows.map((r) => {
    const name =
      r.Task ||
      r.Sprint ||
      r.Name ||
      r["Task Name"] ||
      `${r.Phase || "Task"} ${idCounter}`;
    const assignee = r.Assignee || r.Owner || r["Assignee/Owner"] || "";
    const progress = parseFloat(r.Progress || r["% Complete"] || "0") || 0;

    // Try robust date parsing: prefer explicit dates, else compute from weeks if provided
    let start = tryParseDate(r.Start || r["Start Date"] || r["Start"]);
    let end = tryParseDate(r.End || r["End Date"] || r["End"]);

    if (!start || !end) {
      const startWeek = toInt(r["Start Week"] || r["StartWeek"] || r["Start_Week"]);
      const endWeek = toInt(r["End Week"] || r["EndWeek"] || r["End_Week"]);
      const durationWeeks = toInt(r["Duration (Weeks)"] || r.Duration || r["Weeks"]);
      const base = parseBaseDate(r.Base || r["Base Date"]) || startOfYearToday();
      if (startWeek && endWeek) {
        start = addWeeks(base, startWeek - 1);
        end = addWeeks(base, endWeek);
      } else if (startWeek && durationWeeks) {
        start = addWeeks(base, startWeek - 1);
        end = addWeeks(start, durationWeeks);
      }
    }

    if (!start || !end) {
      // Fallback to make something visible
      start = startOfYearToday();
      end = addDays(start, 7);
    }

    // Normalize to midnight for consistency
    start = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    end = new Date(end.getFullYear(), end.getMonth(), end.getDate());

    const id = r.id || r.ID || `t-${idCounter++}`;

    return {
      id: String(id),
      name: String(name),
      start,
      end,
      assignee,
      progress: Math.max(0, Math.min(100, progress)),
      dependencies: (r.Dependencies || r.Dependency || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      raw: r,
    };
  });

  return tasks;
}

/**
 * PUBLIC_INTERFACE
 * exportTasksToCsv
 * Serializes tasks to a CSV string.
 */
export function exportTasksToCsv(tasks) {
  const rows = tasks.map((t) => ({
    id: t.id,
    name: t.name,
    start: t.start.toISOString().substring(0, 10),
    end: t.end.toISOString().substring(0, 10),
    assignee: t.assignee || "",
    progress: t.progress ?? 0,
    dependencies: (t.dependencies || []).join(","),
  }));
  return Papa.unparse(rows);
}

function tryParseDate(v) {
  if (!v) return null;
  if (v instanceof Date) return isValid(v) ? v : null;
  // Try ISO first
  const iso = parseISO(String(v));
  if (isValid(iso)) return iso;

  // Common formats
  const fmts = ["yyyy-MM-dd", "MM/dd/yyyy", "dd/MM/yyyy", "yyyy/MM/dd"];
  for (const f of fmts) {
    const d = parse(String(v), f, new Date());
    if (isValid(d)) return d;
  }
  // As number days offset
  const n = Number(v);
  if (!Number.isNaN(n)) {
    return addDays(startOfYearToday(), n);
  }
  return null;
}

function toInt(v) {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

function startOfYearToday() {
  const now = new Date();
  return new Date(now.getFullYear(), 0, 1);
}

function parseBaseDate(v) {
  if (!v) return null;
  const d = tryParseDate(v);
  return d && isValid(d) ? d : null;
}
