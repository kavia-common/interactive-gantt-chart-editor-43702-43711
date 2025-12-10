import React, { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import './styles/theme.css';
import Toolbar from './components/Toolbar';
import GanttChart from './components/GanttChart';
import { parseCsvToTasks, exportTasksToCsv } from './utils/csv';
import { fitDomainToTasks, zoomDomain } from './utils/time';
import domtoimage from 'dom-to-image-more';

/**
 * PUBLIC_INTERFACE
 * App
 * Entry point rendering the toolbar and interactive Gantt chart.
 */
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
