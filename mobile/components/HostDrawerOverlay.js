// mobile/components/HostDrawerOverlay.js
import React, { useRef, useState } from 'react';
import { Animated, Dimensions, TouchableOpacity, StyleSheet, View, TextInput, Text, ScrollView, Alert, Modal, Keyboard, Platform, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { supabase } from '../utils/supabase';
import { useAuth } from '../auth/AuthProvider';
import realTimeChatManager from '../utils/realTimeChat';
import DateTimePicker from '@react-native-community/datetimepicker';
import SimpleCropModal from './SimpleCropModal';

function getCardAspect(){
  const screenW = Dimensions.get('window').width - 32; // assume 16px margin both sides similar to EventCard
  const cardH = 200; // EventCard image height
  const w = Math.round(screenW);
  const h = cardH;
  function gcd(a,b){ return b===0? a : gcd(b, a % b); }
  const g = gcd(w,h);
  return [Math.round(w/g), Math.round(h/g)];
}

export default function HostDrawerOverlay({ onCreated }) {
  const sheetH = Dimensions.get('window').height * 0.8;
  const peek   = 28; // visible when closed
  const sheetY = useRef(new Animated.Value(sheetH - peek)).current;
  const [open, setOpen] = useState(false);

  const openPos = sheetH * 0.25;
  const toggle = () => {
    Animated.timing(sheetY, { toValue: open ? sheetH - peek : openPos, duration: 300, useNativeDriver: true }).start();
    setOpen(!open);
  };

  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [title, setTitle]    = useState('');
  const [vibe, setVibe]      = useState('chill');
  const [desc, setDesc]      = useState('');
  const [capacity, setCapacity] = useState('');
  const [price, setPrice]    = useState(''); // in USD text
  const [refund, setRefund]  = useState('no_refund');
  const [paid, setPaid] = useState(false);
  const [strikeCount, setStrikeCount] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingVals, setPendingVals] = useState(null);
  const [address, setAddress] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [imageUri, setImageUri] = useState(null);
  const [cropUri, setCropUri]   = useState(null);
  const [cropOpen, setCropOpen] = useState(false);
  const roundToNextHalfHour = (d)=>{ const ms=30*60*1000; return new Date(Math.ceil(d.getTime()/ms)*ms); };
  const [startTime, setStartTime] = useState(()=> roundToNextHalfHour(new Date()));
  const [endTime, setEndTime]     = useState(()=> new Date(roundToNextHalfHour(new Date()).getTime()+60*60*1000));
  const [showDate, setShowDate]   = useState(false);
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd]     = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [busy, setBusy]      = useState(false);
  const [canCharge, setCanCharge] = useState(false);
  const [contentH, setContentH] = useState(0);
  const [containerH, setContainerH] = useState(0);
  const scrollY = useRef(new Animated.Value(0)).current;

  const indicatorSize = containerH && contentH ? (containerH/contentH)*containerH : 0;
  const maxScroll = Math.max(1, contentH - containerH);
  const maxIndicatorTravel = Math.max(0, containerH - indicatorSize);
  const translateY = scrollY.interpolate({
    inputRange: [0, maxScroll],
    outputRange: [0, maxIndicatorTravel],
    extrapolate: 'clamp',
  });

  // fetch stripe_account_id and strike count
  React.useEffect(()=>{
    if(!user?.id) return;
    (async()=>{
      const { data } = await supabase.from('profiles').select('stripe_account_id').eq('id', user.id).single();
      setCanCharge(!!data?.stripe_account_id);
      
      // Fetch strike count
      const { data: strikeData } = await supabase
        .from('v_host_strikes_last6mo')
        .select('strike_count')
        .eq('host_id', user.id)
        .maybeSingle();
      if(strikeData){
        setStrikeCount(strikeData.strike_count ?? 0);
      }
    })();
  },[user?.id]);

  const priceEnabled = paid && canCharge && parseFloat(price) > 0;

  const MAPBOX_TOKEN = Constants?.expoConfig?.extra?.mapboxToken || process.env?.EXPO_PUBLIC_MAPBOX_TOKEN || process.env?.NEXT_PUBLIC_MAPBOX_TOKEN || '';

  React.useEffect(()=>{
    if(!address || address.trim().length<3 || !MAPBOX_TOKEN){ setSuggestions([]); return; }
    const ctl = new AbortController();
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?autocomplete=true&limit=5&access_token=${MAPBOX_TOKEN}`;
    fetch(url,{ signal: ctl.signal })
      .then(r=>r.json())
      .then(d=> setSuggestions(d.features??[]))
      .catch(()=>{});
    return ()=> ctl.abort();
  },[address, MAPBOX_TOKEN]);

  const getMinStart = ()=>{ const now=Date.now(); const base = (canCharge && parseFloat(price)>0)? now+7*24*60*60*1000 : now; return roundToNextHalfHour(new Date(base)); };

  React.useEffect(()=>{ const minS=getMinStart(); if(startTime<minS){ setStartTime(minS); setEndTime(new Date(minS.getTime()+60*60*1000)); } },[price, canCharge]);

        async function pickImage(){
     const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
     if(status!=='granted' && status!=='limited'){
       Alert.alert('Permission required','We need photo access to pick an image');
       return;
     }
     const res = await ImagePicker.launchImageLibraryAsync({
       mediaTypes: ImagePicker.MediaTypeOptions.Images,
       quality: 1,
       allowsEditing: false,
     });
     if(!res.canceled){
       const uri = res.assets[0].uri;
       setCropUri(uri);
       setCropOpen(true);
     }
   }

  async function uploadImageMobile(uri){
    if(!uri) return null;
    
    try {
      let blob;
      
      if (uri.startsWith('data:')) {
        // Data URI - convert directly
        const response = await fetch(uri);
        blob = await response.blob();
      } else {
        // File URI - use FileSystem for iOS compatibility
        
        try {
          // Read file as base64
          const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          
          // Convert base64 to blob
          const byteCharacters = atob(base64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          blob = new Blob([byteArray], { type: 'image/jpeg' });
        } catch (fsError) {
          // Fallback to fetch if FileSystem fails
          
          // Fallback to fetch
          const response = await fetch(uri);
          blob = await response.blob();
        }
      }
      
      console.log('Blob size:', blob.size, 'type:', blob.type);
      
      // Final check for empty blob
      if (blob.size === 0) {
        throw new Error('Image blob is empty - file may be corrupted or inaccessible');
      }
      
      // Generate filename with proper extension
      const ext = blob.type === 'image/jpeg' ? 'jpg' : 
                  blob.type === 'image/png' ? 'png' : 
                  uri.split('.').pop() || 'jpg';
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      
      // Ensure we have a valid image blob  
      if (blob.size === 0) {
        throw new Error('Image blob is empty - file may be corrupted or inaccessible');
      }
      
      // Try uploading with different methods
      let uploadResult;
      let uploadError;
      
      // Method 1: Try direct file upload with FileSystem
      if (!uri.startsWith('data:')) {
        try {
          console.log('Trying direct FileSystem upload...');
          const fileInfo = await FileSystem.getInfoAsync(uri);
          console.log('File info:', fileInfo);
          
          if (fileInfo.exists) {
            uploadResult = await supabase.storage
              .from('event-images')
              .upload(filename, {
                uri: uri,
                type: 'image/jpeg',
                name: filename,
              }, { 
                upsert: false
              });
              
            if (!uploadResult.error) {
              console.log('Direct upload successful!');
            } else {
              console.log('Direct upload failed:', uploadResult.error);
              throw uploadResult.error;
            }
          }
        } catch (directError) {
          console.log('Direct upload failed, trying blob method:', directError);
          
          // Fallback to blob method
          uploadResult = await supabase.storage
            .from('event-images')
            .upload(filename, blob, { 
              upsert: false,
              contentType: blob.type || 'image/jpeg'
            });
            uploadError = uploadResult.error;
        }
      } else {
        // Data URI - use blob method
        uploadResult = await supabase.storage
          .from('event-images')
          .upload(filename, blob, { 
            upsert: false,
            contentType: blob.type || 'image/jpeg'
          });
        uploadError = uploadResult.error;
      }
      
      const { data, error } = uploadResult;
      
      if(error) {
        console.error('Supabase upload error:', error);
        throw error;
      }
      
      console.log('Upload successful:', data);
      
      // Verify the uploaded file size
      try {
        const { data: fileData, error: getError } = await supabase.storage
          .from('event-images')
          .getPublicUrl(filename);
          
        if (!getError) {
          console.log('Uploaded file public URL:', fileData.publicUrl);
          
          // Try to get file info
          const { data: listData, error: listError } = await supabase.storage
            .from('event-images')
            .list('', { search: filename });
            
          if (!listError && listData) {
            const uploadedFile = listData.find(f => f.name === filename);
            console.log('Uploaded file info:', uploadedFile);
          }
        }
      } catch (verifyError) {
        console.warn('Could not verify upload:', verifyError);
      }
      
      return filename;
    } catch (err) {
      console.error('Image upload failed:', err);
      throw err;
    }
  }

  const createEvent = async () => {
    // Basic validation
    if (!title.trim()) { Alert.alert('Error', 'Title required'); return; }
    if (title.trim().length < 3) { Alert.alert('Error', 'Title too short'); return; }
    if (title.trim().length > 60) { Alert.alert('Error', 'Title too long'); return; }
    if (!address.trim()) { Alert.alert('Error', 'Address required'); return; }
    if (address.trim().length > 120) { Alert.alert('Error', 'Address too long'); return; }
    if (desc.length > 280) { Alert.alert('Error', 'Description too long'); return; }
    
    const minS = getMinStart();
    if (startTime < minS) { Alert.alert('Error', 'Start date too soon'); return; }
    if (endTime - startTime < 60*60*1000) { Alert.alert('Error', 'Events are locked to a 1-hour minimum — don\'t worry if yours wraps early. We won\'t tell anyone.'); return; }
    
    const capInt = parseInt(capacity, 10);
    if (capacity && (Number.isNaN(capInt) || capInt < 1)) { Alert.alert('Error', 'Capacity must be a positive number'); return; }
    
    const priceFloat = parseFloat(price);
    if (paid && (Number.isNaN(priceFloat) || priceFloat < 0.5)) { Alert.alert('Error', 'Price must be at least $0.50'); return; }

    const vals = {
      title: title.trim(),
      vibe,
      description: desc.trim(),
      address: address.trim(),
      starts_at: startTime.toISOString(),
      ends_at: endTime.toISOString(),
      refund_policy: priceEnabled ? refund : 'no_refund',
      price_in_cents: priceEnabled ? priceFloat : null,
      rsvp_capacity: capInt || null,
      image: imageUri
    };

    // If host has at least one prior guest-attended cancellation, show warning modal first
    if (strikeCount >= 1) {
      setPendingVals(vals);
      setConfirmOpen(true);
      return;
    }
    submitEvent(vals);
  };

  const submitEvent = async (vals) => {
    setBusy(true);
    try {
      let img_path = null;
      if (vals.image) {
        img_path = await uploadImageMobile(vals.image);
      }

      const baseCents = paid ? Math.round((vals.price_in_cents || 0) * 100) : null;

      const payload = {
        host_id: user?.id ?? null,
        title: vals.title,
        vibe: vals.vibe,
        description: vals.description || null,
        address: vals.address,
        starts_at: vals.starts_at,
        ends_at: vals.ends_at,
        refund_policy: paid ? vals.refund_policy : "no_refund",
        price_in_cents: baseCents,
        rsvp_capacity: vals.rsvp_capacity,
        img_path,
        status: "pending", // Match web version
      };

      // Insert directly into Supabase (mobile doesn't have access to Next.js API routes)
      const { data, error } = await supabase.from('events').insert(payload).select().single();
      
      if (error) {
        throw new Error(error.message || 'Submission failed');
      }

      // Auto-RSVP the host
      try {
        await supabase.from('rsvps').insert({
          event_id: data.id,
          user_id: user.id,
          paid: payload.price_in_cents ? true : false,
        });

        // Removed background auto-subscribe for host chat to conserve resources
      } catch (rsvpErr) {
        console.warn('Auto-RSVP failed:', rsvpErr);
      }

      // Trigger basic content moderation (keyword filtering only for mobile)
      try {
        const moderationResult = await moderateContent(data);
        if (!moderationResult.approved) {
          // Delete the event if moderation fails
          await supabase.from('events').delete().eq('id', data.id);
          Alert.alert('Content Moderation Failed', moderationResult.reason || 'Your content violates community guidelines');
          return;
        }
        
        // Update event status to approved if moderation passes
        await supabase.from('events').update({ 
          status: 'approved',
          ai_score: moderationResult.aiScore,
          updated_at: new Date().toISOString()
        }).eq('id', data.id);
        

      } catch (modError) {
        console.warn('Moderation failed, auto-approving for mobile:', modError);
        // Auto-approve for mobile if moderation fails
        await supabase.from('events').update({ 
          status: 'approved',
          ai_score: null,
          updated_at: new Date().toISOString()
        }).eq('id', data.id);
      }

      Alert.alert('Success', 'Event created successfully! 🎉');
      // Reset form
      setTitle('');
      setDesc('');
      setAddress('');
      setCapacity('');
      setPrice('');
      setPaid(false);
      setImageUri(null);
      toggle();
      onCreated?.();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
    setBusy(false);
  };

  // Modal confirm handlers
  const handleModalConfirm = () => {
    if (!pendingVals) return;
    setConfirmOpen(false);
    submitEvent(pendingVals);
    setPendingVals(null);
  };

  const handleModalCancel = () => {
    setConfirmOpen(false);
    setPendingVals(null);
  };

  return (
    <Animated.View style={[styles.container, { height: sheetH, transform:[{ translateY: sheetY }] }]}>
      {/* FAB handle */}
      <TouchableOpacity onPress={toggle} style={styles.handleTouch} hitSlop={{ top:16,left:16,right:16,bottom:16 }}>
        <View style={styles.handleCircle}>
          <Ionicons name={open ? 'remove' : 'add'} size={32} color="#fff" />
        </View>
      </TouchableOpacity>

      <View style={styles.drawerInner} onLayout={e=>setContainerH(e.nativeEvent.layout.height)}>
        <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
        <ScrollView
          style={{ flex:1 }}
          contentContainerStyle={{ padding:20, paddingTop:48, paddingBottom:200 + insets.bottom, flexGrow:1 }}
          bounces={false}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={(w,h)=>setContentH(h)}
        >
          {/* Thumbnail */}
          <TouchableOpacity style={styles.thumbRect} onPress={pickImage}>
            {imageUri ? (
              <Image source={{ uri:imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" pointerEvents="none" />
            ) : (
              <Text style={styles.thumbTxt}>Tap to add image</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.label}>Event Title</Text>
          <TextInput
            style={styles.input}
            placeholder="Sunset Picnic"
            value={title}
            onChangeText={setTitle}
            placeholderTextColor="#aaa"
          />

          <Text style={[styles.label,{ marginTop:16 }]}>Vibe</Text>
          <View style={styles.vibeRow}>
            {['chill','hype','creative','active'].map(v=>(
              <TouchableOpacity key={v} style={[styles.vibeBtn, vibe===v && styles.vibeBtnActive]} onPress={()=>setVibe(v)}>
                <Text style={[styles.vibeTxt, vibe===v && styles.vibeTxtActive]}>{v}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Paid Event Toggle */}
          <View style={[styles.toggleRow, { marginTop: 16 }]}>
            <Text style={styles.label}>Paid Event</Text>
            <TouchableOpacity 
              style={[styles.toggle, paid && styles.toggleActive]} 
              onPress={() => setPaid(!paid)}
            >
              <View style={[styles.toggleThumb, paid && styles.toggleThumbActive]} />
            </TouchableOpacity>
          </View>

          {paid && canCharge && (
            <>
              {/* Price Input */}
              <Text style={[styles.label, { marginTop: 16 }]}>Ticket Price (USD)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 5.00"
                value={price}
                onChangeText={setPrice}
                placeholderTextColor="#aaa"
                keyboardType="decimal-pad"
              />

              {/* Refund Policy */}
              <Text style={[styles.label, { marginTop: 16 }]}>Refund Policy</Text>
              <View style={styles.refundRow}>
                {[
                  { value: 'anytime', label: 'Anytime' },
                  { value: '1week', label: '1 Week' },
                  { value: '48h', label: '48h' },
                  { value: '24h', label: '24h' },
                  { value: 'no_refund', label: 'No Refunds' }
                ].map(option => (
                  <TouchableOpacity 
                    key={option.value} 
                    style={[styles.refundBtn, refund === option.value && styles.refundBtnActive]} 
                    onPress={() => setRefund(option.value)}
                  >
                    <Text style={[styles.refundTxt, refund === option.value && styles.refundTxtActive]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {paid && !canCharge && (
            <Text style={[styles.warnTxt, { marginTop: 8 }]}>
              Set up Stripe payments in settings to charge for events
            </Text>
          )}

          {/* Description */}
          <Text style={[styles.label,{ marginTop:16 }]}>Description</Text>
          <TextInput
            style={[styles.input,{ height:80, textAlignVertical:'top' }]}
            placeholder="Tell people what makes this vibe special…"
            value={desc}
            onChangeText={setDesc}
            placeholderTextColor="#aaa"
            multiline
            maxLength={280}
          />

          {/* RSVP Capacity */}
          <Text style={[styles.label, { marginTop: 16 }]}>RSVP Capacity (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Leave blank for unlimited"
            value={capacity}
            onChangeText={setCapacity}
            placeholderTextColor="#aaa"
            keyboardType="number-pad"
          />

          {/* Address */}
          <Text style={[styles.label,{ marginTop:16 }]}>Address</Text>
          <TouchableOpacity 
            style={[styles.input, { justifyContent: 'center' }]} 
            onPress={() => setShowAddressModal(true)}
          >
            <Text style={{ color: address ? '#fff' : '#aaa' }}>
              {address || '123 Main St, City'}
            </Text>
          </TouchableOpacity>

          {/* Start Date */}
          <Text style={[styles.label,{ marginTop:16 }]}>Start Date</Text>
          <TouchableOpacity style={styles.input} onPress={()=>setShowDate(true)}>
            <Text style={{ color:'#fff' }}>{new Date(startTime).toLocaleDateString()}</Text>
          </TouchableOpacity>

          {/* Times Row */}
          <View style={[styles.timeRow,{ marginTop:16 }]}>
            <View style={{ flex:1, marginRight:8 }}>
              <Text style={styles.label}>Start Time</Text>
              <TouchableOpacity style={styles.input} onPress={()=>setShowStart(true)}>
                <Text style={{ color:'#fff' }}>{new Date(startTime).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'})}</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flex:1 }}>
              <Text style={styles.label}>End Time</Text>
              <TouchableOpacity style={styles.input} onPress={()=>setShowEnd(true)}>
                <Text style={{ color:'#fff' }}>{new Date(endTime).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'})}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={[styles.createBtn, busy && { opacity:0.5 }]} onPress={createEvent} disabled={busy}>
            <Text style={styles.createTxt}>{busy? 'Creating…':'Create Draft'}</Text>
          </TouchableOpacity>

        </ScrollView>
        {/* custom scrollbar */}
        {contentH>containerH && (
          <Animated.View style={[styles.scrollBar,{ height: indicatorSize, transform:[{ translateY }] }]} />
        )}
      </View>
      {/* Date Picker Modal */}
      {showDate && (
        <Modal transparent animationType="fade" visible onRequestClose={()=>setShowDate(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <TouchableOpacity style={styles.closeBtn} onPress={()=>setShowDate(false)}>
                <Ionicons name="close" size={26} color="#fff" />
              </TouchableOpacity>
              <DateTimePicker value={startTime} minimumDate={getMinStart()} mode="date" display={Platform.OS==='ios'?'spinner':'default'} themeVariant="dark" textColor="#fff" onChange={(e,date)=>{ if(!date) return; const ns=new Date(date); ns.setHours(startTime.getHours(), startTime.getMinutes(),0,0); const minS=getMinStart(); if(ns<minS) ns.setTime(minS.getTime()); setStartTime(ns); if(endTime-ns<60*60*1000) setEndTime(new Date(ns.getTime()+60*60*1000)); }} />
            </View>
          </View>
        </Modal>
      )}
      {/* Start Time Picker */}
      {showStart && (
        <Modal transparent animationType="fade" visible onRequestClose={()=>setShowStart(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <TouchableOpacity style={styles.closeBtn} onPress={()=>setShowStart(false)}>
                <Ionicons name="close" size={26} color="#fff" />
              </TouchableOpacity>
              <DateTimePicker value={startTime} mode="time" display={Platform.OS==='ios'?'spinner':'default'} minuteInterval={30} themeVariant="dark" textColor="#fff" onChange={(e,date)=>{ if(!date) return; const r=roundToNextHalfHour(date); const minS=getMinStart(); const valid=r<minS?minS:r; setStartTime(valid); if(endTime-valid<60*60*1000) setEndTime(new Date(valid.getTime()+60*60*1000)); }} />
            </View>
          </View>
        </Modal>
      )}
      {/* End Time Picker */}
      {showEnd && (
        <Modal transparent animationType="fade" visible onRequestClose={()=>setShowEnd(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <TouchableOpacity style={styles.closeBtn} onPress={()=>setShowEnd(false)}>
                <Ionicons name="close" size={26} color="#fff" />
              </TouchableOpacity>
              <DateTimePicker value={endTime} mode="time" display={Platform.OS==='ios'?'spinner':'default'} minuteInterval={30} themeVariant="dark" textColor="#fff" onChange={(e,date)=>{ if(!date) return; const r=roundToNextHalfHour(date); if(r-startTime<60*60*1000){ setEndTime(new Date(startTime.getTime()+60*60*1000)); } else { setEndTime(r);} }} />
            </View>
          </View>
        </Modal>
      )}

      {/* Address Input Modal */}
      {showAddressModal && (
        <AddressInputModal
          visible={showAddressModal}
          address={address}
          onClose={() => setShowAddressModal(false)}
          onSelectAddress={(selectedAddress) => {
            setAddress(selectedAddress);
            setShowAddressModal(false);
          }}
          suggestions={suggestions}
          setSuggestions={setSuggestions}
          MAPBOX_TOKEN={MAPBOX_TOKEN}
        />
      )}
      {/* Second Strike Modal */}
      {confirmOpen && pendingVals && (
        <SecondStrikeModal
          open={confirmOpen}
          onConfirm={handleModalConfirm}
          onCancel={handleModalCancel}
          priceCents={paid ? Math.round((parseFloat(price) || 0) * 100) : 0}
          capacity={parseInt(capacity, 10) || null}
        />
      )}
      
             <SimpleCropModal 
        visible={cropOpen} 
        imageUri={cropUri} 
        onClose={() => setCropOpen(false)} 
        onCrop={(uri) => { 
          setImageUri(uri); 
          setCropOpen(false); 
        }} 
      />
    </Animated.View>
  );
}

// Full-screen Address Input Modal
function AddressInputModal({ visible, address, onClose, onSelectAddress, suggestions, setSuggestions, MAPBOX_TOKEN }) {
  const [localAddress, setLocalAddress] = useState(address);

  React.useEffect(() => {
    if (!localAddress || localAddress.trim().length < 3 || !MAPBOX_TOKEN) {
      setSuggestions([]);
      return;
    }
    
    const ctl = new AbortController();
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(localAddress)}.json?autocomplete=true&limit=8&access_token=${MAPBOX_TOKEN}`;
    
    fetch(url, { signal: ctl.signal })
      .then(r => r.json())
      .then(d => setSuggestions(d.features ?? []))
      .catch(() => {});
      
    return () => ctl.abort();
  }, [localAddress, MAPBOX_TOKEN, setSuggestions]);

  const handleConfirm = () => {
    onSelectAddress(localAddress);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.addressModalContainer}>
        {/* Header */}
        <View style={styles.addressModalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Event Address</Text>
          <TouchableOpacity onPress={handleConfirm} style={styles.headerBtn}>
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* VybeLocal Microcopy */}
        <View style={styles.microCopyContainer}>
          <Text style={styles.microCopyTitle}>Where's the vibe? 🌟</Text>
          <Text style={styles.microCopySubtitle}>
            Help people find your event with a clear address — no "behind the Starbucks" vibes here
          </Text>
        </View>

        {/* Search Input */}
        <View style={styles.addressInputContainer}>
          <TextInput
            style={styles.addressInput}
            placeholder="123 Main St, Your City..."
            value={localAddress}
            onChangeText={setLocalAddress}
            placeholderTextColor="#666"
            autoFocus={true}
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleConfirm}
          />
        </View>

        {/* Suggestions List */}
        <ScrollView style={styles.suggestionsList} keyboardShouldPersistTaps="handled">
          {suggestions.map((suggestion) => (
            <TouchableOpacity
              key={suggestion.id}
              style={styles.suggestionItem}
              onPress={() => onSelectAddress(suggestion.place_name)}
            >
              <Ionicons name="location-outline" size={20} color="#666" style={styles.suggestionIcon} />
              <View style={styles.suggestionText}>
                <Text style={styles.suggestionTitle} numberOfLines={1}>
                  {suggestion.text || suggestion.place_name}
                </Text>
                <Text style={styles.suggestionSubtitle} numberOfLines={1}>
                  {suggestion.place_name}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
          
          {localAddress.length >= 3 && suggestions.length === 0 && (
            <View style={styles.noResultsContainer}>
              <Text style={styles.noResultsText}>No addresses found</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// Simplified fee calculation for mobile (matches lib/fees.js logic)
function calcFees(priceCents) {
  if (!priceCents || priceCents <= 0) return { stripe: 0, platform: 0, total: 0 };
  const stripe = Math.round(priceCents * 0.029 + 30); // 2.9% + 30¢
  const platform = Math.round(priceCents * 0.05); // 5%
  return { stripe, platform, total: stripe + platform };
}

// Full content moderation for mobile (matches API logic with OpenAI)
async function moderateContent(eventData) {
  const text = `${eventData.title || ''} ${eventData.description || ''}`;
  
  // VybeLocal custom scam/self-promo filter (same as API)
  const scamPromoKeywords = [
    "link in bio", "check my linktree", "onlyfans", "fansly", "my OF", "DM for rates", 
    "book me", "inquiries via", "paid collab", "tap the link", "support me via", 
    "full post here", "bit.ly", "linktr.ee", "bio.site", "beacons.ai",
    "DM me to join", "who wants to make extra income", "6-figure mindset", 
    "financial freedom", "boss babe", "hustle culture", "side hustle success",
    "be your own boss", "invest in yourself", "grind now, shine later",
    "once-in-a-lifetime opportunity", "limited spots only", "guaranteed return",
    "this will change your life", "exclusive drop", "act fast", "urgent",
    "100% legit", "verified vendor", "make money fast",
    "not a real event", "just vibes", "details in DM", "pull up if you know",
    "cashapp me to hold your spot", "drop your IG", "add me on snap",
    "content creator meetup", "social media masterclass", "how to grow your brand",
    "engagement workshop", "photography collab", "brand building", "just networking"
  ];
  
  const scamPromoRegex = new RegExp(
    scamPromoKeywords.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join("|"),
    "i"
  );

  if (scamPromoRegex.test(text)) {
    return {
      approved: false,
      reason: 'Content violates community guidelines - promotional content detected',
      aiScore: null
    };
  }

  // Call OpenAI Moderation API (if available)
  const openaiKey = Constants?.expoConfig?.extra?.openaiKey || process.env?.EXPO_PUBLIC_OPENAI_KEY;
  
  if (!openaiKey) {
    return { approved: true, aiScore: null, note: 'Approved via keyword filtering (no AI key)' };
  }

  let mod;
  try {
    console.log('Calling OpenAI moderation API from mobile...');
    const openaiRes = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: text, model: 'omni-moderation-latest' }),
    });
    
    mod = await openaiRes.json();
    console.log('OpenAI moderation response:', mod);
    
    if (mod.error || !mod.results) {
      console.error('OpenAI moderation failed:', mod);
      // Auto-approve when moderation fails (fail open for normal content)
      return { approved: true, aiScore: null, note: 'Auto-approved due to moderation failure' };
    }
  } catch (err) {
    console.error('OpenAI moderation error:', err);
    // Auto-approve when moderation fails (fail open for normal content)
    return { approved: true, aiScore: null, note: 'Auto-approved due to moderation failure' };
  }

  const maxScore = Math.max(...Object.values(mod.results[0].category_scores));
  
  // Additional promo regex check
  const promoRx = /(instagram|tiktok|onlyfans|linktr\.ee|discord|facebook|mlm|multi[- ]?level|pyramid scheme|cashapp|venmo|paypal|zelle|linktree|beacons\.ai|direct message|dm me|http[s]?:\/\/)/i;
  const hasPromo = promoRx.test(text);

  // Status decision tree (same as API)
  let approved = true;
  let reason = null;
  
  if (maxScore >= 0.7 || hasPromo) {
    approved = false;
    reason = hasPromo ? 'Content contains promotional links or social media references' : 'Content flagged as inappropriate by AI moderation';
  } else if (maxScore >= 0.4) {
    approved = false;
    reason = 'Content flagged for review by AI moderation';
  }

  return { approved, reason, aiScore: maxScore };
}

// Second Strike Modal Component
function SecondStrikeModal({ open, onConfirm, onCancel, priceCents, capacity }) {
  if (!open) return null;
  
  const price = (priceCents / 100).toFixed(2);
  const feePer = priceCents ? calcFees(priceCents).stripe : 0;
  const penalty = capacity && feePer ? ((feePer * capacity) / 100).toFixed(2) : '0.00';

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onCancel}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { maxWidth: '90%' }]}>
          <Text style={styles.modalTitle}>You're about to go live.</Text>
          <Text style={styles.modalText}>
            Thanks for putting something out into the world — we back creators who show up.{'\n\n'}
            Quick heads-up: you've already cancelled one event after people commited to the plan.
            If you cancel this one too, you'll have to cover Stripe's processing fees on any paid tickets.{'\n\n'}
            {feePer ? `Each paid RSVP costs $${(feePer/100).toFixed(2)} in non-refundable Stripe fees.\n\n` : ''}
            Not sure you can follow through? It's okay to hold off.
            When you post, we assume you're ready.
          </Text>
          <View style={styles.modalButtons}>
            <TouchableOpacity onPress={onCancel} style={styles.modalCancelBtn}>
              <Text style={styles.modalCancelText}>Never mind</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onConfirm} style={styles.modalConfirmBtn}>
              <Text style={styles.modalConfirmText}>Publish event</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const sage = '#8FB996';

