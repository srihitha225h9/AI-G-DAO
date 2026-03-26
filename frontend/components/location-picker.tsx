"use client"

import { useEffect, useRef, useState } from "react"
import { MapPinIcon, XCircleIcon } from "lucide-react"

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

interface LocationPickerProps {
  value: string
  onChange: (location: string, lat: number, lng: number) => void
}

interface Suggestion {
  id: string
  place_name: string
  center: [number, number]
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

  // Autocomplete search
  useEffect(() => {
    if (!query || query.length < 2) { setSuggestions([]); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&autocomplete=true&limit=5`
        )
        const data = await res.json()
        setSuggestions(data.features || [])
      } catch {}
    }, 300)
  }, [query])

  // Init map after selection
  useEffect(() => {
    if (!showMap || !selected || !mapContainerRef.current) return
    setLoadingMap(true)

    import("mapbox-gl").then((mapboxgl) => {
      // @ts-ignore
      mapboxgl.default.accessToken = MAPBOX_TOKEN

      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }

      // @ts-ignore
      const map = new mapboxgl.default.Map({
        container: mapContainerRef.current!,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [selected.lng, selected.lat],
        zoom: 13,
      })

      // @ts-ignore
      const marker = new mapboxgl.default.Marker({ color: "#8b5cf6", draggable: true })
        .setLngLat([selected.lng, selected.lat])
        .addTo(map)

      marker.on("dragend", () => {
        const lngLat = marker.getLngLat()
        setSelected({ lat: lngLat.lat, lng: lngLat.lng })
        onChange(query, lngLat.lat, lngLat.lng)
      })

      map.on("load", () => setLoadingMap(false))

      mapRef.current = map
      markerRef.current = marker
    })

    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null } }
  }, [showMap, selected?.lat, selected?.lng])

  const handleSelect = (s: Suggestion) => {
    const [lng, lat] = s.center
    setQuery(s.place_name)
    setSuggestions([])
    setSelected({ lat, lng })
    setShowMap(true)
    onChange(s.place_name, lat, lng)
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
        <MapPinIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search area, neighborhood, city..."
          className="w-full pl-9 pr-9 bg-white/5 border border-white/20 text-white placeholder-white/40 rounded-xl px-3 py-2 h-10 sm:h-12 text-sm focus:outline-none focus:border-white/40"
        />
        {query && (
          <button type="button" onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2">
            <XCircleIcon className="w-4 h-4 text-white/30 hover:text-white/60" />
          </button>
        )}

        {/* Dropdown suggestions */}
        {suggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-white/10 rounded-xl overflow-hidden shadow-xl">
            {suggestions.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSelect(s)}
                className="w-full text-left px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 flex items-center gap-2 border-b border-white/5 last:border-0"
              >
                <MapPinIcon className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                {s.place_name}
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
          <p className="absolute bottom-2 left-0 right-0 text-center text-white/40 text-xs pointer-events-none">
            Drag the pin to fine-tune the exact location
          </p>
        </div>
      )}

      {/* Coordinates display */}
      {selected && (
        <p className="text-white/30 text-xs px-1">
          📍 {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}
        </p>
      )}
    </div>
  )
}
