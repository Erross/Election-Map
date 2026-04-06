import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';

import ElectionMap from './components/ElectionMap';
import PrecinctTooltip from './components/PrecinctTooltip';
import Dashboard from './components/Dashboard';
import PropRTMap from './components/PropRTMap';
import ResultsPaster from './components/ResultsPaster';
import { loadAll } from './utils/dataLoader';
import { fetchLiveResults } from './utils/liveFetcher';

const DEFAULT_YEAR = 2025;
const DEFAULT_COMP_YEAR = 2024;
const CENTER = [38.755, -90.68];

// 7:00 PM CDT = 23:00 UTC on April 7 2026 (CDT = UTC-4)
const POLLS_CLOSE_UTC = new Date('2026-04-07T23:00:00Z');
const TOTAL_PRECINCTS = 38;
const BASE_MS   = 5 * 60 * 1000;
const BURST_MS  = 30 * 1000;
const BURST_DUR = 5 * 60 * 1000;

function getPhase(now, reportingCount) {
  if (now < POLLS_CLOSE_UTC) return 'pre';
  if (reportingCount >= TOTAL_PRECINCTS) return 'complete';
  return 'active';
}

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
  // liveData holds the full Worker response: { fhsd, propRT, parsedAt, sourceUpdated, dataHash }
  const [liveData, setLiveData] = useState(null);
  const [showPaster, setShowPaster] = useState(false);
  const [hoverInfo, setHoverInfo] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [newDataAt, setNewDataAt] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const [activeView, setActiveView] = useState('fhsd');

  const lastViewed2026 = useRef(null);
  const liveDataRef   = useRef(null);
  const burstUntilRef = useRef(0);

  // Clock tick — always on
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  // Initial data load
  useEffect(() => {
    loadAll()
      .then(setAppData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // One-time fetch on every page load
  useEffect(() => {
    if (!appData) return;
    fetchLiveResults().then(result => {
      if (result && !result.unchanged && result.fhsd) {
        liveDataRef.current = result;
        setLiveData(result);
        setNewDataAt(new Date());
      }
    }).catch(() => {});
  }, [appData]);

  // Smart polling — recursive setTimeout, phase-aware
  useEffect(() => {
    if (!autoRefresh) return;
    let cancelled = false;

    async function poll() {
      if (cancelled) return;
      const phase = getPhase(new Date(), liveDataRef.current?.fhsd?.reportingCount ?? 0);
      if (phase === 'pre' || phase === 'complete') return;

      try {
        const result = await fetchLiveResults();
        if (cancelled) return;
        if (result && !result.unchanged && result.fhsd) {
          burstUntilRef.current = Date.now() + BURST_DUR;
          liveDataRef.current = result;
          setLiveData(prev => {
            if (!prev) setDisplayYear(2026);
            return result;
          });
          setNewDataAt(new Date());
        }
      } catch (_) {
        // Silently swallow — status line shows last-new-data time
      }

      if (cancelled) return;
      const delay = Date.now() < burstUntilRef.current ? BURST_MS : BASE_MS;
      setTimeout(poll, delay);
    }

    poll();
    return () => { cancelled = true; };
  }, [autoRefresh]);

  if (loading) return <div className="loading">Loading election data…</div>;
  if (error) return <div className="loading error">Error: {error}</div>;

  const { geojson, slates, electionData } = appData;

  // Derived live data for each contest
  const fhsdLiveData = liveData?.fhsd ? {
    ...liveData.fhsd,
    year: 2026,
    election_date: '2026-04-07',
    live: true,
    parsedAt: liveData.parsedAt,
  } : null;

  const propRTData = liveData?.propRT ?? null;

  const currentYearData = displayYear === 2026 ? fhsdLiveData : electionData[displayYear];
  const compYearData = electionData[compYear];
  const phase = getPhase(now, liveData?.fhsd?.reportingCount ?? 0);

  function handleYearChange(y) {
    setDisplayYear(y);
    if (y === 2026) lastViewed2026.current = new Date();
    if (compYear === y) {
      const fallback = [2025, 2024, 2023, 2022].find(yr => yr !== y);
      setCompYear(fallback);
    }
  }

  // Paste fallback — wrap FHSD-only result into the full liveData shape
  function handleLiveResults(parsed) {
    const wrapped = {
      fhsd: {
        race: parsed.race,
        precincts: parsed.precincts,
        non_map_precincts: parsed.non_map_precincts ?? {},
        reportingCount: parsed.reportingCount,
        totalPrecincts: 38,
      },
      propRT: liveData?.propRT ?? null,
      parsedAt: parsed.parsedAt || new Date().toISOString(),
      sourceUpdated: liveData?.sourceUpdated ?? null,
      dataHash: null,
    };
    liveDataRef.current = wrapped;
    setLiveData(wrapped);
    setDisplayYear(2026);
    setNewDataAt(new Date());
  }

  const show2026Badge = displayYear !== 2026
    && newDataAt
    && (!lastViewed2026.current || newDataAt > lastViewed2026.current);

  function statusText() {
    if (phase === 'pre') return 'Polls open until 7:00 PM CT';
    if (phase === 'complete') return `All ${TOTAL_PRECINCTS} precincts reported — polling stopped`;
    if (!newDataAt) return 'Polling started — waiting for first results…';
    return `Last new data: ${minsAgo(newDataAt, now)} at ${newDataAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  function autoRefreshLabel() {
    if (!autoRefresh) return 'Start Auto-Refresh';
    if (phase === 'pre') return 'Monitoring — polls close 7pm CT';
    if (phase === 'complete') return 'Monitoring — results complete';
    return 'Auto-Refresh ON';
  }

  const liveSection = (
    <div className="live-section">
      <div className="live-header">
        <span className={`live-dot${displayYear === 2026 && fhsdLiveData ? ' active' : ''}`} />
        Election Night 2026 (Apr 7)
      </div>

      <button
        className={`btn-primary full-width${autoRefresh ? ' btn-active' : ''}`}
        onClick={() => setAutoRefresh(p => !p)}
      >
        {autoRefreshLabel()}
      </button>

      {autoRefresh && (
        <div className="fetch-status waiting">{statusText()}</div>
      )}

      <button className="btn-secondary full-width" onClick={() => setShowPaster(true)}>
        {fhsdLiveData
          ? `Manual Update (${liveData?.fhsd?.reportingCount ?? '?'}/38)`
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
  );

  return (
    <div className="root-layout">
      <nav className="view-nav">
        <button
          className={activeView === 'fhsd' ? 'active' : ''}
          onClick={() => setActiveView('fhsd')}
        >
          FHSD School Board
        </button>
        <button
          className={activeView === 'propRT' ? 'active' : ''}
          onClick={() => setActiveView('propRT')}
        >
          Proposition RT
        </button>
      </nav>

      <div className="view-content">
        {activeView === 'fhsd' && (
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

              {liveSection}
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

              {displayYear === 2026 && !fhsdLiveData && (
                <div className="map-overlay-msg">
                  Click "Start Auto-Refresh" or "Paste Results Manually" to load 2026 data.
                </div>
              )}
            </main>
          </div>
        )}

        {activeView === 'propRT' && (
          <PropRTMap
            geojson={geojson}
            propRTData={propRTData}
            autoRefresh={autoRefresh}
            onToggleAutoRefresh={() => setAutoRefresh(p => !p)}
            autoRefreshLabel={autoRefreshLabel()}
            statusText={statusText()}
            liveTimestamp={liveData?.parsedAt}
            sourceUpdated={liveData?.sourceUpdated}
          />
        )}
      </div>

      {showPaster && (
        <ResultsPaster onResults={handleLiveResults} onClose={() => setShowPaster(false)} />
      )}
    </div>
  );
}
