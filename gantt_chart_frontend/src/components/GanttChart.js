import React, { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { addDays, differenceInCalendarDays, startOfDay } from "date-fns";
import { daysBetweenInclusive, fitDomainToTasks, makeTimeScale, buildWeeklyTicks, roundDomainToWeeks } from "../utils/time";

// Dimensions tuned to reference
const ROW_HEIGHT = 44;
const BAR_HEIGHT = 20;
const LEFT_COL_WIDTH = 260;
// Each week column ~80px like reference
const WEEK_COL_WIDTH = 80;

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

  // Compute viewport and virtual canvas dimensions
  const viewportTimelineWidth = Math.max(LEFT_COL_WIDTH, width - LEFT_COL_WIDTH);
  const rowCount = tasks.length || 1;
  const headerHeight = 36; // matches .timeline-scale height
  const virtualHeight = headerHeight + rowCount * ROW_HEIGHT;
  const viewportHeight = Math.max(virtualHeight, Math.max(240, height - 72)); // ensure reasonable min height
  const chartHeight = rowCount * ROW_HEIGHT;

  // Domain rounded to full weeks to align grid
  const roundedDomain = useMemo(() => roundDomainToWeeks(domain), [domain]);

  // weeks data limited to domain
  const weeks = useMemo(() => buildWeeklyTicks(roundedDomain), [roundedDomain]);

  // Compute virtual width based on time span mapped by a consistent weekly column width
  const weeksCount = Math.max(1, weeks.length);
  const virtualTimelineWidth = weeksCount * WEEK_COL_WIDTH;

  // use a time scale that maps the domain to the virtual timeline width.
  const xScale = useMemo(() => {
    return makeTimeScale(roundedDomain[0], roundedDomain[1], virtualTimelineWidth);
  }, [roundedDomain, virtualTimelineWidth]);

  // viewport width used by header and svg container
  const timelineWidth = Math.min(virtualTimelineWidth, viewportTimelineWidth);

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
    const pxClamped = Math.max(0, Math.min(virtualTimelineWidth, px - state.offsetPx));
    // Snap to day to match grid
    const dateAtCursor = startOfDay(xScale.invert(pxClamped));
    if (state.type === "move") {
      const duration = differenceInCalendarDays(task.end, task.start);
      const newStart = dateAtCursor;
      const newEnd = addDays(newStart, Math.max(1, duration));
      updateTask(task.id, () => ({ start: newStart, end: newEnd }));
    } else if (state.type === "left") {
      // Resize left
      let newStart = dateAtCursor;
      if (newStart >= task.end) {
        newStart = addDays(task.end, -1);
      }
      updateTask(task.id, () => ({ start: newStart, end: task.end }));
    } else if (state.type === "right") {
      let newEnd = dateAtCursor;
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
      {/* Tiered header: top blue band with weeks labels, grid aligned */}
      <div className="gantt-header">
        <div className="left">Task</div>
        <div className="timeline">
          <div className="timeline-scale" style={{ width: Math.max(timelineWidth, virtualTimelineWidth) }}>
            {weeks.map((w, i) => (
              <div key={i} className="timeline-tick">
                {`W${i + 1}`}
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
          <svg ref={svgRef} width={virtualTimelineWidth} height={chartHeight}>
            {/* Weekly vertical grid lines */}
            {weeks.map((w, i) => {
              const x = xScale(w);
              return <line key={`v${i}`} x1={x} y1={0} x2={x} y2={chartHeight} stroke="rgba(229,231,235,0.8)" />;
            })}
            {/* Horizontal row lines */}
            {tasks.map((_, idx) => {
              const y = (idx + 1) * ROW_HEIGHT;
              return <line key={`h${idx}`} x1={0} y1={y} x2={virtualTimelineWidth} y2={y} stroke="rgba(229,231,235,0.8)" />;
            })}

            {/* Today marker */}
            {(() => {
              const today = startOfDay(new Date());
              if (today >= roundedDomain[0] && today <= roundedDomain[1]) {
                const x = xScale(today);
                return <line x1={x} y1={0} x2={x} y2={chartHeight} stroke="#EF4444" strokeWidth="2" strokeDasharray="4 4" />;
              }
              return null;
            })()}

            {/* Bars and milestones */}
            {tasks.map((t, idx) => {
              const y = idx * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2;
              const x = xScale(t.start);
              const w = Math.max(8, xScale(t.end) - xScale(t.start));
              const progressWidth = Math.max(0, Math.min(100, t.progress || 0)) / 100 * w;
              const isMilestone = differenceInCalendarDays(t.end, t.start) <= 0;

              if (isMilestone) {
                const cx = x + WEEK_COL_WIDTH / 2 * 0 + 0; // center at start day
                const cy = y + BAR_HEIGHT / 2 + 2;
                const r = 8;
                return (
                  <g key={t.id} transform={`translate(${x}, ${y})`} onMouseDown={(e)=>onMouseDownBar(e,t,"move")}>
                    <polygon
                      points={`${0},${cy} ${r},${cy - r} ${0},${cy - 2*r} ${-r},${cy - r}`}
                      fill="#10B981"
                      stroke="#0f766e"
                      strokeWidth="1"
                    />
                    <title>{t.name}</title>
                  </g>
                );
              }

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


