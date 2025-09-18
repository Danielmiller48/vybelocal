import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, TextInput, Animated, Easing, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
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

  // Form state
  const [bizType, setBizType] = React.useState('sp');
  const [spFirst, setSpFirst] = React.useState('');
  const [spLast, setSpLast] = React.useState('');
  const [spDba, setSpDba] = React.useState('');
  const [llcName, setLlcName] = React.useState('');
  const [llcEin, setLlcEin] = React.useState('');
  const [llcStartDate, setLlcStartDate] = React.useState('');
  const [npName, setNpName] = React.useState('');
  const [npEin, setNpEin] = React.useState('');
  
  // Address state
  const [bizAddr1, setBizAddr1] = React.useState('');
  const [bizCity, setBizCity] = React.useState('');
  const [bizState, setBizState] = React.useState('');
  const [bizZip, setBizZip] = React.useState('');
  const [resAddr1, setResAddr1] = React.useState('');
  const [resCity, setResCity] = React.useState('');
  const [resState, setResState] = React.useState('');
  const [resZip, setResZip] = React.useState('');
  const [useBizAddr, setUseBizAddr] = React.useState(true);
  
  // Personal info
  const [cpFirst, setCpFirst] = React.useState('');
  const [cpLast, setCpLast] = React.useState('');
  const [cpDob, setCpDob] = React.useState('');
  const [cpSsn, setCpSsn] = React.useState('');
  
  // Banking
  const [routing, setRouting] = React.useState('');
  const [account, setAccount] = React.useState('');
  const [agreed, setAgreed] = React.useState(false);
  const [tosToken, setTosToken] = React.useState(null);

  // UI state
  const [step, setStep] = React.useState(0);
  const [creatingAccount, setCreatingAccount] = React.useState(false);
  const slide = React.useRef(new Animated.Value(0)).current;
  const fade = React.useRef(new Animated.Value(1)).current;
  const ANIM_MS = 200;
  const SCREEN_WIDTH = Dimensions.get('window').width;

  const animateTo = (nextStep, dir) => {
    console.log('[RN] Animating to step:', nextStep, 'direction:', dir);
    Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: ANIM_MS, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
      Animated.timing(slide, { toValue: dir, duration: ANIM_MS, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
    ]).start(() => {
      slide.setValue(-dir);
      setStep(nextStep);
      console.log('[RN] Step updated to:', nextStep);
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: ANIM_MS, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
        Animated.timing(slide, { toValue: 0, duration: ANIM_MS, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
      ]).start(() => {
        console.log('[RN] Animation complete, current step:', nextStep);
      });
    });
  };

  const getTosToken = async () => {
    setCreatingAccount(true);
    try {
      // Get TOS token for Moov onboarding
      const tokenRes = await fetch('https://vybelocal.com/api/payments/moov/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      if (!tokenRes.ok) {
        Alert.alert('Error', 'Unable to get authorization token');
        return;
      }
      
      const tokenData = await tokenRes.json();
      const authToken = tokenData.access_token;
      
      // Get TOS token from Moov
      const tosRes = await fetch('https://api.moov.io/tos-token', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      if (!tosRes.ok) {
        Alert.alert('Error', 'Unable to get terms of service');
        return;
      }
      
      const tosData = await tosRes.json();
      setTosToken(tosData.token);
      
      // Proceed to onboarding with TOS token ready
      animateTo(1, 1);
    } catch (e) {
      Alert.alert('Error', e?.message || 'Unable to start onboarding');
    } finally {
      setCreatingAccount(false);
    }
  };

  const submitOnboarding = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        Alert.alert('Please sign in');
        return;
      }
      if (!agreed) {
        Alert.alert('Agreement required', 'Please agree to the Terms before submitting.');
        return;
      }

      // Build payload matching API expectations
      const payload = {
        business: {
          type: bizType === 'sp' ? 'sole_prop' : bizType === 'nonprofit' ? 'corporation' : 'llc',
          legal_name: bizType === 'sp' ? `${spFirst} ${spLast}`.trim() : bizType === 'nonprofit' ? npName : llcName,
          dba: spDba || undefined,
          tax_id: bizType === 'sp' ? undefined : (bizType === 'nonprofit' ? npEin : llcEin),
          start_or_incorp_date: bizType === 'llc' ? llcStartDate : undefined,
          address: { line1: bizAddr1, city: bizCity, state: bizState, postal_code: bizZip },
          support: { email: user?.email, phone: profile?.phone },
          website: `https://vybelocal-waitlist.vercel.app/policy/${user.id}`,
          statement_descriptor: (spDba || `${spFirst} ${spLast}` || llcName || npName || 'VYBELOCAL').replace(/[^A-Z0-9 ]/gi, '').toUpperCase().substring(0, 20),
          mcc: '7922',
          naics: '711310',
          underwriting: {
            product_description: 'Event admission and hosting services',
            avg_ticket: 50,
            monthly_volume: 5000,
            monthly_tx_count: 100,
            fulfillment_days: 1,
            checkout_mix: { in_person: 80, online: 20 }
          }
        },
        bank: { 
          holder: bizType === 'sp' ? `${spFirst} ${spLast}`.trim() : (bizType === 'nonprofit' ? npName : llcName), 
          routing: routing, 
          account: account 
        },
        control_person: { 
          first_name: bizType === 'sp' ? spFirst : cpFirst, 
          last_name: bizType === 'sp' ? spLast : cpLast, 
          dob: cpDob, 
          ssn: String(cpSsn).replace(/\D/g, ''), 
          address: { 
            line1: useBizAddr ? bizAddr1 : resAddr1, 
            city: useBizAddr ? bizCity : resCity, 
            state: useBizAddr ? bizState : resState, 
            postal_code: useBizAddr ? bizZip : resZip 
          } 
        },
        tos_acceptance: true
      };

      const res = await fetch(`${API_BASE_URL}/api/payments/tilled/onboarding`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}`, 
          'x-idempotency-key': Date.now().toString() 
        },
        body: JSON.stringify(payload)
      });

      const text = await res.text();
      let json; try { json = JSON.parse(text); } catch { json = {}; }
      
      if (!res.ok) {
        Alert.alert('Error', json?.error || 'Unable to submit application');
        return;
      }

      Alert.alert('Submitted', 'Your application was submitted. We will update your status shortly.');
    } catch (e) {
      Alert.alert('Error', e?.message || 'Unable to submit application');
    }
  };

  return (
    <LinearGradient colors={['rgba(59,130,246,0.18)', 'rgba(14,165,233,0.18)']} style={{ flex: 1 }} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>        
        <AppHeader />
        <ScrollView contentContainerStyle={{ padding:16, paddingBottom:24 }}>
          
          {/* Debug step display */}
          <Text style={{ position:'absolute', top:0, right:16, fontSize:12, color:'red', zIndex:1000 }}>
            Step: {step}
          </Text>
          
          {/* Step 0: Intro */}
          {step === 0 && (
            <Animated.View style={{ opacity: fade, transform: [{ translateX: slide.interpolate({ inputRange:[-1,0,1], outputRange:[-24,0,24] }) }] }}>
              <View style={{ backgroundColor:'#fff', borderRadius:16, padding:16, borderWidth:1, borderColor:'#E0E7FF', marginBottom:24 }}>
                <Text style={{ fontSize:22, fontWeight:'800', marginBottom:6 }}>Let's lock in your payouts</Text>
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
              <View style={{ borderRadius:12, overflow:'hidden', borderWidth:1, borderColor:'#E5E7EB' }}>
                <WebView 
                  style={{ height:200, backgroundColor:'#fff' }}
                  javaScriptEnabled={true}
                  domStorageEnabled={true}
                  startInLoadingState={true}
                  originWhitelist={['*']}
                  source={{ 
                    html: `<!doctype html><html><head>
                      <meta charset='utf-8'/>
                      <meta name='viewport' content='width=device-width, initial-scale=1'/>
                      <script src='https://js.moov.io/v1'></script>
                      <style>
                        body{font-family:system-ui;margin:0;padding:8px;background:#fff;min-height:180px}
                        moov-terms-of-service{display:block;width:100%;min-height:160px;font-size:14px;line-height:1.5;text-align:center}
                        .loading{text-align:center;padding:60px 0;color:#6B7280}
                        moov-terms-of-service p{margin:0 0 8px;word-wrap:break-word;hyphens:auto;text-align:center}
                        moov-terms-of-service a{word-wrap:break-word}
                      </style></head><body>
                       <div class='loading'>Loading terms...</div>
                       <moov-terms-of-service id='tos'></moov-terms-of-service>
                      <script>(async function(){
                        function log(...args) {
                          try { if(window.ReactNativeWebView){ window.ReactNativeWebView.postMessage(JSON.stringify({type:'log', args})); } } catch(e){}
                          try { console.log(...args); } catch(e){}
                        }
                        
                        const tos = document.querySelector('moov-terms-of-service');
                        const loading = document.querySelector('.loading');
                        
                        try {
                          log('Fetching Moov token...');
                          const r = await fetch('https://vybelocal-waitlist.vercel.app/api/payments/moov/token',{
                            method:'POST',
                            headers:{'Content-Type':'application/json'},
                            body:JSON.stringify({})
                          });
                          
                          if (!r.ok) {
                            log('Token fetch failed:', r.status, r.statusText);
                            return;
                          }
                          
                          const j = await r.json();
                          log('Token received:', j.access_token ? 'yes' : 'no');
                          
                          if (!j.access_token) {
                            log('No access token in response:', j);
                            return;
                          }
                          
                          log('Setting up TOS Drop...');
                          tos.token = j.access_token;
                          tos.textColor='rgb(17,24,39)';
                          tos.linkColor='rgb(37,99,235)';
                          tos.backgroundColor='rgb(255,255,255)';
                          tos.fontSize='14px';
                          
                          tos.onTermsOfServiceTokenReady=(token)=>{
                            log('TOS token ready!');
                            loading.style.display = 'none';
                            if(window.ReactNativeWebView){
                              window.ReactNativeWebView.postMessage(JSON.stringify({
                                type:'tos:ready', 
                                tosToken: token
                              }));
                            }
                          };
                          
                          tos.onTermsOfServiceTokenError=(error)=>{
                            log('TOS error:', error);
                          };
                          
                          log('TOS Drop setup complete with custom copy');
                          
                        } catch(e) {
                          log('TOS setup error:', e.message || e.toString(), e.stack);
                        }
                      })();</script>
                      </body></html>`,
                    baseUrl: 'https://vybelocal.com'
                  }}
                  onMessage={(e) => {
                    try {
                      const msg = JSON.parse(e.nativeEvent.data);
                      if (msg.type === 'tos:ready') {
                        console.log('[RN] TOS token received:', msg.tosToken ? 'yes' : 'no');
                        setTosToken(msg.tosToken);
                      } else if (msg.type === 'log') {
                        console.log('[TOS WebView]', ...msg.args);
                      }
                    } catch {}
                  }}
                  onError={(e) => console.log('WebView error:', e)}
                  onLoadEnd={() => console.log('WebView loaded')}
                />
              </View>
              <TouchableOpacity 
                onPress={() => {
                  console.log('[RN] Continue pressed, tosToken:', tosToken ? 'present' : 'missing');
                  animateTo(1, 1);
                }} 
                disabled={!tosToken}
                style={{ backgroundColor: tosToken ? '#3B82F6' : '#9CA3AF', borderRadius:12, paddingVertical:14, alignItems:'center', marginTop:12 }}
              >
                <Text style={{ color:'#fff', fontWeight:'700' }}>
                  {tosToken ? 'Continue' : 'Accept terms above'}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Step 1: Business Type Selection */}
          {step === 1 && (
            <Animated.View
              style={{ opacity: fade, transform: [{ translateX: slide.interpolate({ inputRange:[-1,0,1], outputRange:[-24,0,24] }) }] , marginBottom:24, minHeight: 200, backgroundColor:'#ffffff', borderWidth:1, borderColor:'#FCA5A5', borderRadius:12 }}
              onLayout={(e)=>{ try { console.log('[KYB] step1 layout', e?.nativeEvent?.layout); } catch(_) {} }}
            >
              <View style={{ backgroundColor:'#fff', borderRadius:16, padding:16, borderWidth:1, borderColor:'#E0E7FF', marginBottom:12 }}>
                <Text style={{ fontSize:20, fontWeight:'800', marginBottom:8 }}>What type of entity are you?</Text>
                <Text style={{ color:'#4B5563' }}>This determines what information we'll need.</Text>
              </View>
              <View style={{ marginBottom:12 }}>
                <TouchableOpacity onPress={()=>setBizType('sp')} style={{ paddingVertical:16, borderRadius:12, borderWidth:2, borderColor: bizType==='sp' ? '#3B82F6' : '#E5E7EB', backgroundColor: bizType==='sp' ? 'rgba(59,130,246,0.08)' : '#fff', alignItems:'center', marginBottom:8 }}>
                  <Text style={{ fontWeight:'800', color:'#111827' }}>I'm an individual</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={()=>setBizType('llc')} style={{ paddingVertical:16, borderRadius:12, borderWidth:2, borderColor: bizType==='llc' ? '#3B82F6' : '#E5E7EB', backgroundColor: bizType==='llc' ? 'rgba(59,130,246,0.08)' : '#fff', alignItems:'center', marginBottom:8 }}>
                  <Text style={{ fontWeight:'800', color:'#111827' }}>I have a business</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={()=>setBizType('nonprofit')} style={{ paddingVertical:16, borderRadius:12, borderWidth:2, borderColor: bizType==='nonprofit' ? '#3B82F6' : '#E5E7EB', backgroundColor: bizType==='nonprofit' ? 'rgba(59,130,246,0.08)' : '#fff', alignItems:'center' }}>
                  <Text style={{ fontWeight:'800', color:'#111827' }}>I'm a nonprofit</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection:'row', justifyContent:'space-between', paddingHorizontal:16 }}>
                <TouchableOpacity onPress={()=>animateTo(0, -1)} style={{ flex:1, backgroundColor:'#E5E7EB', borderRadius:12, paddingVertical:12, alignItems:'center' }}>
                  <Text style={{ color:'#111827', fontWeight:'700' }}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={()=>animateTo(2, 1)} style={{ flex:1, backgroundColor:'#3B82F6', borderRadius:12, paddingVertical:12, alignItems:'center' }}>
                  <Text style={{ color:'#fff', fontWeight:'700' }}>Next</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}

          {/* Step 2: Basic Info */}
          {step === 2 && (
            <Animated.View style={{ opacity: fade, transform: [{ translateX: slide.interpolate({ inputRange:[-1,0,1], outputRange:[-24,0,24] }) }] , marginTop:0, marginBottom:24, backgroundColor:'#fff', borderRadius:16, padding:16, borderWidth:1, borderColor:'#E0E7FF' }}>
              <Text style={{ fontWeight:'800', fontSize:16, marginBottom:12 }}>
                {bizType === 'sp' ? 'Your details' : bizType === 'nonprofit' ? 'Organization details' : 'Business details'}
              </Text>
              {bizType === 'sp' ? (
                <>
                  <Text style={{ fontWeight:'700', marginBottom:6 }}>Legal name (first, last)</Text>
                  <View style={{ flexDirection:'row', marginBottom:12 }}>
                    <View style={{ width:8 }} />
                    <TextInput value={spFirst} onChangeText={setSpFirst} placeholder="Jane" style={{ flex:1, borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }} />
                    <TextInput value={spLast} onChangeText={setSpLast} placeholder="Doe" style={{ flex:1, borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }} />
                  </View>
                  <Text style={{ fontWeight:'700', marginBottom:6 }}>DBA / Public name (optional)</Text>
                  <TextInput value={spDba} onChangeText={setSpDba} placeholder="Jane's Events" style={{ borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10, marginBottom:12 }} />
                </>
              ) : bizType === 'nonprofit' ? (
                <>
                  <Text style={{ fontWeight:'700', marginBottom:6 }}>Organization name</Text>
                  <TextInput value={npName} onChangeText={setNpName} placeholder="My Nonprofit Organization" style={{ borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10, marginBottom:12 }} />
                  <Text style={{ fontWeight:'700', marginBottom:6 }}>EIN</Text>
                  <TextInput value={npEin} onChangeText={setNpEin} placeholder="12-3456789" keyboardType="number-pad" style={{ borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10, marginBottom:12 }} />
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

          {/* Step 3: Address Info */}
          {step === 3 && (
            <Animated.View style={{ opacity: fade, transform: [{ translateX: slide.interpolate({ inputRange:[-1,0,1], outputRange:[-24,0,24] }) }] , marginTop:0, marginBottom:24, backgroundColor:'#fff', borderRadius:16, padding:16, borderWidth:1, borderColor:'#E0E7FF' }}>
              <Text style={{ fontWeight:'800', fontSize:16, marginBottom:12 }}>Address information</Text>
              <Text style={{ fontWeight:'700', marginBottom:6 }}>Business address</Text>
              <View style={{ marginBottom:12 }}>
                <AddressAutocomplete
                  value={bizAddr1}
                  onChangeText={setBizAddr1}
                  onSelect={({ line1, city, state, postal }) => {
                    setBizAddr1(line1 || ''); setBizCity(city || ''); setBizState(state || ''); setBizZip(postal || '');
                  }}
                />
              </View>
              <View style={{ flexDirection:'row', marginBottom:12 }}>
                <View style={{ width:8 }} />
                <TextInput value={bizCity} onChangeText={setBizCity} placeholder="City" style={{ flex:1, borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }} />
                <TextInput value={bizState} onChangeText={setBizState} placeholder="ST" style={{ width:70, borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }} />
                <TextInput value={bizZip} onChangeText={setBizZip} placeholder="ZIP" keyboardType="number-pad" style={{ width:100, borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }} />
              </View>
              {bizType === 'sp' && (
                <>
                  <Text style={{ fontWeight:'700', marginBottom:6 }}>Residential address</Text>
                  <TouchableOpacity onPress={()=>setUseBizAddr(!useBizAddr)} style={{ flexDirection:'row', alignItems:'center', marginBottom:8 }}>
                    <View style={{ width:22, height:22, borderRadius:6, borderWidth:1, borderColor:'#c7cdd9', marginRight:8, backgroundColor: useBizAddr ? '#3B82F6' : '#fff', alignItems:'center', justifyContent:'center' }}>
                      {useBizAddr && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </View>
                    <Text style={{ color:'#111827' }}>Same as business</Text>
                  </TouchableOpacity>
                  {!useBizAddr && (
                    <>
                      <View style={{ marginBottom:12 }}>
                        <AddressAutocomplete
                          value={resAddr1}
                          onChangeText={setResAddr1}
                          onSelect={({ line1, city, state, postal }) => { setResAddr1(line1||''); setResCity(city||''); setResState(state||''); setResZip(postal||''); }}
                        />
                      </View>
                      <View style={{ flexDirection:'row', marginBottom:12 }}>
                        <View style={{ width:8 }} />
                        <TextInput value={resCity} onChangeText={setResCity} placeholder="City" style={{ flex:1, borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }} />
                        <TextInput value={resState} onChangeText={setResState} placeholder="ST" style={{ width:70, borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }} />
                        <TextInput value={resZip} onChangeText={setResZip} placeholder="ZIP" keyboardType="number-pad" style={{ width:100, borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }} />
                      </View>
                    </>
                  )}
                </>
              )}
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

          {/* Step 4: Personal Info */}
          {step === 4 && (
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
                  <Text style={{ color:'#6B7280', marginBottom:8 }}>The person responsible for the {bizType === 'nonprofit' ? 'organization' : 'business'}. Used for verification only.</Text>
                  <Text style={{ fontWeight:'700', marginBottom:6 }}>Control person name</Text>
                  <View style={{ flexDirection:'row', marginBottom:12 }}>
                    <View style={{ width:8 }} />
                    <TextInput value={cpFirst} onChangeText={setCpFirst} placeholder="First name" style={{ flex:1, borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }} />
                    <TextInput value={cpLast} onChangeText={setCpLast} placeholder="Last name" style={{ flex:1, borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }} />
                  </View>
                  <Text style={{ fontWeight:'700', marginBottom:6 }}>DOB (YYYY-MM-DD)</Text>
                  <TextInput value={cpDob} onChangeText={setCpDob} placeholder="YYYY-MM-DD" style={{ borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10, marginBottom:12 }} />
                  <Text style={{ fontWeight:'700', marginBottom:6 }}>SSN (full 9) (masked)</Text>
                  <TextInput value={cpSsn} onChangeText={setCpSsn} placeholder="•••••••••" keyboardType="number-pad" secureTextEntry style={{ borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10, marginBottom:12 }} />
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

          {/* Step 5: Banking */}
          {step === 5 && (
            <Animated.View style={{ opacity: fade, transform: [{ translateX: slide.interpolate({ inputRange:[-1,0,1], outputRange:[-24,0,24] }) }] , marginTop:0, marginBottom:24, backgroundColor:'#fff', borderRadius:16, padding:16, borderWidth:1, borderColor:'#E0E7FF' }}>
              <Text style={{ fontWeight:'800', fontSize:16, marginBottom:12 }}>Banking</Text>
              <View style={{ flexDirection:'row', marginBottom:8, alignItems:'center' }}>
                <TouchableOpacity onPress={()=>Alert.alert('Plaid', 'Plaid connect coming soon. Use manual entry for now.')} style={{ paddingVertical:10, paddingHorizontal:12, borderRadius:10, backgroundColor:'#10B981' }}>
                  <Text style={{ color:'#fff', fontWeight:'700' }}>Connect with Plaid</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection:'row', marginBottom:12 }}>
                <View style={{ width:8 }} />
                <TextInput value={routing} onChangeText={setRouting} placeholder="Routing" keyboardType="number-pad" style={{ flex:1, borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }} />
                <TextInput value={account} onChangeText={setAccount} placeholder="Account" keyboardType="number-pad" style={{ flex:1, borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }} />
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
                <TouchableOpacity onPress={submitOnboarding} style={{ width: (SCREEN_WIDTH/2)-24, backgroundColor:'#3B82F6', borderRadius:12, paddingVertical:12, alignItems:'center', marginRight:4 }}>
                  <Text style={{ color:'#fff', fontWeight:'700' }}>Submit</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}

        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}
