"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";

// Icones par defaut de Leaflet servies depuis /public/leaflet (copiees de
// node_modules/leaflet/dist/images) — sans ceci, le bundler ne resout pas
// les chemins relatifs que Leaflet utilise en interne pour son marqueur.
const defaultIcon = L.icon({
  iconUrl: "/leaflet/marker-icon.png",
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  shadowUrl: "/leaflet/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Centre approximatif de N'Djamena — utilise uniquement quand aucune
// coordonnee n'a encore ete choisie (mode interactif, premier affichage).
const NDJAMENA_CENTER: [number, number] = [12.1348, 15.0557];

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function LocationMap({
  latitude,
  longitude,
  onChange,
  readOnly = false,
}: {
  latitude?: number | null;
  longitude?: number | null;
  onChange?: (lat: number, lng: number) => void;
  readOnly?: boolean;
}) {
  const hasPin = latitude != null && longitude != null;
  const center: [number, number] = hasPin ? [latitude!, longitude!] : NDJAMENA_CENTER;

  return (
    <div className="overflow-hidden rounded-md border border-[var(--color-border)]" style={{ height: 260 }}>
      <MapContainer center={center} zoom={hasPin ? 16 : 12} style={{ height: "100%", width: "100%" }} scrollWheelZoom={!readOnly}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {hasPin && <Marker position={[latitude!, longitude!]} icon={defaultIcon} />}
        {!readOnly && onChange && <ClickHandler onPick={onChange} />}
      </MapContainer>
    </div>
  );
}
