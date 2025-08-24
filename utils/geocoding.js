// utils/geocoding.js
// Mapbox geocoding service for converting addresses to coordinates

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

/**
 * Convert address string to latitude/longitude using Mapbox Geocoding API
 * @param {string} address - The address to geocode
 * @returns {Promise<{latitude: number, longitude: number} | null>}
 */
async function geocodeAddress(address) {
  if (!address || !MAPBOX_TOKEN) {
    console.warn('Missing address or Mapbox token for geocoding');
    return null;
  }

  try {
    const encodedAddress = encodeURIComponent(address.trim());
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${MAPBOX_TOKEN}&limit=1&country=US`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      const [longitude, latitude] = data.features[0].center;
      
      console.log(`📍 Geocoded "${address}" → ${latitude}, ${longitude}`);
      
      return {
        latitude: parseFloat(latitude.toFixed(8)),
        longitude: parseFloat(longitude.toFixed(8))
      };
    }
    
    console.warn(`No geocoding results for address: ${address}`);
    return null;
    
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

/**
 * Batch geocode multiple addresses
 * @param {Array<{id: string, address: string}>} addressList 
 * @returns {Promise<Array<{id: string, latitude: number, longitude: number}>>}
 */
async function batchGeocodeAddresses(addressList) {
  const results = [];
  
  // Process in batches to respect rate limits
  const BATCH_SIZE = 5;
  const DELAY_MS = 200; // Small delay between requests
  
  for (let i = 0; i < addressList.length; i += BATCH_SIZE) {
    const batch = addressList.slice(i, i + BATCH_SIZE);
    
    const batchPromises = batch.map(async (item) => {
      const coords = await geocodeAddress(item.address);
      return coords ? { id: item.id, ...coords } : null;
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults.filter(Boolean));
    
    // Small delay between batches
    if (i + BATCH_SIZE < addressList.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }
  
  return results;
}

/**
 * Get reverse geocoding (coordinates to address)
 * @param {number} latitude 
 * @param {number} longitude 
 * @returns {Promise<string | null>}
 */
async function reverseGeocode(latitude, longitude) {
  if (!MAPBOX_TOKEN) {
    console.warn('Missing Mapbox token for reverse geocoding');
    return null;
  }

  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${MAPBOX_TOKEN}&types=address`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      return data.features[0].place_name;
    }
    
    return null;
    
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}

// Export functions for CommonJS
module.exports = {
  geocodeAddress,
  batchGeocodeAddresses,
  reverseGeocode
};