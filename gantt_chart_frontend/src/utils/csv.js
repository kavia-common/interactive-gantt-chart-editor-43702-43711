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
    const name = r.Task || r.Sprint || r.Name || r["Task Name"] || `${r.Phase || "Task"} ${idCounter}`;
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
      raw: r
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
    dependencies: (t.dependencies || []).join(",")
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
```

Explanation: Create time helpers for zooming and scaling based on date-fns and d3
````write file="interactive-gantt-chart-editor-43702-43711/gantt_chart_frontend/src/utils/time.js"
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
```

Explanation: Implement Toolbar component with CSV import/export and image download + zoom controls
````write file="interactive-gantt-chart-editor-43702-43711/gantt_chart_frontend/src/components/Toolbar.js"
import React, { useRef } from "react";

// PUBLIC_INTERFACE
export default function Toolbar({
  onImportCsv,
  onExportCsv,
  onDownloadPng,
  onZoomIn,
  onZoomOut,
  onZoomToFit
}) {
  const fileRef = useRef(null);

  const handleSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onImportCsv?.(String(reader.result || ""));
      e.target.value = "";
    };
    reader.readAsText(file);
  };

  return (
    <div className="toolbar">
      <div className="title">Interactive Gantt</div>
      <input
        type="file"
        accept=".csv,text/csv"
        ref={fileRef}
        style={{ display: "none" }}
        onChange={handleSelect}
      />
      <button className="btn" onClick={() => fileRef.current?.click()}>
        Upload CSV
      </button>
      <button className="btn" onClick={onExportCsv}>
        Export CSV
      </button>
      <button className="btn" onClick={onDownloadPng}>
        Download Image
      </button>
      <span style={{ width: 12 }} />
      <button className="btn" onClick={onZoomOut} aria-label="Zoom Out">−</button>
      <button className="btn" onClick={onZoomIn} aria-label="Zoom In">+</button>
      <button className="btn primary" onClick={onZoomToFit}>Zoom to Fit</button>
    </div>
  );
}
```

Explanation: Implement GanttChart component with SVG bars, drag/resize, inline edit, and header timeline
````write file="interactive-gantt-chart-editor-43702-43711/gantt_chart_frontend/src/components/GanttChart.js"
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { addDays, differenceInCalendarDays, format } from "date-fns";
import { daysBetweenInclusive, fitDomainToTasks, makeTimeScale } from "../utils/time";

// Dimensions
const ROW_HEIGHT = 40;
const BAR_HEIGHT = 22;
const LEFT_COL_WIDTH = 260;
const DAY_COL_WIDTH = 80;

// PUBLIC_INTERFACE
export default function GanttChart({
  tasks,
  onTasksChange,
  externalDomain,
  onDomainChange
}) {
  const wrapperRef = useRef(null);
  const svgRef = useRef(null);
  const [internalDomain, setInternalDomain] = useState(fitDomainToTasks(tasks));
  const domain = externalDomain || internalDomain;

  useEffect(() => {
    // Adjust when tasks change
    if (!externalDomain) {
      const fit = fitDomainToTasks(tasks);
      setInternalDomain(fit);
      onDomainChange?.(fit);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  const [width, height] = useContainerSize(wrapperRef);
  const timelineWidth = Math.max(LEFT_COL_WIDTH, width - LEFT_COL_WIDTH);
  const chartHeight = Math.max(tasks.length * ROW_HEIGHT, height - 36);

  const xScale = useMemo(() => {
    return makeTimeScale(domain[0], domain[1], timelineWidth);
  }, [domain, timelineWidth]);

  // Create ticks for days (auto-fit)
  const days = useMemo(() => {
    const totalDays = Math.max(1, differenceInCalendarDays(domain[1], domain[0]) + 1);
    const cols = Math.ceil(timelineWidth / DAY_COL_WIDTH);
    const step = Math.max(1, Math.floor(totalDays / cols));
    const arr = [];
    let d = new Date(domain[0]);
    while (d <= domain[1]) {
      arr.push(new Date(d));
      d = addDays(d, step);
    }
    return arr;
  }, [domain, timelineWidth]);

  // Drag logic
  const dragState = useRef({ type: null, taskId: null, offsetMs: 0 });

  function updateTask(id, updater) {
    const next = tasks.map((t) => (t.id === id ? { ...t, ...updater(t) } : t));
    onTasksChange?.(next);
  }

  function onMouseDownBar(e, task, edge) {
    e.stopPropagation();
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    // Capture initial pointer and date
    const x0 = xScale(task.start);
    const offset = e.clientX - (x0 + (edge === "right" ? xScale(task.end) - xScale(task.start) : 0));
    dragState.current = {
      type: edge || "move",
      taskId: task.id,
      offsetPx: offset
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp, { once: true });
  }

  function onMouseMove(e) {
    const state = dragState.current;
    if (!state.taskId) return;
    const task = tasks.find((t) => t.id === state.taskId);
    if (!task) return;

    const px = e.clientX - (svgRef.current?.getBoundingClientRect().left || 0);
    const pxClamped = Math.max(0, Math.min(timelineWidth, px - state.offsetPx));
    const dateAtCursor = xScale.invert(pxClamped);
    if (state.type === "move") {
      const duration = differenceInCalendarDays(task.end, task.start);
      const newStart = startOfDay(dateAtCursor);
      const newEnd = addDays(newStart, Math.max(1, duration));
      updateTask(task.id, () => ({ start: newStart, end: newEnd }));
    } else if (state.type === "left") {
      // Resize left
      let newStart = startOfDay(dateAtCursor);
      if (newStart >= task.end) {
        newStart = addDays(task.end, -1);
      }
      updateTask(task.id, () => ({ start: newStart, end: task.end }));
    } else if (state.type === "right") {
      let newEnd = startOfDay(dateAtCursor);
      if (newEnd <= task.start) {
        newEnd = addDays(task.start, 1);
      }
      updateTask(task.id, () => ({ start: task.start, end: newEnd }));
    }
  }

  function onMouseUp() {
    dragState.current = { type: null, taskId: null, offsetMs: 0 };
    window.removeEventListener("mousemove", onMouseMove);
  }

  // Inline edit state
  const [editingId, setEditingId] = useState(null);
  const [tempName, setTempName] = useState("");

  function handleNameDblClick(task) {
    setEditingId(task.id);
    setTempName(task.name);
  }

  function commitName(task) {
    const name = tempName.trim();
    if (name && name !== task.name) {
      updateTask(task.id, () => ({ name }));
    }
    setEditingId(null);
  }

  // Render
  return (
    <div className="gantt-wrapper" ref={wrapperRef}>
      <div className="gantt-header">
        <div className="left">Task</div>
        <div className="timeline">
          <div className="timeline-scale" style={{ width: timelineWidth }}>
            {days.map((d, i) => (
              <div key={i} className="timeline-tick">
                {format(d, "MMM d")}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="gantt-body">
        <div className="gantt-left">
          {tasks.map((t) => (
            <div className="row" key={t.id} title={t.name}>
              {editingId === t.id ? (
                <input
                  className="inline-input"
                  autoFocus
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onBlur={() => commitName(t)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitName(t);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                />
              ) : (
                <div
                  className="task-name"
                  onDoubleClick={() => handleNameDblClick(t)}
                >
                  {t.name}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="gantt-right">
          <svg ref={svgRef} width={timelineWidth} height={chartHeight}>
            {/* Bars */}
            {tasks.map((t, idx) => {
              const y = idx * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2;
              const x = xScale(t.start);
              const w = Math.max(8, xScale(t.end) - xScale(t.start));
              const progressWidth = Math.max(0, Math.min(100, t.progress || 0)) / 100 * w;
              return (
                <g key={t.id} transform={`translate(${x}, ${y})`}>
                  <rect
                    className="bar"
                    x={0}
                    y={0}
                    width={w}
                    height={BAR_HEIGHT}
                    rx={6}
                    ry={6}
                    onMouseDown={(e) => onMouseDownBar(e, t, "move")}
                  />
                  <rect className="progress" x={0} y={0} width={progressWidth} height={BAR_HEIGHT} />
                  <text className="label" x={8} y={BAR_HEIGHT / 2 + 4} fill="#fff">
                    {t.name}
                  </text>

                  {/* Handles */}
                  <rect
                    className="handle left"
                    x={-3}
                    y={0}
                    width={6}
                    height={BAR_HEIGHT}
                    onMouseDown={(e) => onMouseDownBar(e, t, "left")}
                  />
                  <rect
                    className="handle right"
                    x={w - 3}
                    y={0}
                    width={6}
                    height={BAR_HEIGHT}
                    onMouseDown={(e) => onMouseDownBar(e, t, "right")}
                  />
                </g>
              );
            })}
          </svg>
        </div>
      </div>
      <div className="info">
        {tasks.length === 0 ? "Use Upload CSV to load tasks." : `${tasks.length} task(s). Drag to move, resize edges to adjust duration, double-click names to edit.`}
      </div>
    </div>
  );
}

function useContainerSize(ref) {
  const [size, setSize] = useState([800, 600]);
  useEffect(() => {
    function update() {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      setSize([rect.width, rect.height]);
    }
    update();
    const ro = new ResizeObserver(update);
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
```

