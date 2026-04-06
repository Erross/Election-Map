import { useEffect, useState } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';

import ElectionMap from './components/ElectionMap';
import PrecinctTooltip from './components/PrecinctTooltip';
import Dashboard from './components/Dashboard';
import ResultsPaster from './components/ResultsPaster';
import { loadAll } from './utils/dataLoader';

const DEFAULT_YEAR = 2025;
const DEFAULT_COMP_YEAR = 2024;
const CENTER = [38.755, -90.68];

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

  useEffect(() => {
    loadAll()
      .then(setAppData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading election data…</div>;
  if (error) return <div className="loading error">Error: {error}</div>;

  const { geojson, slates, electionData } = appData;

  const currentYearData = displayYear === 2026 ? liveData : electionData[displayYear];
  const compYearData = electionData[compYear];

  function handleYearChange(y) {
    setDisplayYear(y);
    if (compYear === y) {
      const fallback = [2025, 2024, 2023, 2022].find(yr => yr !== y);
      setCompYear(fallback);
    }
  }

  function handleLiveResults(parsed) {
    setLiveData(parsed);
    setDisplayYear(2026);
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
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
        />

        <div className="live-section">
          <div className="live-header">
            <span className={`live-dot${displayYear === 2026 && liveData ? ' active' : ''}`} />
            Election Night 2026 (Apr 7)
          </div>
          <button className="btn-primary full-width" onClick={() => setShowPaster(true)}>
            {liveData
              ? `Update Results (${liveData.reportingCount}/38 precincts)`
              : 'Paste Live Results'}
          </button>
          {liveData && (
            <div className="live-timestamp">
              Last updated: {new Date(liveData.parsedAt).toLocaleTimeString()}
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

        {/* 2026 no-data prompt */}
        {displayYear === 2026 && !liveData && (
          <div className="map-overlay-msg">
            Click "Paste Live Results" to load 2026 election night data.
          </div>
        )}
      </main>

      {showPaster && (
        <ResultsPaster onResults={handleLiveResults} onClose={() => setShowPaster(false)} />
      )}
    </div>
  );
}
