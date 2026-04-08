import { useRef, useState } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';

import ElectionMap from './components/ElectionMap';
import PrecinctTooltip from './components/PrecinctTooltip';
import MobilePrecinctPanel from './components/MobilePrecinctPanel';
import Dashboard from './components/Dashboard';
import PropRTMap from './components/PropRTMap';
import { loadAll } from './utils/dataLoader';
import { use } from 'react';

const DEFAULT_YEAR = 2026;
const DEFAULT_COMP_YEAR = 2025;
const CENTER = [38.755, -90.68];

const appDataPromise = loadAll();

export default function App() {
  const appData = use(appDataPromise);
  const { geojson, countyGeojson, slates, electionData, propRT2026 } = appData;

  const [displayYear, setDisplayYear] = useState(DEFAULT_YEAR);
  const [compYear, setCompYear] = useState(DEFAULT_COMP_YEAR);
  const [overlayMode, setOverlayMode] = useState('swing');
  const [hoverInfo, setHoverInfo] = useState(null);
  const [pinnedInfo, setPinnedInfo] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeView, setActiveView] = useState('fhsd');

  const currentYearData = electionData[displayYear];
  const compYearData = electionData[compYear];

  function handleYearChange(y) {
    setPinnedInfo(null);
    setDisplayYear(y);
    if (compYear === y) {
      const fallback = [2025, 2024, 2023, 2022].find(yr => yr !== y);
      setCompYear(fallback);
    }
  }

  const fhsd2026 = electionData[2026];
  const finalTimestamp = fhsd2026?.parsedAt
    ? new Date(fhsd2026.parsedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  const resultsSection = (
    <div className="live-section">
      <div className="live-header">
        <span className="live-dot" />
        April 7, 2026 — Final Results
      </div>
      <div className="fetch-status waiting">
        All 38 of 38 precincts reported
        {finalTimestamp && <span> · Last fetch {finalTimestamp}</span>}
      </div>
    </div>
  );

  return (
    <div className="root-layout">
      <header className="app-header">
        <div className="app-header-title">St. Charles County Election Results</div>
        <div className="app-header-sub">Final precinct-level results — April 7, 2026</div>
      </header>

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
            <aside className={`sidebar${sidebarCollapsed ? ' collapsed' : ''}`}>
              <Dashboard
                currentYearData={currentYearData}
                electionData={electionData}
                slates={slates}
                onYearChange={handleYearChange}
                onCompYearChange={y => { setPinnedInfo(null); setCompYear(y); }}
                onOverlayModeChange={setOverlayMode}
                compYear={compYear}
                displayYear={displayYear}
                overlayMode={overlayMode}
                show2026Badge={false}
              />

              {resultsSection}
            </aside>

            <button
              className="sidebar-toggle-btn"
              onClick={() => setSidebarCollapsed(p => !p)}
              aria-label={sidebarCollapsed ? 'Show panel' : 'Hide panel'}
            >
              <span className="stb-chevron">{sidebarCollapsed ? '▼' : '▲'}</span>
              <span className="stb-label">{sidebarCollapsed ? 'Show Panel' : 'Hide Panel'}</span>
            </button>

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
                      onPrecinctClick={setPinnedInfo}
                      overlayMode={overlayMode}
                    />
                    <PrecinctTooltip hoverInfo={hoverInfo} />
                  </>
                )}
              </MapContainer>

              <MobilePrecinctPanel
                pinnedInfo={pinnedInfo}
                onClose={() => setPinnedInfo(null)}
              />
            </main>
          </div>
        )}

        {activeView === 'propRT' && (
          <PropRTMap
            geojson={countyGeojson}
            propRTData={propRT2026}
          />
        )}
      </div>
    </div>
  );
}
