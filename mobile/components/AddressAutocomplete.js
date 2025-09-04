import React from 'react';
import { View, TextInput, TouchableOpacity, Text } from 'react-native';
import Constants from 'expo-constants';

const MAPBOX_TOKEN = Constants.expoConfig?.extra?.mapboxToken || process.env?.EXPO_PUBLIC_MAPBOX_TOKEN || '';

export default function AddressAutocomplete({
  value,
  placeholder = 'Street',
  onChangeText,
  onSelect,
}) {
  const [query, setQuery] = React.useState(value || '');
  const [results, setResults] = React.useState([]);
  const [open, setOpen] = React.useState(false);
  const timer = React.useRef(null);

  React.useEffect(() => { setQuery(value || ''); }, [value]);

  const fetchPlaces = async (q) => {
    if (!MAPBOX_TOKEN || !q || q.length < 3) { setResults([]); return; }
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?autocomplete=true&limit=6&access_token=${MAPBOX_TOKEN}`;
      const res = await fetch(url);
      const json = await res.json();
      const list = (json?.features || []).map((f) => ({
        id: f.id,
        label: f.place_name,
        context: f.context || [],
        props: f.properties || {},
      }));
      setResults(list);
    } catch (_) {
      setResults([]);
    }
  };

  const handleChange = (t) => {
    setQuery(t);
    onChangeText?.(t);
    setOpen(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => fetchPlaces(t), 220);
  };

  const parseParts = (ctx, props) => {
    const find = (idPrefix) => ctx?.find((c) => (c.id || '').startsWith(idPrefix))?.text || '';
    const city = find('place') || find('locality') || props?.place || '';
    const state = find('region') || props?.region || '';
    const postal = find('postcode') || props?.postcode || '';
    return { city, state, postal };
  };

  const selectItem = (item) => {
    const parts = parseParts(item.context, item.props);
    onSelect?.({ line1: item.label?.split(',')[0] || query, ...parts });
    setQuery(item.label);
    setOpen(false);
    setResults([]);
  };

  return (
    <View style={{ position: 'relative' }}>
      <TextInput
        value={query}
        placeholder={placeholder}
        onChangeText={handleChange}
        onFocus={() => setOpen(true)}
        style={{ borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }}
      />
      {open && results.length > 0 && (
        <View
          style={{
            position:'absolute',
            left:0,
            right:0,
            top:48,
            backgroundColor:'#ffffff',
            borderWidth:1,
            borderColor:'#e5e7eb',
            borderRadius:8,
            maxHeight:200,
            zIndex:50,
            overflow:'hidden',
            // subtle shadow
            shadowColor:'#000',
            shadowOpacity:0.12,
            shadowOffset:{ width:0, height:2 },
            shadowRadius:6,
            elevation:8,
          }}
        >
          {results.map((item) => (
            <TouchableOpacity key={item.id} onPress={() => selectItem(item)} style={{ padding:10, backgroundColor:'#ffffff' }}>
              <Text style={{ color:'#111827' }}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}


