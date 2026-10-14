'use client'

import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet'

// OpenStreetMap tiles (no API key, no cookies). A CircleMarker avoids
// Leaflet's default marker PNGs (which break under bundlers).
export default function LocationMapInner({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={15}
      scrollWheelZoom={false}
      className="h-full w-full"
      attributionControl
      preferCanvas={L.Browser.mobile}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <CircleMarker center={[lat, lng]} radius={11} pathOptions={{ color: '#0E6070', weight: 3, fillColor: '#F2A23C', fillOpacity: 0.95 }}>
        <Tooltip permanent direction="top" offset={[0, -10]}>{label}</Tooltip>
      </CircleMarker>
    </MapContainer>
  )
}
