import React from "react";

/**
 * PUBLIC_INTERFACE
 * Toolbar
 * Static toolbar with PNG export action.
 */
export default function Toolbar({
  onDownloadPng,
}) {
  return (
    <div className="toolbar">
      <div className="title">Project Gantt (Static)</div>
      <button className="btn primary" onClick={onDownloadPng}>
        Download PNG
      </button>
    </div>
  );
}
