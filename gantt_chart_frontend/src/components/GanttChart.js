import React, { useEffect, useMemo, useRef, useState } from "react";
import { differenceInCalendarDays, startOfDay } from "date-fns";
import { fitDomainToTasks, makeTimeScale, buildWeeklyTicks, roundDomainToWeeks } from "../utils/time";

const ROW_HEIGHT = 46;
const BAR_HEIGHT = 20;
const LEFT_COL_WIDTH = 260;
const WEEK_COL_WIDTH = 80;

/**
 * PUBLIC_INTERFACE
 * GanttChart
 * Renders a STATIC (non-editable) Gantt chart using weekly columns and
 * styling consistent with the provided reference image.
 */
export default function GanttChart({
  tasks,
  externalDomain,
  onDomainChange
}) {
  const wrapperRef = useRef(null);
  const svgRef = useRef(null);
  const [internalDomain, setInternalDomain] = useState(fitDomainToTasks(tasks));
  const domain = externalDomain || internalDomain;

  useEffect(() => {
    // Adjust domain when tasks change
    const fit = fitDomainToTasks(tasks);
    setInternalDomain(fit);
    onDomainChange?.(fit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  const [width, height] = useContainerSize(wrapperRef);

  // Basic layout measurements
  const viewportTimelineWidth = Math.max(LEFT_COL_WIDTH, width - LEFT_COL_WIDTH);
  const rowCount = tasks.length || 1;
  const headerHeight = 42;
  const chartHeight = rowCount * ROW_HEIGHT;

  // Domain rounded to full weeks to align grid
  const roundedDomain = useMemo(() => roundDomainToWeeks(domain), [domain]);

  // Build weekly ticks and computed virtual width (fixed density per ref)
  const weeks = useMemo(() => buildWeeklyTicks(roundedDomain), [roundedDomain]);
  const weeksCount = Math.max(1, weeks.length);
  const virtualTimelineWidth = weeksCount * WEEK_COL_WIDTH;

  // time scale maps domain to virtual width keeping strict density
  const xScale = useMemo(() => {
    return makeTimeScale(roundedDomain[0], roundedDomain[1], virtualTimelineWidth);
  }, [roundedDomain, virtualTimelineWidth]);

  // Render
  return (
    <div className="gantt-wrapper" ref={wrapperRef}>
      {/* Top header band with weekly labels */}
      <div className="gantt-header">
        <div className="left">Task</div>
        <div className="timeline">
          <div className="timeline-scale" style={{ width: virtualTimelineWidth }}>
            {weeks.map((_, i) => (
              <div key={i} className="timeline-tick">
                {`W${i + 1}`}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="gantt-body">
        {/* Left task names */}
        <div className="gantt-left">
          {tasks.map((t) => (
            <div className="row" key={t.id} title={t.name}>
              <div className="task-name">{t.name}</div>
            </div>
          ))}
        </div>

        {/* Right timeline */}
        <div className="gantt-right">
          <svg ref={svgRef} width={virtualTimelineWidth} height={chartHeight}>
            {/* Weekly vertical grid lines */}
            {weeks.map((w, i) => {
              const x = xScale(w);
              return <line key={`v${i}`} x1={x} y1={0} x2={x} y2={chartHeight} className="grid-v" />;
            })}

            {/* Horizontal row dividers */}
            {tasks.map((_, idx) => {
              const y = (idx + 1) * ROW_HEIGHT;
              return <line key={`h${idx}`} x1={0} y1={y} x2={virtualTimelineWidth} y2={y} className="grid-h" />;
            })}

            {/* Optional today marker if inside domain */}
            {(() => {
              const today = startOfDay(new Date());
              if (today >= roundedDomain[0] && today <= roundedDomain[1]) {
                const x = xScale(today);
                return <line x1={x} y1={0} x2={x} y2={chartHeight} className="today" />;
              }
              return null;
            })()}

            {/* Task bars and milestone stars */}
            {tasks.map((t, idx) => {
              const y = idx * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2;
              const x = xScale(t.start);
              const w = Math.max(8, xScale(t.end) - xScale(t.start));
              const isMilestone = differenceInCalendarDays(t.end, t.start) <= 0 || looksLikeMilestone(t);

              if (isMilestone) {
                const cx = x + w; // place star at end
                const cy = y + BAR_HEIGHT / 2;
                const points = starPoints(cx, cy, 5, 8, 4);
                return (
                  <g key={t.id}>
                    <polygon points={points} fill="#10B981" stroke="#0f766e" strokeWidth="1" />
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
                  />
                  {/* label hidden in CSS for pixel parity; still include title for a11y */}
                  <title>{t.name}</title>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
      <div className="info">
        {tasks.length === 0 ? "Loading CSV data..." : `${tasks.length} task(s).`}
      </div>
    </div>
  );
}

/**
 * PUBLIC_INTERFACE
 * starPoints
 * Returns a polygon points string for a star centered at (cx,cy).
 */
function starPoints(cx, cy, spikes = 5, outerRadius = 8, innerRadius = 4) {
  const step = Math.PI / spikes;
  let rotation = Math.PI / 2 * 3;
  let x = cx;
  let y = cy;
  const points = [];
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rotation) * outerRadius;
    y = cy + Math.sin(rotation) * outerRadius;
    points.push(`${x},${y}`);
    rotation += step;

    x = cx + Math.cos(rotation) * innerRadius;
    y = cy + Math.sin(rotation) * innerRadius;
    points.push(`${x},${y}`);
    rotation += step;
  }
  return points.join(" ");
}

/**
 * Consider strings like "Release", "Go-Live" as milestones.
 */
function looksLikeMilestone(t) {
  const raw = t.raw || {};
  const blob = [
    t.name || "",
    raw.Activities || "",
    raw.Deliverables || "",
    raw["Activities"] || "",
    raw["Deliverables"] || ""
  ].join(" ").toLowerCase();

  return (
    blob.includes("release") ||
    blob.includes("go-live") ||
    blob.includes("milestone")
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
