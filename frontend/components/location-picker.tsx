"use client"

import { useEffect, useRef, useState } from "react"
import { MapPinIcon, XCircleIcon } from "lucide-react"

interface LocationPickerProps {
  value: string
  onChange: (location: string, lat: number, lng: number) => void
}

interface Suggestion {
  place_id: string
  display_name: string
  lat: string
  lon: string
}

export function LocationPicker({ value, onChange }: LocationPickerProps) {
  const [query, setQuery] = useState(value || "")
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [selected, setSelected] = useState<{ lat: number; lng: number } | null>(null)
  const [showMap, setShowMap] = useState(false)
  const [loadingMap, setLoadingMap] = useState(false)
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<any>(null)

  // Autocomplete using Nominatim (free, no API key)
  useEffect(() => {
    if (!query || query.length < 3) { setSuggestions([]); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`,
          { headers: { 'Accept-Language': 'en' } }
        )
        const data = await res.json()
        setSuggestions(data || [])
      } catch {}
    }, 400)
  }, [query])

  // Init Leaflet map after selection
  useEffect(() => {
    if (!showMap || !selected || !mapContainerRef.current) return
    setLoadingMap(true)

    // Dynamically import leaflet (avoids SSR issues)
    Promise.all([
      import("leaflet"),
      import("leaflet/dist/leaflet.css" as any),
    ]).then(([L]) => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }

      // Fix default marker icons
      delete (L.default.Icon.Default.prototype as any)._getIconUrl
      L.default.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const map = L.default.map(mapContainerRef.current!, { zoomControl: true })
        .setView([selected.lat, selected.lng], 14)

      L.default.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map)

      const marker = L.default.marker([selected.lat, selected.lng], { draggable: true }).addTo(map)

      marker.on('dragend', () => {
        const pos = marker.getLatLng()
        setSelected({ lat: pos.lat, lng: pos.lng })
        onChange(query, pos.lat, pos.lng)
      })

      mapRef.current = map
      markerRef.current = marker
      setLoadingMap(false)
    })

    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null } }
  }, [showMap, selected?.lat, selected?.lng])

  const handleSelect = (s: Suggestion) => {
    const lat = parseFloat(s.lat)
    const lng = parseFloat(s.lon)
    // Shorten display name to first 2 parts
    const shortName = s.display_name.split(',').slice(0, 3).join(',').trim()
    setQuery(shortName)
    setSuggestions([])
    setSelected({ lat, lng })
    setShowMap(true)
    onChange(shortName, lat, lng)
  }

  const handleClear = () => {
    setQuery("")
    setSuggestions([])
    setSelected(null)
    setShowMap(false)
    onChange("", 0, 0)
  }

  return (
    <div className="space-y-2">
      {/* Search input */}
      <div className="relative">
        <MapPinIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none z-10" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search area, neighborhood, city..."
          className="w-full pl-9 pr-9 bg-white/5 border border-white/20 text-white placeholder-white/40 rounded-xl px-3 py-2 h-10 sm:h-12 text-sm focus:outline-none focus:border-white/40"
        />
        {query && (
          <button type="button" onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2 z-10">
            <XCircleIcon className="w-4 h-4 text-white/30 hover:text-white/60" />
          </button>
        )}

        {/* Dropdown */}
        {suggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-white/10 rounded-xl overflow-hidden shadow-xl">
            {suggestions.map(s => (
              <button key={s.place_id} type="button" onClick={() => handleSelect(s)}
                className="w-full text-left px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 flex items-start gap-2 border-b border-white/5 last:border-0">
                <MapPinIcon className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                <span className="line-clamp-2">{s.display_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map */}
      {showMap && (
        <div className="relative rounded-xl overflow-hidden border border-white/10" style={{ height: 220 }}>
          {loadingMap && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/80">
              <div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
            </div>
          )}
          <div ref={mapContainerRef} className="w-full h-full" />
          <p className="absolute bottom-2 left-0 right-0 text-center text-xs pointer-events-none z-10"
            style={{ color: 'rgba(0,0,0,0.6)', textShadow: '0 0 4px white' }}>
            Drag the pin to fine-tune the exact location
          </p>
        </div>
      )}

      {/* Coordinates */}
      {selected && (
        <p className="text-white/30 text-xs px-1">
          📍 {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}
        </p>
      )}
    </div>
  )
}
