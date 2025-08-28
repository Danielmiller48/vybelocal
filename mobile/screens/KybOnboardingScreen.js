import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking, Alert, TextInput, Animated, Easing, Dimensions } from 'react-native';
import AddressAutocomplete from '../components/AddressAutocomplete';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../utils/supabase';
import Constants from 'expo-constants';

const API_BASE_URL = Constants.expoConfig?.extra?.waitlistApiBaseUrl || process.env?.EXPO_PUBLIC_WAITLIST_API_BASE_URL || 'https://vybelocal-waitlist.vercel.app';

export default function KybOnboardingScreen() {
  const { profile, user } = useAuth();
  const paymentsReady = !!profile?.stripe_account_id || !!profile?.tilled_merchant_id;

  const [bizType, setBizType] = React.useState('sp');
  const [spFirst, setSpFirst] = React.useState('');
  const [spLast, setSpLast] = React.useState('');
  const [spDba, setSpDba] = React.useState('');
  const [spAddr1, setSpAddr1] = React.useState('');
  const [spCity, setSpCity] = React.useState('');
  const [spState, setSpState] = React.useState('');
  const [spZip, setSpZip] = React.useState('');
  const [spRouting, setSpRouting] = React.useState('');
  const [spAccount, setSpAccount] = React.useState('');
  const [llcName, setLlcName] = React.useState('');
  const [llcEin, setLlcEin] = React.useState('');
  const [llcStartDate, setLlcStartDate] = React.useState('');
  const [llcAddr1, setLlcAddr1] = React.useState('');
  const [llcCity, setLlcCity] = React.useState('');
  const [llcState, setLlcState] = React.useState('');
  const [llcZip, setLlcZip] = React.useState('');
  const [cpFirst, setCpFirst] = React.useState('');
  const [cpLast, setCpLast] = React.useState('');
  const [cpDob, setCpDob] = React.useState('');
  const [cpSsn, setCpSsn] = React.useState('');
  const [cpAddr1, setCpAddr1] = React.useState('');
  const [cpCity, setCpCity] = React.useState('');
  const [cpState, setCpState] = React.useState('');
  const [cpZip, setCpZip] = React.useState('');
  const [cpIsSelf, setCpIsSelf] = React.useState(true);
  const [cpUseBizAddr, setCpUseBizAddr] = React.useState(true);
  const [llcRouting, setLlcRouting] = React.useState('');
  const [llcAccount, setLlcAccount] = React.useState('');
  const [supportEmail, setSupportEmail] = React.useState('');
  const [supportPhone, setSupportPhone] = React.useState('');
  const [websiteOrPolicy, setWebsiteOrPolicy] = React.useState('');
  const [descriptor, setDescriptor] = React.useState('');
  const [descriptorLen, setDescriptorLen] = React.useState(0);
  const [selectedIndustry, setSelectedIndustry] = React.useState(0); // index into industries array
  const industries = [
    { "label": "Event Organizer / Promoter", "naics": "711310", "mcc": "7922" },
    { "label": "Fitness / Wellness", "naics": "713940", "mcc": "7997" },
    { "label": "Food & Beverage (Pop-up / Vendor)", "naics": "722330", "mcc": "5812" },
    { "label": "Arts / Creative Workshops", "naics": "711510", "mcc": "8999" },
    { "label": "Other Community Activity", "naics": "813410", "mcc": "8641" }
  ];
  const [productDesc, setProductDesc] = React.useState('Event admission and hosting services');
  const [fulfillmentDays, setFulfillmentDays] = React.useState('');
  const [checkoutInPerson, setCheckoutInPerson] = React.useState('');
  const [checkoutOnline, setCheckoutOnline] = React.useState('');
  const [monthlyVolume, setMonthlyVolume] = React.useState('');
  const [avgTicket, setAvgTicket] = React.useState('');
  const [monthlyTxCount, setMonthlyTxCount] = React.useState('');
  const [agreed, setAgreed] = React.useState(false);
  const [plaidToken, setPlaidToken] = React.useState(null);
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [step, setStep] = React.useState(0);
  const slide = React.useRef(new Animated.Value(0)).current; // 0 current, -1 left, 1 right
  const fade  = React.useRef(new Animated.Value(1)).current;
  const ANIM_MS = 200;
  // Placeholder card animations (step 1)
  const ph1 = React.useRef(new Animated.Value(0)).current;
  const ph2 = React.useRef(new Animated.Value(0)).current;
  const ph3 = React.useRef(new Animated.Value(0)).current;
  const SCREEN_WIDTH = Dimensions.get('window').width;
  const CARD_W = Math.min(320, SCREEN_WIDTH - 64);
  const CARD_H = 160;

  const [creatingAccount, setCreatingAccount] = React.useState(false);

  const createConnectedAccount = async () => {
    setCreatingAccount(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        Alert.alert('Please sign in');
        setCreatingAccount(false);
        return;
      }

      const res = await fetch(`${API_BASE_URL}/api/payments/tilled/connected-account`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}`,
          'x-idempotency-key': `connected_${user.id}_${Date.now()}`,
        },
        body: JSON.stringify({
          name: profile?.name || user?.email || 'VybeLocal Merchant',
          email: user?.email || 'merchant@vybelocal.com'
        })
      });

      const text = await res.text();
      let json; try { json = JSON.parse(text); } catch { json = {}; }
      
      if (!res.ok) {
        Alert.alert('Error', json?.error || 'Unable to create account');
        setCreatingAccount(false);
        return;
      }

      // Account created successfully, proceed to step 1
      animateTo(1, 1);
    } catch (e) {
      Alert.alert('Error', e?.message || 'Unable to create account');
    } finally {
      setCreatingAccount(false);
    }
  };

  const animateTo = (nextStep, dir) => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: ANIM_MS, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
      Animated.timing(slide, { toValue: dir, duration: ANIM_MS, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
    ]).start(() => {
      slide.setValue(-dir);
      setStep(nextStep);
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: ANIM_MS, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
        Animated.timing(slide, { toValue: 0, duration: ANIM_MS, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
      ]).start();
    });
  };

  // Kick placeholder animations when bizType changes on step 1
  React.useEffect(() => {
    if (step !== 1) return;
    ph1.setValue(0); ph2.setValue(0); ph3.setValue(0);
    Animated.stagger(80, [
      Animated.timing(ph1, { toValue: 1, duration: ANIM_MS, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
      Animated.timing(ph2, { toValue: 1, duration: ANIM_MS, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
      Animated.timing(ph3, { toValue: 1, duration: ANIM_MS, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
    ]).start();
  }, [bizType, step, ph1, ph2, ph3]);

  const renderPlaceholders = () => {
    const items = bizType === 'llc'
      ? [
          { key:'dj', label:'Bar Night / DJ Event', pos:'tl', col:'#111827' },
          { key:'food', label:'Food Truck Pop-Up', pos:'mr', col:'#0B1220' },
          { key:'openmic', label:'Coffee Shop Open Mic', pos:'bl', col:'#1F2937' },
        ]
      : [
          { key:'yoga', label:'Yoga in the Park', pos:'tl', col:'#0B1220' },
          { key:'fitness', label:'Run Group or Bootcamp', pos:'mr', col:'#111827' },
          { key:'workshop', label:'Creative Pop-Up', pos:'bl', col:'#1F2937' },
        ];
    const mats = [ph1, ph2, ph3];
    const overlapPad = 24; // pixels of intentional overlap between cards
    const topOffsets = {
      tl: 0,
      mr: CARD_H - overlapPad,
      bl: 2 * (CARD_H - overlapPad),
    };
    const cardStyle = (i, pos) => ({
      position:'absolute',
      width: CARD_W,
      height: CARD_H,
      borderRadius: 14,
      borderWidth:1,
      borderColor:'#374151',
      padding:12,
      opacity: mats[i],
      transform:[{ translateY: mats[i].interpolate({ inputRange:[0,1], outputRange:[12,0] }) }],
      ...(pos==='tl' ? { top: topOffsets.tl, left: 0 } : {}),
      ...(pos==='mr' ? { top: topOffsets.mr, right: 0 } : {}),
      ...(pos==='bl' ? { top: topOffsets.bl, left: 0 } : {}),
    });
    return (
      <View style={{ height: topOffsets.bl + CARD_H + 8, marginBottom: 12 }}>
        {items.map((it, i) => (
          <Animated.View key={it.key} style={[cardStyle(i, it.pos), { backgroundColor: it.col }] }>
            <Text style={{ color:'#fff', fontWeight:'800', marginBottom:6 }}>{it.label}</Text>
            <Text style={{ color:'#E5E7EB', fontSize:12 }}>Soon you can host things like this on VybeLocal.</Text>
          </Animated.View>
        ))}
      </View>
    );
  };


  function isAscii(str) {
    return /^[\x20-\x7E]*$/.test(str || '');
  }

  function looksLikeSocial(url) {
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, '');
      return [
        'instagram.com','facebook.com','fb.com','tiktok.com','twitter.com','x.com','snapchat.com','linkedin.com','threads.net','youtube.com','youtu.be'
      ].some(d => host.endsWith(d));
    } catch {
      return false;
    }
  }

  const openOnboarding = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        Alert.alert('Please sign in');
        return;
      }

      if (bizType === 'sp') {
        if (!spFirst || !spLast) {
          Alert.alert('Missing name', 'Please enter your legal first and last name.');
          return;
        }
        // Website is optional – if empty, policy URL will be generated server-side
        if (looksLikeSocial(websiteOrPolicy)) {
          Alert.alert('Invalid URL', 'Please provide a website or policy URL (no social links).');
          return;
        }
        if (descriptor && (!isAscii(descriptor) || descriptor.length > 20)) {
          Alert.alert('Descriptor invalid', 'Use ASCII only and max 20 characters.');
          return;
        }
        const inPerson = Number(checkoutInPerson || 0);
        const online = Number(checkoutOnline || 0);
        if ((inPerson || online) && inPerson + online !== 100) {
          Alert.alert('Checkout mix', 'In-person % + Online % must total 100.');
          return;
        }
        if (!cpDob) {
          Alert.alert('Missing DOB', 'DOB (YYYY-MM-DD) is required.');
          return;
        }
        if (!cpSsn || String(cpSsn).replace(/\D/g, '').length !== 9) {
          Alert.alert('SSN required', 'Enter full 9-digit SSN.');
          return;
        }
        if (!agreed) {
          Alert.alert('Agreement', 'Please agree and submit.');
          return;
        }
      }
      // Auto-fill boilerplate fields
      const autoDescriptor = (spDba || `${spFirst} ${spLast}` || llcName || 'VYBELOCAL').replace(/[^A-Z0-9 ]/gi, '').toUpperCase().substring(0, 20);
      const autoSupport = { 
        email: supportEmail || user?.email || 'support@vybelocal.com', 
        phone: supportPhone || profile?.phone || undefined 
      };
      const autoWebsite = websiteOrPolicy || `https://vybelocal-waitlist.vercel.app/policy/${user.id}`;
      const autoUnderwriting = {
        product_description: productDesc || 'Event admission and hosting services',
        avg_ticket: 50, // Conservative default
        monthly_volume: 5000, // Conservative default  
        monthly_tx_count: 100, // Conservative default
        fulfillment_days: 1,
        checkout_mix: { in_person: 80, online: 20 }
      };

      const payload = bizType === 'sp' ? {
        business: {
          type: 'sole_prop',
          legal_name: `${spFirst} ${spLast}`.trim(),
          dba: spDba || undefined,
          address: { line1: spAddr1, city: spCity, state: spState, postal_code: spZip },
          support: autoSupport,
          website: autoWebsite,
          statement_descriptor: autoDescriptor,
          mcc: industries[selectedIndustry]?.mcc || '7922',
          naics: industries[selectedIndustry]?.naics || '711310',
          underwriting: autoUnderwriting
        },
        bank: { holder: `${spFirst} ${spLast}`.trim(), routing: spRouting || undefined, account: spAccount || undefined, plaid_token: plaidToken || undefined },
        control_person: { first_name: spFirst, last_name: spLast, dob: cpDob, ssn: String(cpSsn).replace(/\D/g, ''), address: { line1: (cpAddr1||spAddr1), city: (cpCity||spCity), state: (cpState||spState), postal_code: (cpZip||spZip) } }
      } : {
        business: { 
          type: 'llc', 
          legal_name: llcName, 
          dba: spDba || undefined,
          tax_id: llcEin, 
          start_or_incorp_date: llcStartDate || undefined, 
          address: { line1: llcAddr1, city: llcCity, state: llcState, postal_code: llcZip }, 
          support: autoSupport, 
          website: autoWebsite, 
          statement_descriptor: autoDescriptor,
          mcc: industries[selectedIndustry]?.mcc || '7922',
          naics: industries[selectedIndustry]?.naics || '711310',
          underwriting: autoUnderwriting
        },
        bank: { holder: llcName, routing: llcRouting, account: llcAccount },
        control_person: { first_name: cpFirst || 'Officer', last_name: cpLast || 'Name', dob: cpDob || '1990-01-01', ssn_last4: cpSsn ? String(cpSsn).replace(/\D/g, '').slice(-4) : undefined, address: { line1: cpAddr1 || llcAddr1, city: cpCity || llcCity, state: cpState || llcState, postal_code: cpZip || llcZip } }
      };
      const res = await fetch(`${API_BASE_URL}/api/payments/tilled/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'x-idempotency-key': Date.now().toString() },
        body: JSON.stringify(payload)
      });
      const text = await res.text();
      let json; try { json = JSON.parse(text); } catch { json = {}; }
      if (!res.ok) {
        Alert.alert('Error', json?.error || 'Unable to start onboarding');
        return;
      }
      Alert.alert('Submitted', 'Your application was submitted. We will update your status shortly.');
    } catch (e) {
      Alert.alert('Error', e?.message || 'Unable to start onboarding');
    }
  };

  return (
    <LinearGradient colors={['rgba(59,130,246,0.18)', 'rgba(14,165,233,0.18)']} style={{ flex: 1 }} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>        
        <AppHeader />
        <ScrollView contentContainerStyle={{ padding:16 }}>
          {/* Strong header */}
          <Animated.View style={{ opacity: fade, transform: [{ translateX: slide.interpolate({ inputRange:[-1,0,1], outputRange:[-24,0,24] }) }] }}>
            {step === 0 && (
              <View>
                <View style={{ backgroundColor:'#fff', borderRadius:16, padding:16, borderWidth:1, borderColor:'#E0E7FF', marginBottom:24 }}>
                  <Text style={{ fontSize:22, fontWeight:'800', marginBottom:6 }}>Let’s lock in your payouts</Text>
                  <Text style={{ color:'#111827' }}>It only takes a minute. You keep every dollar — guests cover a tiny fee.</Text>
                </View>
                <View style={{ backgroundColor:'#0B1220', borderRadius:16, padding:16, marginBottom:16 }}>
                  <Text style={{ color:'#fff', fontWeight:'800', marginBottom:8 }}>Before we hit go…</Text>
                  {[
                    'Legal name (or business name)',
                    'SSN or EIN',
                    'Business address and support contact',
                    'Bank account & routing',
                    'DOB & residential address'
                  ].map((item, idx)=> (
                    <View key={idx} style={{ flexDirection:'row', alignItems:'center', marginBottom:6 }}>
                      <Ionicons name="checkmark-circle" size={18} color="#60A5FA" style={{ marginRight:8 }} />
                      <Text style={{ color:'#E5E7EB' }}>{item}</Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity 
                  onPress={createConnectedAccount} 
                  disabled={creatingAccount}
                  style={{ backgroundColor: creatingAccount ? '#9CA3AF' : '#3B82F6', borderRadius:12, paddingVertical:14, alignItems:'center' }}
                >
                  <Text style={{ color:'#fff', fontWeight:'700' }}>
                    {creatingAccount ? 'Creating account...' : 'Start'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
          {/* Step 1 – Type selection */}
          {step === 1 && (
            <Animated.View style={{ opacity: fade, transform: [{ translateX: slide.interpolate({ inputRange:[-1,0,1], outputRange:[-24,0,24] }) }] }}>
              <View style={{ backgroundColor:'#fff', borderRadius:16, padding:16, borderWidth:1, borderColor:'#E0E7FF', marginBottom:12 }}>
                <Text style={{ fontSize:20, fontWeight:'800', marginBottom:8 }}>Are you an individual or a business?</Text>
                <Text style={{ color:'#4B5563' }}>Pick one to tailor the questions. You can switch later.</Text>
              </View>
              <View style={{ flexDirection:'row', gap:12, marginBottom:12 }}>
                <TouchableOpacity onPress={()=>setBizType('sp')} style={{ flex:1, paddingVertical:16, borderRadius:12, borderWidth:2, borderColor: bizType==='sp' ? '#3B82F6' : '#E5E7EB', backgroundColor: bizType==='sp' ? 'rgba(59,130,246,0.08)' : '#fff', alignItems:'center' }}>
                  <Text style={{ fontWeight:'800', color:'#111827' }}>I’m an individual</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={()=>setBizType('llc')} style={{ flex:1, paddingVertical:16, borderRadius:12, borderWidth:2, borderColor: bizType==='llc' ? '#3B82F6' : '#E5E7EB', backgroundColor: bizType==='llc' ? 'rgba(59,130,246,0.08)' : '#fff', alignItems:'center' }}>
                  <Text style={{ fontWeight:'800', color:'#111827' }}>I have a business</Text>
                </TouchableOpacity>
              </View>
              {renderPlaceholders()}
              <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
                <TouchableOpacity onPress={()=>animateTo(0, -1)} style={{ width: (SCREEN_WIDTH/2)-24, backgroundColor:'#E5E7EB', borderRadius:12, paddingVertical:12, alignItems:'center', marginLeft:4 }}>
                  <Text style={{ color:'#111827', fontWeight:'700' }}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={()=>animateTo(2, 1)} style={{ width: (SCREEN_WIDTH/2)-24, backgroundColor:'#3B82F6', borderRadius:12, paddingVertical:12, alignItems:'center', marginRight:4 }}>
                  <Text style={{ color:'#fff', fontWeight:'700' }}>Next</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}


          {/* Step 2 – Basic info (branched by Individual vs Business) */}
          {!paymentsReady && step === 2 && (
            <Animated.View style={{ opacity: fade, transform: [{ translateX: slide.interpolate({ inputRange:[-1,0,1], outputRange:[-24,0,24] }) }] , marginTop:0, marginBottom:24, backgroundColor:'#fff', borderRadius:16, padding:16, borderWidth:1, borderColor:'#E0E7FF' }}>
              <Text style={{ fontWeight:'800', fontSize:16, marginBottom:12 }}>
                {bizType === 'sp' ? 'Your details' : 'Business details'}
              </Text>
              {bizType==='sp' ? (
                <>
                  <Text style={{ fontWeight:'700', marginBottom:6 }}>Legal name (first, last)</Text>
                  <View style={{ flexDirection:'row', gap:8, marginBottom:12 }}>
                    <TextInput value={spFirst} onChangeText={setSpFirst} placeholder="Jane" style={{ flex:1, borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }} />
                    <TextInput value={spLast} onChangeText={setSpLast} placeholder="Doe" style={{ flex:1, borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }} />
                  </View>
                  <Text style={{ fontWeight:'700', marginBottom:6 }}>DBA / Public name (optional)</Text>
                  <TextInput value={spDba} onChangeText={setSpDba} placeholder="Jane's Events" style={{ borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10, marginBottom:12 }} />
                </>
              ) : (
                <>
                  <Text style={{ fontWeight:'700', marginBottom:6 }}>Legal business name</Text>
                  <TextInput value={llcName} onChangeText={setLlcName} placeholder="My LLC, Inc." style={{ borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10, marginBottom:12 }} />
                  <Text style={{ fontWeight:'700', marginBottom:6 }}>EIN</Text>
                  <TextInput value={llcEin} onChangeText={setLlcEin} placeholder="12-3456789" keyboardType="number-pad" style={{ borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10, marginBottom:12 }} />
                  <Text style={{ fontWeight:'700', marginBottom:6 }}>Start / Inc date (optional)</Text>
                  <TextInput value={llcStartDate} onChangeText={setLlcStartDate} placeholder="YYYY-MM-DD" style={{ borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10, marginBottom:12 }} />
                </>
              )}
              <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:8 }}>
                <TouchableOpacity onPress={()=>animateTo(1, -1)} style={{ width: (SCREEN_WIDTH/2)-24, backgroundColor:'#E5E7EB', borderRadius:12, paddingVertical:12, alignItems:'center', marginLeft:4 }}>
                  <Text style={{ color:'#111827', fontWeight:'700' }}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={()=>animateTo(3, 1)} style={{ width: (SCREEN_WIDTH/2)-24, backgroundColor:'#3B82F6', borderRadius:12, paddingVertical:12, alignItems:'center', marginRight:4 }}>
                  <Text style={{ color:'#fff', fontWeight:'700' }}>Continue</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}

          {/* Step 3 – Address info */}
          {!paymentsReady && step === 3 && (
            <Animated.View style={{ opacity: fade, transform: [{ translateX: slide.interpolate({ inputRange:[-1,0,1], outputRange:[-24,0,24] }) }] , marginTop:0, marginBottom:24, backgroundColor:'#fff', borderRadius:16, padding:16, borderWidth:1, borderColor:'#E0E7FF' }}>
              <Text style={{ fontWeight:'800', fontSize:16, marginBottom:12 }}>Address information</Text>
              <Text style={{ fontWeight:'700', marginBottom:6 }}>Business address</Text>
                  <View style={{ marginBottom:12 }}>
                    <AddressAutocomplete
                      value={spAddr1}
                      onChangeText={setSpAddr1}
                      onSelect={({ line1, city, state, postal }) => {
                        setSpAddr1(line1 || ''); setSpCity(city || ''); setSpState(state || ''); setSpZip(postal || '');
                      }}
                    />
                  </View>
                  <View style={{ flexDirection:'row', gap:8, marginBottom:12 }}>
                    <TextInput value={spCity} onChangeText={setSpCity} placeholder="City" style={{ flex:1, borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }} />
                    <TextInput value={spState} onChangeText={setSpState} placeholder="ST" style={{ width:70, borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }} />
                    <TextInput value={spZip} onChangeText={setSpZip} placeholder="ZIP" keyboardType="number-pad" style={{ width:100, borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }} />
                  </View>
                  <Text style={{ fontWeight:'700', marginBottom:6 }}>Residential address</Text>
                  <TouchableOpacity onPress={()=>setCpUseBizAddr(!cpUseBizAddr)} style={{ flexDirection:'row', alignItems:'center', marginBottom:8 }}>
                    <View style={{ width:22, height:22, borderRadius:6, borderWidth:1, borderColor:'#c7cdd9', marginRight:8, backgroundColor: cpUseBizAddr ? '#3B82F6' : '#fff', alignItems:'center', justifyContent:'center' }}>
                      {cpUseBizAddr && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </View>
                    <Text style={{ color:'#111827' }}>Same as business</Text>
                  </TouchableOpacity>
                  {!cpUseBizAddr && (
                    <>
                      <View style={{ marginBottom:12 }}>
                        <AddressAutocomplete
                          value={cpAddr1}
                          onChangeText={setCpAddr1}
                          onSelect={({ line1, city, state, postal }) => { setCpAddr1(line1||''); setCpCity(city||''); setCpState(state||''); setCpZip(postal||''); }}
                        />
                      </View>
                      <View style={{ flexDirection:'row', gap:8, marginBottom:12 }}>
                        <TextInput value={cpCity} onChangeText={setCpCity} placeholder="City" style={{ flex:1, borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }} />
                        <TextInput value={cpState} onChangeText={setCpState} placeholder="ST" style={{ width:70, borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }} />
                        <TextInput value={cpZip} onChangeText={setCpZip} placeholder="ZIP" keyboardType="number-pad" style={{ width:100, borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }} />
                      </View>
                    </>
                  )}
                  <Text style={{ fontWeight:'700', marginBottom:6 }}>DOB (YYYY-MM-DD)</Text>
                  <TextInput value={cpDob} onChangeText={setCpDob} placeholder="YYYY-MM-DD" style={{ borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10, marginBottom:12 }} />
                  <Text style={{ fontWeight:'700', marginBottom:6 }}>SSN (full 9) (masked)</Text>
                  <TextInput value={cpSsn} onChangeText={setCpSsn} placeholder="•••••••••" keyboardType="number-pad" secureTextEntry style={{ borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10, marginBottom:12 }} />
                  <Text style={{ fontWeight:'700', marginBottom:6 }}>Industry</Text>
                  <View style={{ marginBottom:12 }}>
                    {industries.map((industry, idx) => (
                      <TouchableOpacity key={idx} onPress={()=>setSelectedIndustry(idx)} style={{ flexDirection:'row', alignItems:'center', paddingVertical:12, paddingHorizontal:16, borderWidth:1, borderColor: selectedIndustry===idx ? '#3B82F6' : '#e5e7eb', borderRadius:8, marginBottom:8, backgroundColor: selectedIndustry===idx ? 'rgba(59,130,246,0.08)' : '#fff' }}>
                        <View style={{ width:20, height:20, borderRadius:10, borderWidth:2, borderColor: selectedIndustry===idx ? '#3B82F6' : '#e5e7eb', marginRight:12, backgroundColor: selectedIndustry===idx ? '#3B82F6' : '#fff', alignItems:'center', justifyContent:'center' }}>
                          {selectedIndustry===idx && <View style={{ width:8, height:8, borderRadius:4, backgroundColor:'#fff' }} />}
                        </View>
                        <Text style={{ fontWeight:'600', color:'#111827' }}>{industry.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={{ fontWeight:'700', marginBottom:6 }}>What you sell</Text>
                  <TextInput value={productDesc} onChangeText={setProductDesc} placeholder="Brief description" style={{ borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10, marginBottom:12 }} />
                  <Text style={{ fontWeight:'700', marginBottom:6 }}>Fulfillment days</Text>
                  <TextInput value={fulfillmentDays} onChangeText={setFulfillmentDays} placeholder="e.g., 2" keyboardType="number-pad" style={{ borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10, marginBottom:12 }} />
                  <Text style={{ fontWeight:'700', marginBottom:6 }}>Checkout mix (must total 100)</Text>
                  <View style={{ flexDirection:'row', gap:8, marginBottom:12 }}>
                    <TextInput value={checkoutInPerson} onChangeText={setCheckoutInPerson} placeholder="In-person %" keyboardType="number-pad" style={{ flex:1, borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }} />
                    <TextInput value={checkoutOnline} onChangeText={setCheckoutOnline} placeholder="Online %" keyboardType="number-pad" style={{ flex:1, borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }} />
                  </View>
                  <Text style={{ fontWeight:'700', marginBottom:6 }}>Processing estimates</Text>
                  <View style={{ flexDirection:'row', gap:8, marginBottom:12 }}>
                    <TouchableOpacity onPress={()=>setMonthlyVolume('20000')} style={{ flex:1, padding:10, borderWidth:1, borderColor: monthlyVolume==='20000' ? '#3B82F6' : '#e5e7eb', borderRadius:8, alignItems:'center' }}><Text>$0–20k/mo</Text></TouchableOpacity>
                    <TouchableOpacity onPress={()=>setMonthlyVolume('100000')} style={{ flex:1, padding:10, borderWidth:1, borderColor: monthlyVolume==='100000' ? '#3B82F6' : '#e5e7eb', borderRadius:8, alignItems:'center' }}><Text>$20k–100k/mo</Text></TouchableOpacity>
                    <TouchableOpacity onPress={()=>setMonthlyVolume('200000')} style={{ flex:1, padding:10, borderWidth:1, borderColor: monthlyVolume==='200000' ? '#3B82F6' : '#e5e7eb', borderRadius:8, alignItems:'center' }}><Text>$100k+/mo</Text></TouchableOpacity>
                  </View>
                  <Text style={{ fontWeight:'700', marginBottom:6 }}>Average ticket</Text>
                  <View style={{ flexDirection:'row', gap:8, marginBottom:12 }}>
                    <TouchableOpacity onPress={()=>setAvgTicket('20')} style={{ flex:1, padding:10, borderWidth:1, borderColor: avgTicket==='20' ? '#3B82F6' : '#e5e7eb', borderRadius:8, alignItems:'center' }}><Text>$0–20</Text></TouchableOpacity>
                    <TouchableOpacity onPress={()=>setAvgTicket('100')} style={{ flex:1, padding:10, borderWidth:1, borderColor: avgTicket==='100' ? '#3B82F6' : '#e5e7eb', borderRadius:8, alignItems:'center' }}><Text>$20–100</Text></TouchableOpacity>
                    <TouchableOpacity onPress={()=>setAvgTicket('200')} style={{ flex:1, padding:10, borderWidth:1, borderColor: avgTicket==='200' ? '#3B82F6' : '#e5e7eb', borderRadius:8, alignItems:'center' }}><Text>$100+</Text></TouchableOpacity>
                  </View>
                  <Text style={{ fontWeight:'700', marginBottom:6 }}>Monthly transactions</Text>
                  <View style={{ flexDirection:'row', gap:8, marginBottom:12 }}>
                    <TouchableOpacity onPress={()=>setMonthlyTxCount('200')} style={{ flex:1, padding:10, borderWidth:1, borderColor: monthlyTxCount==='200' ? '#3B82F6' : '#e5e7eb', borderRadius:8, alignItems:'center' }}><Text>0–200</Text></TouchableOpacity>
                    <TouchableOpacity onPress={()=>setMonthlyTxCount('1000')} style={{ flex:1, padding:10, borderWidth:1, borderColor: monthlyTxCount==='1000' ? '#3B82F6' : '#e5e7eb', borderRadius:8, alignItems:'center' }}><Text>200–1000</Text></TouchableOpacity>
                    <TouchableOpacity onPress={()=>setMonthlyTxCount('2000')} style={{ flex:1, padding:10, borderWidth:1, borderColor: monthlyTxCount==='2000' ? '#3B82F6' : '#e5e7eb', borderRadius:8, alignItems:'center' }}><Text>1000+</Text></TouchableOpacity>
                  </View>
                  <Text style={{ fontWeight:'700', marginBottom:6 }}>Banking</Text>
                  <View style={{ flexDirection:'row', gap:8, marginBottom:8, alignItems:'center' }}>
                    <TouchableOpacity onPress={()=>Alert.alert('Plaid', 'Plaid connect coming soon. Use manual entry for now.')} style={{ paddingVertical:10, paddingHorizontal:12, borderRadius:10, backgroundColor:'#10B981' }}>
                      <Text style={{ color:'#fff', fontWeight:'700' }}>Connect with Plaid</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ flexDirection:'row', gap:8 }}>
                    <TextInput value={spRouting} onChangeText={setSpRouting} placeholder="Routing" keyboardType="number-pad" style={{ flex:1, borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }} />
                    <TextInput value={spAccount} onChangeText={setSpAccount} placeholder="Account" keyboardType="number-pad" style={{ flex:1, borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }} />
                  </View>
                  <TouchableOpacity onPress={()=>setAgreed(!agreed)} style={{ flexDirection:'row', alignItems:'center', marginTop:12 }}>
                    <View style={{ width:22, height:22, borderRadius:6, borderWidth:1, borderColor:'#c7cdd9', marginRight:8, backgroundColor: agreed ? '#3B82F6' : '#fff', alignItems:'center', justifyContent:'center' }}>
                      {agreed && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </View>
                    <Text style={{ color:'#111827' }}>I agree and submit</Text>
                  </TouchableOpacity>
                  <Text style={{ fontWeight:'700', marginBottom:6 }}>Banking</Text>
                  <View style={{ flexDirection:'row', gap:8 }}>
                    <TextInput value={spRouting} onChangeText={setSpRouting} placeholder="Routing" keyboardType="number-pad" style={{ flex:1, borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }} />
                    <TextInput value={spAccount} onChangeText={setSpAccount} placeholder="Account" keyboardType="number-pad" style={{ flex:1, borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }} />
                  </View>
              <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:16 }}>
                <TouchableOpacity onPress={()=>animateTo(2, -1)} style={{ width: (SCREEN_WIDTH/2)-24, backgroundColor:'#E5E7EB', borderRadius:12, paddingVertical:12, alignItems:'center', marginLeft:4 }}>
                  <Text style={{ color:'#111827', fontWeight:'700' }}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={()=>animateTo(4, 1)} style={{ width: (SCREEN_WIDTH/2)-24, backgroundColor:'#3B82F6', borderRadius:12, paddingVertical:12, alignItems:'center', marginRight:4 }}>
                  <Text style={{ color:'#fff', fontWeight:'700' }}>Continue</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}

          {/* Step 4 – Personal/sensitive info */}
          {!paymentsReady && step === 4 && (
            <Animated.View style={{ opacity: fade, transform: [{ translateX: slide.interpolate({ inputRange:[-1,0,1], outputRange:[-24,0,24] }) }] , marginTop:0, marginBottom:24, backgroundColor:'#fff', borderRadius:16, padding:16, borderWidth:1, borderColor:'#E0E7FF' }}>
              <Text style={{ fontWeight:'800', fontSize:16, marginBottom:12 }}>
                {bizType === 'sp' ? 'Personal information' : 'Control person'}
              </Text>
              {bizType === 'sp' ? (
                <>
                  <Text style={{ fontWeight:'700', marginBottom:6 }}>DOB (YYYY-MM-DD)</Text>
                  <TextInput value={cpDob} onChangeText={setCpDob} placeholder="YYYY-MM-DD" style={{ borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10, marginBottom:12 }} />
                  <Text style={{ fontWeight:'700', marginBottom:6 }}>SSN (full 9) (masked)</Text>
                  <TextInput value={cpSsn} onChangeText={setCpSsn} placeholder="•••••••••" keyboardType="number-pad" secureTextEntry style={{ borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10, marginBottom:12 }} />
                </>
              ) : (
                <>
                  <Text style={{ color:'#6B7280', marginBottom:8 }}>The person responsible for the business (managing member/officer). Used for verification only.</Text>
                  <TouchableOpacity onPress={()=>setCpIsSelf(!cpIsSelf)} style={{ flexDirection:'row', alignItems:'center', marginBottom:12 }}>
                    <View style={{ width:22, height:22, borderRadius:6, borderWidth:1, borderColor:'#c7cdd9', marginRight:8, backgroundColor: cpIsSelf ? '#3B82F6' : '#fff', alignItems:'center', justifyContent:'center' }}>
                      {cpIsSelf && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </View>
                    <Text style={{ color:'#111827' }}>I am the managing member/officer in control of this business</Text>
                  </TouchableOpacity>
                  <Text style={{ fontWeight:'700', marginBottom:6 }}>Control person name</Text>
                  <View style={{ flexDirection:'row', gap:8, marginBottom:12 }}>
                    <TextInput value={cpFirst} onChangeText={setCpFirst} placeholder="First name" style={{ flex:1, borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }} />
                    <TextInput value={cpLast} onChangeText={setCpLast} placeholder="Last name" style={{ flex:1, borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }} />
                  </View>
                  <Text style={{ fontWeight:'700', marginBottom:6 }}>DOB (YYYY-MM-DD)</Text>
                  <TextInput value={cpDob} onChangeText={setCpDob} placeholder="YYYY-MM-DD" style={{ borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10, marginBottom:12 }} />
                  <Text style={{ fontWeight:'700', marginBottom:6 }}>Control person address</Text>
                  <TouchableOpacity onPress={()=>setCpUseBizAddr(!cpUseBizAddr)} style={{ flexDirection:'row', alignItems:'center', marginBottom:8 }}>
                    <View style={{ width:22, height:22, borderRadius:6, borderWidth:1, borderColor:'#c7cdd9', marginRight:8, backgroundColor: cpUseBizAddr ? '#3B82F6' : '#fff', alignItems:'center', justifyContent:'center' }}>
                      {cpUseBizAddr && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </View>
                    <Text style={{ color:'#111827' }}>Same as business address</Text>
                  </TouchableOpacity>
                  {!cpUseBizAddr && (
                    <>
                      <View style={{ marginBottom:12 }}>
                        <AddressAutocomplete
                          value={cpAddr1}
                          onChangeText={setCpAddr1}
                          onSelect={({ line1, city, state, postal }) => { setCpAddr1(line1||''); setCpCity(city||''); setCpState(state||''); setCpZip(postal||''); }}
                        />
                      </View>
                      <View style={{ flexDirection:'row', gap:8, marginBottom:12 }}>
                        <TextInput value={cpCity} onChangeText={setCpCity} placeholder="City" style={{ flex:1, borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }} />
                        <TextInput value={cpState} onChangeText={setCpState} placeholder="ST" style={{ width:70, borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }} />
                        <TextInput value={cpZip} onChangeText={setCpZip} placeholder="ZIP" keyboardType="number-pad" style={{ width:100, borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }} />
                      </View>
                    </>
                  )}
                </>
              )}
              <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:16 }}>
                <TouchableOpacity onPress={()=>animateTo(3, -1)} style={{ width: (SCREEN_WIDTH/2)-24, backgroundColor:'#E5E7EB', borderRadius:12, paddingVertical:12, alignItems:'center', marginLeft:4 }}>
                  <Text style={{ color:'#111827', fontWeight:'700' }}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={()=>animateTo(5, 1)} style={{ width: (SCREEN_WIDTH/2)-24, backgroundColor:'#3B82F6', borderRadius:12, paddingVertical:12, alignItems:'center', marginRight:4 }}>
                  <Text style={{ color:'#fff', fontWeight:'700' }}>Continue</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}

          {/* Step 5 – Banking */}
          {!paymentsReady && step === 5 && (
            <Animated.View style={{ opacity: fade, transform: [{ translateX: slide.interpolate({ inputRange:[-1,0,1], outputRange:[-24,0,24] }) }] , marginTop:0, marginBottom:24, backgroundColor:'#fff', borderRadius:16, padding:16, borderWidth:1, borderColor:'#E0E7FF' }}>
              <Text style={{ fontWeight:'800', fontSize:16, marginBottom:12 }}>Banking</Text>
              <View style={{ flexDirection:'row', gap:8, marginBottom:8, alignItems:'center' }}>
                <TouchableOpacity onPress={()=>Alert.alert('Plaid', 'Plaid connect coming soon. Use manual entry for now.')} style={{ paddingVertical:10, paddingHorizontal:12, borderRadius:10, backgroundColor:'#10B981' }}>
                  <Text style={{ color:'#fff', fontWeight:'700' }}>Connect with Plaid</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection:'row', gap:8, marginBottom:12 }}>
                <TextInput 
                  value={bizType === 'sp' ? spRouting : llcRouting} 
                  onChangeText={bizType === 'sp' ? setSpRouting : setLlcRouting} 
                  placeholder="Routing" 
                  keyboardType="number-pad" 
                  style={{ flex:1, borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }} 
                />
                <TextInput 
                  value={bizType === 'sp' ? spAccount : llcAccount} 
                  onChangeText={bizType === 'sp' ? setSpAccount : setLlcAccount} 
                  placeholder="Account" 
                  keyboardType="number-pad" 
                  style={{ flex:1, borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }} 
                />
              </View>
              <TouchableOpacity onPress={()=>setAgreed(!agreed)} style={{ flexDirection:'row', alignItems:'center', marginTop:12 }}>
                <View style={{ width:22, height:22, borderRadius:6, borderWidth:1, borderColor:'#c7cdd9', marginRight:8, backgroundColor: agreed ? '#3B82F6' : '#fff', alignItems:'center', justifyContent:'center' }}>
                  {agreed && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
                <Text style={{ color:'#111827' }}>I agree and submit</Text>
              </TouchableOpacity>
              <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:16 }}>
                <TouchableOpacity onPress={()=>animateTo(4, -1)} style={{ width: (SCREEN_WIDTH/2)-24, backgroundColor:'#E5E7EB', borderRadius:12, paddingVertical:12, alignItems:'center', marginLeft:4 }}>
                  <Text style={{ color:'#111827', fontWeight:'700' }}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={openOnboarding} style={{ width: (SCREEN_WIDTH/2)-24, backgroundColor:'#3B82F6', borderRadius:12, paddingVertical:12, alignItems:'center', marginRight:4 }}>
                  <Text style={{ color:'#fff', fontWeight:'700' }}>Submit</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}

          {/* removed extra info card per request */}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}


