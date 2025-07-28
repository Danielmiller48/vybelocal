// mobile/components/HostDrawerOverlay.js
import React, { useRef, useState } from 'react';
import { Animated, Dimensions, TouchableOpacity, StyleSheet, View, TextInput, Text, ScrollView, Alert, Modal, Keyboard, Platform, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { supabase } from '../utils/supabase';
import { useAuth } from '../auth/AuthProvider';
import DateTimePicker from '@react-native-community/datetimepicker';

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
  const [address, setAddress] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [imageUri, setImageUri] = useState(null);
  const roundToNextHalfHour = (d)=>{ const ms=30*60*1000; return new Date(Math.ceil(d.getTime()/ms)*ms); };
  const [startTime, setStartTime] = useState(()=> roundToNextHalfHour(new Date()));
  const [endTime, setEndTime]     = useState(()=> new Date(roundToNextHalfHour(new Date()).getTime()+60*60*1000));
  const [showDate, setShowDate]   = useState(false);
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd]     = useState(false);
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

  // fetch stripe_account_id
  React.useEffect(()=>{
    if(!user?.id) return;
    (async()=>{
      const { data } = await supabase.from('profiles').select('stripe_account_id').eq('id', user.id).single();
      setCanCharge(!!data?.stripe_account_id);
    })();
  },[user?.id]);

  const priceEnabled = canCharge && parseFloat(price) > 0;

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
    if(status!=='granted'){ Alert.alert('Permission required','We need media library permission'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality:0.8 });
    if(!res.canceled){
      const uri = res.assets[0].uri;
      setImageUri(uri);
    }
  }

  async function uploadImageMobile(uri){
    if(!uri) return null;
    const resp = await fetch(uri);
    const blob = await resp.blob();
    const ext = uri.split('.').pop() || 'jpg';
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('event-images').upload(filename, blob, { upsert:false });
    if(error) throw error;
    return filename;
  }

  const createEvent = async () => {
    if (!title.trim()) { Alert.alert('Title required'); return; }
    if(!address.trim()){ Alert.alert('Address required'); return; }
    const minS = getMinStart();
    if(startTime<minS){ Alert.alert('Start date too soon'); return; }
    if(endTime-startTime<60*60*1000){ Alert.alert('End time must be at least 1h after start'); return; }
    setBusy(true);
    try {
      const insertObj = {
        title: title.trim(),
        vibe,
        host_id: user.id,
        status: 'draft',
        starts_at: startTime.toISOString(),
        ends_at: endTime.toISOString(),
        address: address.trim(),
        description: desc.trim() || null,
        refund_policy: priceEnabled ? refund : 'no_refund',
      };
      if(imageUri){
        const imgKey = await uploadImageMobile(imageUri);
        insertObj.img_path = imgKey;
      }
      const capInt = parseInt(capacity,10);
      if (!Number.isNaN(capInt)) insertObj.rsvp_capacity = capInt;
      const priceFloat = parseFloat(price);
      if (!Number.isNaN(priceFloat) && priceFloat>0) insertObj.price_in_cents = Math.round(priceFloat*100);

      const { error } = await supabase.from('events').insert(insertObj);
      if (error) throw error;
      Alert.alert('Draft created');
      setTitle('');
      toggle();
      onCreated?.();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
    setBusy(false);
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
              <Image source={{ uri:imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
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

          {/* Address */}
          <Text style={[styles.label,{ marginTop:16 }]}>Address</Text>
          <TextInput
            style={styles.input}
            placeholder="123 Main St, City"
            value={address}
            onChangeText={setAddress}
            placeholderTextColor="#aaa"
            autoCorrect={false}
          />
          {suggestions.length>0 && (
            <View style={styles.suggList}>
              <BlurView style={StyleSheet.absoluteFill} intensity={50} tint="dark" />
              {suggestions.map(f=> (
                <TouchableOpacity key={f.id} style={styles.suggItem} onPress={()=>{ setAddress(f.place_name); setSuggestions([]); Keyboard.dismiss(); }}>
                  <Text style={styles.suggTxt}>{f.place_name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

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
    </Animated.View>
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
}); 