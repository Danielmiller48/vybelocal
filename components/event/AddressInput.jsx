'use client'
import { useState, useEffect, useRef } from 'react'

export default function AddressInput({ value, onChange }) {
  const [query, setQuery]       = useState(value || '')
  const [suggestions, setSuggs] = useState([])
  const boxRef = useRef(null)

  // fetch suggestions on keystroke
  useEffect(() => {
    if (query.length < 3) { setSuggs([]); return }
    const ctrl = new AbortController()
    const url  = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?autocomplete=true&limit=5&access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`
    fetch(url, { signal: ctrl.signal })
      .then(r => r.json())
      .then(d => setSuggs(d.features || []))
      .catch(() => {/* ignore abort */})
    return () => ctrl.abort()
  }, [query])

  // click-outside to close
  useEffect(() => {
    function hide(e){ if(!boxRef.current?.contains(e.target)) setSuggs([]) }
    document.addEventListener('click', hide)
    return () => document.removeEventListener('click', hide)
  }, [])

  return (
    <div ref={boxRef} className="relative">
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value) }}
        placeholder="Start typing address…"
        className="input w-full"
      />
      {suggestions.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full bg-white border rounded shadow">
          {suggestions.map(f => (
            <li
              key={f.id}
              onClick={() => { setQuery(f.place_name); onChange(f.place_name); setSuggs([]) }}
              className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
            >
              {f.place_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
