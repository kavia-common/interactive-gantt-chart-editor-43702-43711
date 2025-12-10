import React, { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { addDays, differenceInCalendarDays, format } from "date-fns";
import { daysBetweenInclusive, fitDomainToTasks, makeTimeScale } from "../utils/time";

// Dimensions
const ROW_HEIGHT = 40;
const BAR_HEIGHT = 22;
const LEFT_COL_WIDTH = 260;
const DAY_COL_WIDTH = 80;

/**
 * PUBLIC_INTERFACE
 * GanttChart
 * Renders a Gantt chart with draggable/resizable tasks and inline name editing.
 */
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
