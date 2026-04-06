import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';

import ElectionMap from './components/ElectionMap';
import PrecinctTooltip from './components/PrecinctTooltip';
import Dashboard from './components/Dashboard';
import ResultsPaster from './components/ResultsPaster';
import { loadAll } from './utils/dataLoader';
import { fetchLiveResults } from './utils/liveFetcher';

const DEFAULT_YEAR = 2025;
const DEFAULT_COMP_YEAR = 2024;
const CENTER = [38.755, -90.68];

function minsAgo(date, now) {
  const diff = Math.floor((now - date) / 60000);
  if (diff < 1) return 'just now';
  if (diff === 1) return '1 min ago';
  return `${diff} mins ago`;
}

export default function App() {
  const [appData, setAppData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [displayYear, setDisplayYear] = useState(DEFAULT_YEAR);
  const [compYear, setCompYear] = useState(DEFAULT_COMP_YEAR);
  const [overlayMode, setOverlayMode] = useState('swing');
  const [liveData, setLiveData] = useState(null);
  const [showPaster, setShowPaster] = useState(false);
  const [hoverInfo, setHoverInfo] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [newDataAt, setNewDataAt] = useState(null);
  const [now, setNow] = useState(() => new Date());

  const lastViewed2026 = useRef(null);

  useEffect(() => {
    loadAll()
      .then(setAppData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    let cancelled = false;

    async function poll() {
      try {
        const result = await fetchLiveResults();
        if (cancelled) return;

        if (result && result.unchanged) return; // nothing changed

        if (result && result.precincts) {
          setLiveData(prev => {
            if (!prev) setDisplayYear(2026); // first result — auto-switch
            return result;
          });
          setNewDataAt(new Date());
          setFetchError(null);
        }
      } catch (err) {
        if (!cancelled) setFetchError(err.message);
      }
    }

    poll();
    const pollInterval = setInterval(poll, 30000);
    // Tick the clock every 30s so "X minutes ago" stays accurate
    const clockInterval = setInterval(() => setNow(new Date()), 30000);
    return () => { cancelled = true; clearInterval(pollInterval); clearInterval(clockInterval); };
  }, [autoRefresh]);

  if (loading) return <div className="loading">Loading election data…</div>;
  if (error) return <div className="loading error">Error: {error}</div>;

  const { geojson, slates, electionData } = appData;

  const currentYearData = displayYear === 2026 ? liveData : electionData[displayYear];
  const compYearData = electionData[compYear];

  function handleYearChange(y) {
    setDisplayYear(y);
    if (y === 2026) lastViewed2026.current = new Date();
    if (compYear === y) {
      const fallback = [2025, 2024, 2023, 2022].find(yr => yr !== y);
      setCompYear(fallback);
    }
  }

  function handleLiveResults(parsed) {
    setLiveData(parsed);
    setDisplayYear(2026);
    setNewDataAt(new Date());
  }

  const show2026Badge = displayYear !== 2026
    && newDataAt
    && (!lastViewed2026.current || newDataAt > lastViewed2026.current);

  return (
    <div className="app-layout">
      <aside className="sidebar">
        {show2026Badge && (
          <div className="new-data-bar" onClick={() => handleYearChange(2026)}>
            New results available — click to view 2026
          </div>
        )}

        <Dashboard
          currentYearData={currentYearData}
          electionData={electionData}
          slates={slates}
          onYearChange={handleYearChange}
          onCompYearChange={setCompYear}
          onOverlayModeChange={setOverlayMode}
          compYear={compYear}
          displayYear={displayYear}
          overlayMode={overlayMode}
          show2026Badge={show2026Badge}
        />

        <div className="live-section">
          <div className="live-header">
            <span className={`live-dot${displayYear === 2026 && liveData ? ' active' : ''}`} />
            Election Night 2026 (Apr 7)
          </div>

          <button
            className={`btn-primary full-width${autoRefresh ? ' btn-active' : ''}`}
            onClick={() => { setAutoRefresh(p => !p); setFetchError(null); }}
          >
            {autoRefresh ? 'Auto-Refresh ON (30s)' : 'Start Auto-Refresh'}
          </button>

          {autoRefresh && (
            <div className="fetch-status waiting">
              {newDataAt
                ? `Last new data: ${minsAgo(newDataAt, now)} at ${newDataAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : 'Waiting for first results…'}
            </div>
          )}

          <button className="btn-secondary full-width" onClick={() => setShowPaster(true)}>
            {liveData
              ? `Manual Update (${liveData.reportingCount ?? '?'}/38)`
              : 'Paste Results Manually'}
          </button>

          {liveData && (
            <div className="live-timestamp">
              Last updated: {new Date(liveData.parsedAt).toLocaleTimeString()}
              {liveData.sourceUpdated && (
                <div className="source-timestamp">Source: {liveData.sourceUpdated}</div>
              )}
            </div>
          )}
        </div>
      </aside>

      <main className="map-wrap">
        <MapContainer center={CENTER} zoom={11} style={{ width: '100%', height: '100%' }} zoomControl>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            opacity={0.4}
          />
          {geojson && currentYearData && (
            <>
              <ElectionMap
                geojson={geojson}
                currentYearData={currentYearData}
                compYearData={compYearData}
                slates={slates}
                onHover={setHoverInfo}
                overlayMode={overlayMode}
              />
              <PrecinctTooltip hoverInfo={hoverInfo} />
            </>
          )}
        </MapContainer>

        {displayYear === 2026 && !liveData && (
          <div className="map-overlay-msg">
            Click "Start Auto-Refresh" or "Paste Results Manually" to load 2026 data.
          </div>
        )}
      </main>

      {showPaster && (
        <ResultsPaster onResults={handleLiveResults} onClose={() => setShowPaster(false)} />
      )}
    </div>
  );
}
