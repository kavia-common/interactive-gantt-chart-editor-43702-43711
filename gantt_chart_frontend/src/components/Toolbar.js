import React, { useRef } from "react";

/**
 * PUBLIC_INTERFACE
 * Toolbar
 * Renders action buttons for CSV import/export, PNG download, and zoom controls.
 */
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