const styles = StyleSheet.create({
  container:{ position:'absolute', left:0,right:0,bottom:0, overflow:'visible', zIndex:30 },
  handleTouch:{ position:'absolute', top:-28, alignSelf:'center', zIndex:1000 },
  handleCircle:{ width:56,height:56,borderRadius:28,backgroundColor:sage,justifyContent:'center',alignItems:'center',shadowColor:'#000',shadowOpacity:0.25,shadowRadius:6,shadowOffset:{width:0,height:2} },
  drawerInner:{ flex:1, borderTopLeftRadius:16, borderTopRightRadius:16, overflow:'hidden' },
  label:{ color:'#fff', fontSize:14, fontWeight:'600', marginBottom:6 },
  input:{ backgroundColor:'rgba(255,255,255,0.1)', color:'#fff', padding:10, borderRadius:8 },
  vibeRow:{ flexDirection:'row', flexWrap:'wrap', marginTop:4 },
  vibeBtn:{ paddingVertical:6, paddingHorizontal:12, borderRadius:16, borderWidth:1, borderColor:'#fff', marginRight:8, marginTop:8 },
  vibeBtnActive:{ backgroundColor:'#fff' },
  vibeTxt:{ color:'#fff', fontSize:12, fontWeight:'600' },
  vibeTxtActive:{ color:'#000' },
  createBtn:{ marginTop:24, backgroundColor:sage, paddingVertical:12, borderRadius:8, alignItems:'center' },
  createTxt:{ color:'#fff', fontWeight:'700', fontSize:16 },
  warnTxt:{ color:'#ff6b6b', fontSize:13, marginTop:6, fontWeight:'600' },
  inputDisabled:{ backgroundColor:'rgba(255,255,255,0.05)', borderColor:'#ff6b6b', borderWidth:1 },
  scrollBar:{ position:'absolute', right:4, top:48, width:3, borderRadius:2, backgroundColor:'rgba(255,255,255,0.6)' },
  modalOverlay:{ flex:1, justifyContent:'center', alignItems:'center', backgroundColor:'rgba(0,0,0,0.6)' },
  modalContent:{ backgroundColor:'#111', padding:20, borderRadius:16, width:'80%' },
  closeBtn:{ position:'absolute', top:10, right:10 },
  suggList:{ borderRadius:8, marginTop:4, overflow:'hidden' },
  suggItem:{ paddingVertical:8, paddingHorizontal:12 },
  suggTxt:{ color:'#fff', fontSize:13 },
  timeRow:{ flexDirection:'row', alignItems:'flex-start' },
  thumbRect:{ width:'100%', height:200, borderRadius:16, backgroundColor:'rgba(255,255,255,0.1)', justifyContent:'center', alignItems:'center', marginBottom:16 },
  thumbTxt:{ color:'#888', fontSize:14 },
  // Toggle styles
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggle: { width: 50, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.2)', padding: 2 },
  toggleActive: { backgroundColor: sage },
  toggleThumb: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff' },
  toggleThumbActive: { transform: [{ translateX: 20 }] },
  // Refund policy styles
  refundRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  refundBtn: { paddingVertical: 6, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1, borderColor: '#fff', marginRight: 6, marginTop: 6 },
  refundBtnActive: { backgroundColor: '#fff' },
  refundTxt: { color: '#fff', fontSize: 11, fontWeight: '600' },
  refundTxtActive: { color: '#000' },
  // Modal styles
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  modalText: { color: '#ccc', fontSize: 14, lineHeight: 20, marginBottom: 20 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  modalCancelBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.2)' },
  modalCancelText: { color: '#fff', fontSize: 14 },
  modalConfirmBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: sage },
  modalConfirmText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  // Address modal styles
  addressModalContainer: { flex: 1, backgroundColor: '#000' },
  addressModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  microCopyContainer: { 
    paddingHorizontal: 20, 
    paddingVertical: 15,
    backgroundColor: '#111',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: sage,
  },
  microCopyTitle: { 
    color: '#fff', 
    fontSize: 18, 
    fontWeight: '600',
    marginBottom: 8,
  },
  microCopySubtitle: { 
    color: '#ccc', 
    fontSize: 14, 
    lineHeight: 20,
    fontStyle: 'italic',
  },
  addressInputContainer: { padding: 20 },
  addressInput: {
    backgroundColor: '#111',
    color: '#fff',
    padding: 15,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  suggestionsList: { flex: 1, paddingHorizontal: 20 },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  suggestionIcon: { marginRight: 12 },
  suggestionText: { flex: 1 },
  suggestionTitle: { color: '#fff', fontSize: 16, fontWeight: '500' },
  suggestionSubtitle: { color: '#999', fontSize: 14, marginTop: 2 },
  noResultsContainer: { padding: 40, alignItems: 'center' },
  noResultsText: { color: '#666', fontSize: 16 },
}); 