Explanation: Wire the new components into the App, manage state, zoom, CSV and image export, and initial theme
````edit file="interactive-gantt-chart-editor-43702-43711/gantt_chart_frontend/src/App.js"
<<<<<<< SEARCH
import React, { useState, useEffect } from 'react';
import logo from './logo.svg';
import './App.css';

// PUBLIC_INTERFACE
function App() {
  const [theme, setTheme] = useState('light');

  // Effect to apply theme to document element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // PUBLIC_INTERFACE
  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  return (
    <div className="App">
      <header className="App-header">
        <button 
          className="theme-toggle" 
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
        </button>
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.js</code> and save to reload.
        </p>
        <p>
          Current theme: <strong>{theme}</strong>
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
    </div>
  );
}

export default App;
=======
import React, { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import './styles/theme.css';
import Toolbar from './components/Toolbar';
import GanttChart from './components/GanttChart';
import { parseCsvToTasks, exportTasksToCsv } from './utils/csv';
import { fitDomainToTasks, zoomDomain } from './utils/time';
import domtoimage from 'dom-to-image-more';

// PUBLIC_INTERFACE
function App() {
  // theme (light default, aligns with Ocean Professional styling)
  const [theme, setTheme] = useState('light');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // tasks state
  const [tasks, setTasks] = useState([]);
  // timeline domain
  const [domain, setDomain] = useState(fitDomainToTasks([]));

  const chartContainerRef = useRef(null);

  // PUBLIC_INTERFACE
  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  function handleImportCsv(text) {
    const t = parseCsvToTasks(text);
    setTasks(t);
    const d = fitDomainToTasks(t);
    setDomain(d);
  }

  function handleExportCsv() {
    const csv = exportTasksToCsv(tasks);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gantt_export.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDownloadPng() {
    const node = chartContainerRef.current;
    if (!node) return;
    const dataUrl = await domtoimage.toPng(node, {
      cacheBust: true,
      bgcolor: getComputedStyle(document.documentElement).getPropertyValue('--bg') || '#ffffff',
      quality: 1
    });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'gantt_chart.png';
    a.click();
  }

  function handleZoomIn() {
    setDomain(prev => zoomDomain(prev, 1.5));
  }
  function handleZoomOut() {
    setDomain(prev => zoomDomain(prev, 0.75));
  }
  function handleZoomToFit() {
    setDomain(fitDomainToTasks(tasks));
  }

  // Derive an element that wraps chart for PNG capture
  const chartWrapperMemo = useMemo(() => ({
    ref: chartContainerRef
  }), []);

  return (
    <div className="app-shell">
      <Toolbar
        onImportCsv={handleImportCsv}
        onExportCsv={handleExportCsv}
        onDownloadPng={handleDownloadPng}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomToFit={handleZoomToFit}
      />
      <div className="content">
        <div ref={chartWrapperMemo.ref}>
          <GanttChart
            tasks={tasks}
            onTasksChange={setTasks}
            externalDomain={domain}
            onDomainChange={setDomain}
          />
        </div>
        <div style={{ padding: '0 4px 8px', fontSize: 12 }}>
          <button className="btn" onClick={toggleTheme}>
            {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
>>>>>>> REPLACE
