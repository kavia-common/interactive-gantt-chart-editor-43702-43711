import React, { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import './styles/theme.css';
import Toolbar from './components/Toolbar';
import GanttChart from './components/GanttChart';
import { parseCsvToTasks } from './utils/csv';
import { fitDomainToTasks } from './utils/time';
import domtoimage from 'dom-to-image-more';

/**
 * PUBLIC_INTERFACE
 * App
 * Static, image-accurate Gantt: auto-loads CSV from public, disables edits,
 * and supports PNG export of the on-screen view.
 */
function App() {
  const [tasks, setTasks] = useState([]);
  const [domain, setDomain] = useState(fitDomainToTasks([]));
  const chartContainerRef = useRef(null);

  // Auto-load CSV from public folder on startup
  useEffect(() => {
    const CSV_URL = `${process.env.PUBLIC_URL || ''}/Sprint_Document.csv`;
    fetch(CSV_URL)
      .then((r) => r.text())
      .then((text) => {
        const t = parseCsvToTasks(text);
        setTasks(t);
        setDomain(fitDomainToTasks(t));
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('Failed to load CSV:', err);
      });
  }, []);

  // PUBLIC_INTERFACE
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

  const chartWrapperMemo = useMemo(() => ({ ref: chartContainerRef }), []);

  return (
    <div className="app-shell">
      <Toolbar onDownloadPng={handleDownloadPng} />
      <div className="content">
        <div ref={chartWrapperMemo.ref}>
          <GanttChart
            tasks={tasks}
            externalDomain={domain}
            onDomainChange={setDomain}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
