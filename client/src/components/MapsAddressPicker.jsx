import { useEffect, useRef, useState } from 'react';

/**
 * MapsAddressPicker â€” Google Maps pin address picker (mventor-ticket-053).
 * - Search box (Places Autocomplete)
 * - Click on the map to drop a pin â†’ reverse geocode fills address/city/governorate
 * - Falls back to manual inputs when no API key is configured
 */
let mapsPromise = null;

function loadMaps(key) {
  if (!key) return Promise.resolve(null);
  if (mapsPromise) return mapsPromise;
  mapsPromise = new Promise((resolve) => {
    const cbName = '__mapsInit' + Date.now();
    window[cbName] = () => { delete window[cbName]; resolve(window.google); };
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&callback=${cbName}`;
    script.async = true;
    script.onerror = () => { mapsPromise = null; resolve(null); };
    document.head.appendChild(script);
  });
  return mapsPromise;
}

export default function MapsAddressPicker({ value, onChange }) {
  const mapRef = useRef(null);
  const inputRef = useRef(null);
  const markerRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [mapsReady, setMapsReady] = useState(false);
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import('../api/products').then(({ getMapsKey }) => getMapsKey())
      .then(res => {
        const key = res.data?.key || '';
        setHasKey(!!key);
        if (!key) return null;
        return loadMaps(key);
      })
      .then(g => {
        if (cancelled || !g) return;
        setMapsReady(true);
        initMap(g);
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function initMap(google) {
    const map = new google.maps.Map(mapRef.current, {
      center: { lat: 30.0444, lng: 31.2357 }, // Cairo default
      zoom: 12,
    });

    const applyPlace = (place) => {
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      placeMarker({ lat, lng }, place.formatted_address);
    };

    const placeMarker = (position, address) => {
      if (!markerRef.current) {
        markerRef.current = new google.maps.Marker({ map });
      }
      markerRef.current.setPosition(position);
      map.panTo(position);
      if (address) {
        onChange({
          address,
          city: value.city || '',
          governorate: value.governorate || '',
          latitude: position.lat,
          longitude: position.lng,
        });
      } else {
        reverseGeocode(google, position);
      }
    };

    const reverseGeocode = (g, position) => {
      const geocoder = new g.maps.Geocoder();
      geocoder.geocode({ location: position }, (results, status) => {
        if (status === 'OK' && results[0]) {
          const components = results[0].address_components || [];
          const get = (types) => components.find(c => c.types.some(t => types.includes(t)))?.long_name || '';
          onChange({
            address: results[0].formatted_address,
            city: get(['locality', 'sublocality', 'postal_town']) || value.city || '',
            governorate: get(['administrative_area_level_1']) || value.governorate || '',
            latitude: position.lat,
            longitude: position.lng,
          });
        }
      });
    };

    // Click on map â†’ pin
    map.addListener('click', (e) => placeMarker({ lat: e.latLng.lat(), lng: e.latLng.lng() }));

    // Places autocomplete
    if (inputRef.current) {
      autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, { types: ['address'] });
      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current.getPlace();
        if (place.geometry) applyPlace(place);
      });
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search your address..."
          className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-dark-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
        />
      </div>

      {mapsReady && (
        <div ref={mapRef} className="w-full h-56 rounded-xl border border-gray-200 dark:border-white/10" />
      )}
      {!hasKey && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Google Maps not configured (add a Maps API key in Admin â†’ Integrations) â€” enter your address manually below.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="sm:col-span-3">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Address</label>
          <input
            type="text"
            value={value.address || ''}
            onChange={e => onChange({ ...value, address: e.target.value })}
            placeholder="Street, building, floor, apartment"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-dark-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">City</label>
          <input
            type="text"
            value={value.city || ''}
            onChange={e => onChange({ ...value, city: e.target.value })}
            placeholder="City"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-dark-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Governorate</label>
          <input
            type="text"
            value={value.governorate || ''}
            onChange={e => onChange({ ...value, governorate: e.target.value })}
            placeholder="Governorate"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-dark-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
          />
        </div>
      </div>
      <p className="text-[11px] text-gray-400">Tip: type your address above or click the map to drop a pin.</p>
    </div>
  );
}
