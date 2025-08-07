// scripts/geocode-events.js
// Backfill existing events with coordinates

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { batchGeocodeAddresses } = require('../utils/geocoding.js');

async function geocodeExistingEvents() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  
  console.log('🗺️ Starting geocoding of existing events...');
  
  try {
    // Get all events without coordinates that have addresses
    const { data: events, error } = await supabase
      .from('events')
      .select('id, address')
      .is('latitude', null)
      .is('longitude', null)
      .not('address', 'is', null)
      .neq('address', '');
    
    if (error) {
      console.error('Error fetching events:', error);
      return;
    }
    
    if (!events || events.length === 0) {
      console.log('✅ No events need geocoding');
      return;
    }
    
    console.log(`📍 Found ${events.length} events to geocode`);
    
    // Batch geocode addresses
    const geocodedResults = await batchGeocodeAddresses(
      events.map(event => ({ id: event.id, address: event.address }))
    );
    
    console.log(`✅ Successfully geocoded ${geocodedResults.length}/${events.length} events`);
    
    // Update events with coordinates
    for (const result of geocodedResults) {
      const { error: updateError } = await supabase
        .from('events')
        .update({
          latitude: result.latitude,
          longitude: result.longitude
        })
        .eq('id', result.id);
      
      if (updateError) {
        console.error(`Error updating event ${result.id}:`, updateError);
      } else {
        console.log(`✅ Updated event ${result.id}`);
      }
    }
    
    console.log('🎉 Geocoding complete!');
    
  } catch (error) {
    console.error('Geocoding script error:', error);
  }
}

// Run if called directly
if (require.main === module) {
  geocodeExistingEvents();
}