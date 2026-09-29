import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Fly-to helper component (zooms to the first selected country if any)
function FlyToCountry({ year, lookup }) {
  const map = useMap();
  useEffect(() => {
    const codes = Object.keys(lookup);
    if (codes.length) {
      const coord = lookup[codes[0]].coord || [20, 0];
      map.flyTo(coord, 4, { duration: 1 });
    }
  }, [year, lookup, map]);
  return null;
}

export default function ChoroplethMap({ records, year }) {
  const [geo, setGeo] = useState(null);
  const mapRef = useRef();

  // Load GeoJSON once
  useEffect(() => {
    fetch("/world_countries.json")
      .then(r => r.json())
      .then(setGeo);
  }, []);

  // Build a lookup: code → { pop, coord? }
  const lookup = records
    .filter(r => r.Year === year)
    .reduce((acc, r) => {
      const code = (r["Country Code"] || "").toUpperCase();
      acc[code] = { pop: r.Population, coord: acc[code]?.coord };
      return acc;
    }, {});

  // Style function based on population
  const getColor = p =>
    p > 1e9 ? "#800026" :
    p > 5e8 ? "#BD0026" :
    p > 1e8 ? "#E31A1C" :
    p > 5e7 ? "#FC4E2A" :
    p > 1e7 ? "#FD8D3C" :
    p > 1e6 ? "#FEB24C" : "#FFEDA0";

  const styleF = feat => {
    const code = (feat.properties["ISO3166-1-Alpha-3"] || "").toUpperCase();
    const p    = lookup[code]?.pop;
    return {
      fillColor: p == null ? "#ccc" : getColor(p),
      weight: 1,
      color: "white",
      fillOpacity: 0.7
    };
  };

  if (!geo) return <div className="skeleton" />;

  return (
    <MapContainer
      whenCreated={map => (mapRef.current = map)}
      style={{ height: 600, width: "100%" }}
      center={[20, 0]}
      zoom={2}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <GeoJSON
        data={geo}
        style={styleF}
        onEachFeature={(f, layer) => {
          const code = (f.properties["ISO3166-1-Alpha-3"] || "").toUpperCase();
          const p    = lookup[code]?.pop?.toLocaleString() || "n/a";
          layer.bindPopup(`${f.properties.name} (${code}): ${p}`);
        }}
      />
      <FlyToCountry year={year} lookup={lookup} />
    </MapContainer>
  );
}