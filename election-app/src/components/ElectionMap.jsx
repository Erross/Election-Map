import { useEffect, useRef } from 'react';
import { GeoJSON, useMap } from 'react-leaflet';
import { marginToColor } from '../utils/colorScale';
import { buildMarginMap, buildTurnoutMap, FHSD_PRECINCTS } from '../utils/slateCalculator';
import LabelLayer from './LabelLayer';

/** Watches the map container for size changes and invalidates Leaflet's size.
 *  Required so the map redraws correctly after responsive layout shifts. */
function MapResizer() {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const container = map.getContainer();
    const obs = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });
    obs.observe(container);
    return () => obs.disconnect();
  }, [map]);
  return null;
}

export default function ElectionMap({
  geojson,
  currentYearData,
  compYearData,
  slates,
  onHover,
  onPrecinctClick,
  overlayMode,
}) {
  const map = useMap();
  const clickedPidRef = useRef(null);

  const is2022Comp = compYearData?.year === 2022;

  const currentYear = String(currentYearData?.year);
  const marginMap = currentYearData && slates ? buildMarginMap(currentYearData, slates) : {};
  const compMarginMap = compYearData && slates ? buildMarginMap(compYearData, slates) : {};
  const turnoutMap = currentYearData ? buildTurnoutMap(currentYearData) : {};
  const compTurnoutMap = compYearData ? buildTurnoutMap(compYearData) : {};

  // Raw vote counts per precinct for turnout label
  const votesMap = {};
  for (const [pid, row] of Object.entries(currentYearData?.precincts ?? {})) {
    if (FHSD_PRECINCTS.has(pid)) votesMap[pid] = row.total_votes;
  }

  // Reset clicked state when year selection changes
  useEffect(() => {
    clickedPidRef.current = null;
  }, [currentYear, compYearData?.year]);

  // Fit map to FHSD precincts on first load
  useEffect(() => {
    if (!geojson || !map) return;
    const fhsdFeatures = geojson.features.filter(f => FHSD_PRECINCTS.has(f.properties.DIST_NUM));
    if (!fhsdFeatures.length) return;
    const bounds = [];
    fhsdFeatures.forEach(f => {
      const coords = f.geometry?.coordinates;
      if (!coords) return;
      const flat = f.geometry.type === 'Polygon' ? coords[0] : coords.flatMap(r => r[0]);
      flat.forEach(([lng, lat]) => bounds.push([lat, lng]));
    });
    if (bounds.length) map.fitBounds(bounds, { padding: [20, 20] });
  }, [geojson, map]);

  if (!geojson) return null;

  function styleFeature(feature) {
    const pid = feature.properties.DIST_NUM;
    const isFHSD = FHSD_PRECINCTS.has(pid);
    if (!isFHSD) {
      return { fillColor: '#d1d5db', fillOpacity: 0.25, color: '#9ca3af', weight: 0.5 };
    }
    const margin = marginMap[pid];
    return {
      fillColor: marginToColor(margin),
      fillOpacity: margin !== undefined ? 0.85 : 0.4,
      color: '#374151',
      weight: 1,
    };
  }

  function onEachFeature(feature, layer) {
    const pid = feature.properties.DIST_NUM;
    const isFHSD = FHSD_PRECINCTS.has(pid);

    function buildInfo(latlng) {
      const precinctRow = currentYearData?.precincts?.[pid];
      const compRow     = compYearData?.precincts?.[pid];
      const margin      = marginMap[pid];
      const compMargin  = compMarginMap[pid];
      const swing       = (!is2022Comp && margin !== undefined && compMargin !== undefined)
        ? (margin - compMargin) / 2
        : null;
      return {
        pid, precinctRow, compRow, margin, compMargin, swing,
        currentSlate: slates?.slates?.[currentYear],
        currentYear,
        compYear: compYearData?.year,
        is2022Comp,
        latlng,
      };
    }

    layer.on({
      mouseover(e) {
        e.target.setStyle({ weight: 2.5, color: '#111827', fillOpacity: isFHSD ? 0.95 : 0.4 });
        if (!isFHSD) return;
        onHover(buildInfo(e.latlng));
      },
      mouseout(e) {
        e.target.setStyle(styleFeature(feature));
        onHover(null);
      },
      click(e) {
        if (!isFHSD) return;
        e.originalEvent?.stopPropagation();
        if (clickedPidRef.current === pid) {
          clickedPidRef.current = null;
          onPrecinctClick?.(null);
        } else {
          clickedPidRef.current = pid;
          onPrecinctClick?.(buildInfo(e.latlng));
        }
      },
    });
  }

  return (
    <>
      <MapResizer />
      <GeoJSON
        key={`${currentYear}-${compYearData?.year}`}
        data={geojson}
        style={styleFeature}
        onEachFeature={onEachFeature}
      />
      <LabelLayer
        geojson={geojson}
        overlayMode={overlayMode}
        marginMap={marginMap}
        compMarginMap={compMarginMap}
        turnoutMap={turnoutMap}
        compTurnoutMap={compTurnoutMap}
        votesMap={votesMap}
        compYear={compYearData?.year}
        is2022Comp={is2022Comp}
      />
    </>
  );
}
