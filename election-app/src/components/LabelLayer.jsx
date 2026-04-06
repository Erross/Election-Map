import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { FHSD_PRECINCTS } from '../utils/slateCalculator';

/** Simple centroid: mean of all polygon ring points. */
function getCentroid(feature) {
  const { type, coordinates } = feature.geometry;
  let points = [];
  if (type === 'Polygon') {
    points = coordinates[0];
  } else if (type === 'MultiPolygon') {
    // Use the largest ring
    let max = 0, best = [];
    for (const poly of coordinates) {
      if (poly[0].length > max) { max = poly[0].length; best = poly[0]; }
    }
    points = best;
  }
  if (!points.length) return null;
  let lat = 0, lng = 0;
  for (const [x, y] of points) { lng += x; lat += y; }
  return [lat / points.length, lng / points.length];
}

function formatSwing(swing) {
  if (swing === null || swing === undefined) return null;
  const abs = Math.abs(swing * 100).toFixed(1);
  if (Math.abs(swing) < 0.001) return 'Even';
  return swing > 0 ? `${abs}% →FHFam` : `${abs}% →FHFwd`;
}

function formatTurnout(votes, delta) {
  if (votes === undefined || votes === null) return null;
  const votesStr = votes.toLocaleString();
  if (delta === null || delta === undefined) return votesStr;
  const abs = Math.abs(delta * 100).toFixed(1);
  const deltaStr = delta > 0 ? `▲${abs}%` : `▼${abs}%`;
  return `${votesStr}\n${deltaStr}`;
}

function formatMargin(margin) {
  if (margin === null || margin === undefined) return null;
  const abs = Math.abs(margin * 100).toFixed(0);
  return margin > 0 ? `Fam+${abs}%` : margin < 0 ? `Fwd+${abs}%` : 'Even';
}

export default function LabelLayer({
  geojson,
  overlayMode,       // 'swing' | 'turnout_delta' | 'margin'
  marginMap,         // { pid -> margin }
  compMarginMap,     // { pid -> margin }
  turnoutMap,        // { pid -> turnout ratio }
  compTurnoutMap,    // { pid -> turnout ratio }
  votesMap,          // { pid -> total_votes }
  compYear,
  is2022Comp,        // true when compYear === 2022 (no per-precinct swing)
}) {
  const map = useMap();
  const markersRef = useRef([]);

  useEffect(() => {
    // Remove old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    if (!geojson || !map) return;

    for (const feature of geojson.features) {
      const pid = feature.properties.DIST_NUM;
      if (!FHSD_PRECINCTS.has(pid)) continue;

      const centroid = getCentroid(feature);
      if (!centroid) continue;

      let text = null;

      if (overlayMode === 'swing') {
        if (is2022Comp) {
          text = null; // no per-precinct swing vs 2022
        } else {
          const swing = (marginMap[pid] !== undefined && compMarginMap[pid] !== undefined)
            ? marginMap[pid] - compMarginMap[pid]
            : null;
          text = formatSwing(swing);
        }
      } else if (overlayMode === 'turnout_delta') {
        const delta = (turnoutMap[pid] !== undefined && compTurnoutMap[pid] !== undefined)
          ? turnoutMap[pid] - compTurnoutMap[pid]
          : null;
        text = formatTurnout(votesMap[pid], delta);
      } else if (overlayMode === 'margin') {
        text = formatMargin(marginMap[pid]);
      }

      if (!text) continue;

      // Arrow color for swing mode
      let color = '#ffffff';
      if (overlayMode === 'swing') {
        const swing = (marginMap[pid] !== undefined && compMarginMap[pid] !== undefined)
          ? marginMap[pid] - compMarginMap[pid] : 0;
        // We always use white with shadow — it reads on both red and blue fills
        color = '#ffffff';
      }

      const lines = text.split('\n');
      const isTwoLine = lines.length > 1;
      const html = lines.map((line, i) => `<span style="
          font-size: ${i === 0 && isTwoLine ? '10px' : '9px'};
          font-weight: 700;
          color: #fff;
          text-shadow: 0 0 3px #000, 0 0 3px #000, 0 0 2px #000;
          white-space: nowrap;
          letter-spacing: -0.2px;
          pointer-events: none;
          display: block;
          text-align: center;
          line-height: 1.2;
        ">${line}</span>`).join('');

      const icon = L.divIcon({
        className: '',
        html,
        iconSize: [48, isTwoLine ? 26 : 14],
        iconAnchor: [24, isTwoLine ? 13 : 7],
      });

      const marker = L.marker(centroid, { icon, interactive: false, zIndexOffset: 500 });
      marker.addTo(map);
      markersRef.current.push(marker);
    }

    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
    };
  }, [geojson, map, overlayMode, marginMap, compMarginMap, turnoutMap, compTurnoutMap, votesMap, is2022Comp]);

  return null;
}
