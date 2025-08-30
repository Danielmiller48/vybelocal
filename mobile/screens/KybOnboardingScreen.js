import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Animated, Easing, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AppHeader from '../components/AppHeader';
import { useOnboardingDraft } from '../components/OnboardingDraftProvider';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../utils/supabase';
import Constants from 'expo-constants';

const API_BASE_URL = Constants.expoConfig?.extra?.waitlistApiBaseUrl || process.env?.EXPO_PUBLIC_WAITLIST_API_BASE_URL || 'https://vybelocal-waitlist.vercel.app';

export default function KybOnboardingScreen() {
  const { profile, user } = useAuth();
  const { draft, updateDraft } = useOnboardingDraft();
  const [step, setStep] = React.useState(0);
  const [bizType, setBizType] = React.useState(draft.bizType || 'sp'); // 'sp' | 'llc' | '501c3'
  const [spMcc, setSpMcc] = React.useState(draft.spMcc || '7922'); // individual MCC selection
  const [website, setWebsite] = React.useState(draft.website || '');
  const [supportEmail, setSupportEmail] = React.useState(draft.supportEmail || '');
  const [supportPhone, setSupportPhone] = React.useState(draft.supportPhone || '');
  const [addr1, setAddr1] = React.useState(draft.principal?.line1 || '');
  const [addr2, setAddr2] = React.useState(draft.principal?.line2 || '');
  const [city, setCity] = React.useState(draft.principal?.city || '');
  const [state, setState] = React.useState(draft.principal?.state || '');
  const [postal, setPostal] = React.useState(draft.principal?.postal_code || '');
  const [avgTicket, setAvgTicket] = React.useState(String(draft.est?.avg_ticket_usd || 35));
  const [monthlyGross, setMonthlyGross] = React.useState(String(draft.est?.monthly_gross_usd || 2500));
  const [monthlyTxn, setMonthlyTxn] = React.useState(String(draft.est?.monthly_txn || 50));
  const [maxTicket, setMaxTicket] = React.useState(String(draft.est?.max_ticket_usd || 200));
  const slide = React.useRef(new Animated.Value(0)).current;
  const fade  = React.useRef(new Animated.Value(1)).current;
  const ANIM_MS = 200;
  const SCREEN_WIDTH = Dimensions.get('window').width;
  const ph1 = React.useRef(new Animated.Value(0)).current;
  const ph2 = React.useRef(new Animated.Value(0)).current;
  const ph3 = React.useRef(new Animated.Value(0)).current;

  const [creatingAccount, setCreatingAccount] = React.useState(false);
  const [selectorOpen, setSelectorOpen] = React.useState(false);
  const [showOptions, setShowOptions] = React.useState(false);
  const dropdownSpacer = React.useRef(new Animated.Value(0)).current; // pushes placeholders down
  const dropdownOpacity = React.useRef(new Animated.Value(0)).current;
  const OPTIONS_HEIGHT = 170;

  // Step 2 (MCC) dropdown animations
  const [mccOpen, setMccOpen] = React.useState(false);
  const [mccShow, setMccShow] = React.useState(false);
  const mccSpacer = React.useRef(new Animated.Value(0)).current;
  const mccOpacity = React.useRef(new Animated.Value(0)).current;
  const MCC_HEIGHT = 340;
  // Placeholder image under MCC selector
  const [showMccImage, setShowMccImage] = React.useState(false);
  const mccImageHeight = React.useRef(new Animated.Value(0)).current;
  const mccImageX = React.useRef(new Animated.Value(-60)).current;
  const mccImageOpacity = React.useRef(new Animated.Value(0)).current;
  const PLACEHOLDER_H = 140;

  const submitIndividual = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { Alert.alert('Please sign in'); return; }

      const legal_entity = {
        mcc: spMcc,
        region: 'US',
        address: {
          street: addr1 || draft.principal?.line1 || '',
          street2: addr2 || draft.principal?.line2 || null,
          city: city || draft.principal?.city || '',
          state: state || draft.principal?.state || '',
          postal_code: postal || draft.principal?.postal_code || '',
          country: 'US'
        },
        website: website || draft.website || `https://vybelocal-waitlist.vercel.app/policy/${user.id}`,
        is_501c3: false,
        structure: 'sole_proprietorship',
        legal_name: (profile?.name || user?.user_metadata?.full_name || user?.email || 'VybeLocal User'),
        principals: [
          {
            email: supportEmail || user?.email,
            phone: supportPhone || null,
            address: {
              street: addr1 || draft.principal?.line1 || '',
              street2: addr2 || draft.principal?.line2 || null,
              city: city || draft.principal?.city || '',
              state: state || draft.principal?.state || '',
              postal_code: postal || draft.principal?.postal_code || '',
              country: 'US'
            },
            id_number: null,
            job_title: 'owner',
            last_name: (profile?.name?.split?.(' ')?.slice(-1)[0] || 'User'),
            first_name: (profile?.name?.split?.(' ')?.[0] || 'Vybe'),
            is_applicant: true,
            date_of_birth: null,
            is_control_prong: true,
            previous_address: null,
            percent_ownership: 100
          }
        ],
        bank_account: null,
        support_email: supportEmail || user?.email,
        support_phone: supportPhone || null,
        tax_id_number: null,
        charity_document: null,
        processing_volume: {
          currency: 'usd',
          high_ticket_amount: (Number(maxTicket) || draft.est?.max_ticket_usd || 200) * 100,
          monthly_processing_volume: (Number(monthlyGross) || draft.est?.monthly_gross_usd || 2500) * 100,
          monthly_transaction_count: Number(monthlyTxn) || draft.est?.monthly_txn || 50,
          average_transaction_amount_card: (Number(avgTicket) || draft.est?.avg_ticket_usd || 35) * 100,
          average_transaction_amount_debit: (Number(avgTicket) || draft.est?.avg_ticket_usd || 35) * 100
        },
        number_of_terminals: null,
        patriot_act_details: {
          business_license: null,
          articles_of_incorporation: null
        },
        product_description: 'Local classes/meetups hosted via VybeLocal',
        statement_descriptor: 'VYBELOCAL*EVENT',
        date_of_incorporation: null,
        existing_processor_name: 'None',
        percent_business_to_business: 20,
        days_billed_prior_to_shipment: 0,
        card_checkout_method_breakdown: {
          percent_swiped: 0,
          percent_e_commerce: 100,
          percent_manual_card_not_present: 0
        }
      };

      const res = await fetch(`${API_BASE_URL}/api/payments/tilled/onboarding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-idempotency-key': `onboard_${user.id}_${Date.now()}`,
        },
        body: JSON.stringify({ legal_entity, tos_acceptance: true })
      });
      const text = await res.text();
      let json; try { json = JSON.parse(text); } catch { json = {}; }
      if (!res.ok) {
        Alert.alert('Error', json?.error || 'Onboarding failed');
        return;
      }
      Alert.alert('Submitted', 'Your application was submitted.');
    } catch (e) {
      Alert.alert('Error', e?.message || 'Onboarding failed');
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

  const createConnectedAccount = async () => {
    setCreatingAccount(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { Alert.alert('Please sign in'); setCreatingAccount(false); return; }

      // Check existing status
      const statusRes = await fetch(`${API_BASE_URL}/api/payments/tilled/status`, {
        method: 'GET', headers: { 'Authorization': `Bearer ${token}` }
      });
      const status = await statusRes.json().catch(()=>({}));
      if (statusRes.ok && (status.status === 'has_application' || status.status === 'has_account')) {
        Alert.alert('Account Found', 'Connected account or application already exists.');
        animateTo(1, 1);
        return;
      }

      // Create a new connected account
      const res = await fetch(`${API_BASE_URL}/api/payments/tilled/connected-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-idempotency-key': `connected_${user.id}_${Date.now()}`,
        },
        body: JSON.stringify({ name: profile?.name || user?.email || 'VybeLocal Merchant', email: user?.email || 'merchant@vybelocal.com' })
      });
      if (!res.ok) {
        const err = await res.json().catch(()=>({}));
        Alert.alert('Error', err?.error || 'Unable to create account');
        return;
      }
      animateTo(1, 1);
    } catch (e) {
      Alert.alert('Error', e?.message || 'Unable to create account');
    } finally {
      setCreatingAccount(false);
    }
  };

  React.useEffect(() => {
    if (step !== 1) return;
    ph1.setValue(0); ph2.setValue(0); ph3.setValue(0);
    Animated.stagger(80, [
      Animated.timing(ph1, { toValue: 1, duration: ANIM_MS, useNativeDriver: true }),
      Animated.timing(ph2, { toValue: 1, duration: ANIM_MS, useNativeDriver: true }),
      Animated.timing(ph3, { toValue: 1, duration: ANIM_MS, useNativeDriver: true }),
    ]).start();
  }, [step, ph1, ph2, ph3]);

  const CARD_W = Math.min(320, SCREEN_WIDTH - 64);
  const CARD_H = 160;
  const overlapPad = 24;
  const topOffsets = { tl: 0, mr: CARD_H - overlapPad, bl: 2 * (CARD_H - overlapPad) };

  const renderPlaceholders = () => {
    const items = bizType === 'llc'
      ? [
          { key:'dj', label:'Bar Night / DJ Event', pos:'tl', col:'#111827' },
          { key:'food', label:'Food Truck Pop-Up', pos:'mr', col:'#0B1220' },
          { key:'openmic', label:'Coffee Shop Open Mic', pos:'bl', col:'#1F2937' },
        ]
      : bizType === '501c3'
      ? [
          { key:'fundraiser', label:'Charity Fundraiser', pos:'tl', col:'#059669' },
          { key:'volunteer', label:'Volunteer Drive', pos:'mr', col:'#0B1220' },
          { key:'community', label:'Community Meetup', pos:'bl', col:'#1F2937' },
        ]
      : [
          { key:'yoga', label:'Yoga in the Park', pos:'tl', col:'#0B1220' },
          { key:'fitness', label:'Run Group or Bootcamp', pos:'mr', col:'#111827' },
          { key:'workshop', label:'Creative Pop-Up', pos:'bl', col:'#1F2937' },
        ];
    const mats = [ph1, ph2, ph3];
    const cardStyle = (i, pos) => ({
      position:'absolute', width:CARD_W, height:CARD_H, borderRadius:14, borderWidth:1, borderColor:'#374151', padding:12,
      opacity: mats[i], transform:[{ translateY: mats[i].interpolate({ inputRange:[0,1], outputRange:[12,0] }) }],
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

  return (
    <LinearGradient colors={['rgba(59,130,246,0.18)', 'rgba(14,165,233,0.18)']} style={{ flex: 1 }} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>        
        <AppHeader />
        <ScrollView contentContainerStyle={{ padding:16 }}>
          <View style={{ alignItems:'center' }}>
            <View style={{ width:'100%', maxWidth:420 }}>
          <Animated.View style={{ opacity: fade, transform: [{ translateX: slide.interpolate({ inputRange:[-1,0,1], outputRange:[-24,0,24] }) }] }}>
            {step === 0 && (
              <View>
          <View style={{ backgroundColor:'#fff', borderRadius:16, padding:16, borderWidth:1, borderColor:'#E0E7FF', marginBottom:24 }}>
            <Text style={{ fontSize:22, fontWeight:'800', marginBottom:6 }}>Let’s lock in your payouts</Text>
            <Text style={{ color:'#111827' }}>It only takes a minute. You keep every dollar — guests cover a tiny fee.</Text>
          </View>
                <View style={{ backgroundColor:'#0B1220', borderRadius:16, padding:16, marginBottom:16 }}>
            <Text style={{ color:'#fff', fontWeight:'800', marginBottom:8 }}>Before we hit go…</Text>
                  {['Legal name (or business name)','SSN or EIN','Business address and support contact','Bank account & routing','DOB & residential address'].map((item, idx)=> (
              <View key={idx} style={{ flexDirection:'row', alignItems:'center', marginBottom:6 }}>
                <Ionicons name="checkmark-circle" size={18} color="#60A5FA" style={{ marginRight:8 }} />
                <Text style={{ color:'#E5E7EB' }}>{item}</Text>
              </View>
            ))}
          </View>
                <TouchableOpacity onPress={createConnectedAccount} disabled={creatingAccount} style={{ backgroundColor: creatingAccount ? '#9CA3AF' : '#3B82F6', borderRadius:12, paddingVertical:14, alignItems:'center' }}>
                  <Text style={{ color:'#fff', fontWeight:'700' }}>{creatingAccount ? 'Creating account...' : 'Start'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>

          {step === 1 && (
            <Animated.View style={{ opacity: fade, transform: [{ translateX: slide.interpolate({ inputRange:[-1,0,1], outputRange:[-24,0,24] }) }] }}>
              <View style={{ backgroundColor:'#fff', borderRadius:16, padding:16, borderWidth:1, borderColor:'#E0E7FF', marginBottom:12 }}>
                <Text style={{ fontSize:20, fontWeight:'800', marginBottom:8 }}>Are you an individual or a business?</Text>
                <Text style={{ color:'#4B5563' }}>Pick one to tailor the questions. You can switch later.</Text>
              </View>
              <View style={{ marginBottom:12 }}>
                <TouchableOpacity onPress={()=>{
                  if (!showOptions) {
                    setSelectorOpen(true);
                    Animated.timing(dropdownSpacer, { toValue: OPTIONS_HEIGHT, duration: ANIM_MS, useNativeDriver: false, easing: Easing.out(Easing.quad) }).start(() => {
                      setShowOptions(true);
                      dropdownOpacity.setValue(0);
                      Animated.timing(dropdownOpacity, { toValue: 1, duration: ANIM_MS, useNativeDriver: true }).start();
                    });
                  } else {
                    Animated.timing(dropdownOpacity, { toValue: 0, duration: ANIM_MS, useNativeDriver: true }).start(() => {
                      setShowOptions(false);
                      Animated.timing(dropdownSpacer, { toValue: 0, duration: ANIM_MS, useNativeDriver: false, easing: Easing.out(Easing.quad) }).start(() => setSelectorOpen(false));
                    });
                  }
                }} style={{ paddingVertical:14, paddingHorizontal:12, borderRadius:12, borderWidth:2, borderColor:'#E5E7EB', backgroundColor:'#fff', flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
                  <Text style={{ fontWeight:'800', color:'#111827' }}>
                    {bizType==='sp' ? "I'm an individual" : bizType==='llc' ? 'I have a business' : "I'm a 501c3 charitable foundation"}
                  </Text>
                  <Ionicons name={(selectorOpen||showOptions) ? 'chevron-up' : 'chevron-down'} size={18} color="#6B7280" />
                </TouchableOpacity>
                <View style={{ position:'relative' }}>
                  <Animated.View style={{ height: dropdownSpacer }} />
                  {showOptions && (
                    <Animated.View style={{ position:'absolute', top:0, left:0, right:0, opacity: dropdownOpacity }}>
                      <View style={{ marginTop:8, borderWidth:1, borderColor:'#E5E7EB', borderRadius:12, backgroundColor:'#fff' }}>
                        {[
                          { key:'sp', label:"I'm an individual" },
                          { key:'llc', label:'I have a business' },
                          { key:'501c3', label:"I'm a 501c3 charitable foundation" },
                        ].map((opt, idx)=> (
                          <TouchableOpacity key={opt.key} onPress={()=>{
                            setBizType(opt.key); updateDraft({ bizType: opt.key });
                            Animated.timing(dropdownOpacity, { toValue: 0, duration: ANIM_MS, useNativeDriver: true }).start(() => {
                              setShowOptions(false);
                              Animated.timing(dropdownSpacer, { toValue: 0, duration: ANIM_MS, useNativeDriver: false, easing: Easing.out(Easing.quad) }).start(() => setSelectorOpen(false));
                            });
                          }} style={{ paddingVertical:14, paddingHorizontal:12, borderBottomWidth: idx<2 ? 1 : 0, borderColor:'#F3F4F6' }}>
                            <Text style={{ fontWeight: bizType===opt.key ? '800' : '600', color:'#111827' }}>{opt.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </Animated.View>
                  )}
                </View>
              </View>
              {renderPlaceholders()}
            </Animated.View>
          )}

          {step === 3 && bizType === 'sp' && (
            <Animated.View style={{ opacity: fade, transform: [{ translateX: slide.interpolate({ inputRange:[-1,0,1], outputRange:[-24,0,24] }) }] , marginTop:0, marginBottom:24, backgroundColor:'#fff', borderRadius:16, padding:16, borderWidth:1, borderColor:'#E0E7FF' }}>
              <Text style={{ fontSize:20, fontWeight:'800', marginBottom:8 }}>Website or profile link</Text>
              <Text style={{ color:'#6B7280', marginBottom:8 }}>Optional. If empty, we’ll use your VybeLocal profile.</Text>
              <View style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:12, paddingVertical:10 }}>
                <Text style={{ color:'#111827' }}>{website || 'https://your-site.com (optional)'}</Text>
              </View>
              <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:16 }}>
                <TouchableOpacity onPress={()=>animateTo(2, -1)} style={{ width:'48%', backgroundColor:'#E5E7EB', borderRadius:12, paddingVertical:12, alignItems:'center' }}>
                  <Text style={{ color:'#111827', fontWeight:'700' }}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={()=>{ updateDraft({ website }); animateTo(4, 1); }} style={{ width:'48%', backgroundColor:'#3B82F6', borderRadius:12, paddingVertical:12, alignItems:'center' }}>
                  <Text style={{ color:'#fff', fontWeight:'700' }}>Next</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}

          {step === 4 && bizType === 'sp' && (
            <Animated.View style={{ opacity: fade, transform: [{ translateX: slide.interpolate({ inputRange:[-1,0,1], outputRange:[-24,0,24] }) }] , marginTop:0, marginBottom:24, backgroundColor:'#fff', borderRadius:16, padding:16, borderWidth:1, borderColor:'#E0E7FF' }}>
              <Text style={{ fontSize:20, fontWeight:'800', marginBottom:8 }}>Support contact</Text>
              <Text style={{ color:'#6B7280', marginBottom:8 }}>This appears on receipts. Defaults to your account.</Text>
              <View style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:12, paddingVertical:10, marginBottom:8 }}>
                <Text style={{ color:'#111827' }}>{supportEmail || (user?.email || 'support@vybelocal.com')}</Text>
              </View>
              <View style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:12, paddingVertical:10 }}>
                <Text style={{ color:'#111827' }}>{supportPhone || '(optional phone)'}</Text>
              </View>
              <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:16 }}>
                <TouchableOpacity onPress={()=>animateTo(3, -1)} style={{ width:'48%', backgroundColor:'#E5E7EB', borderRadius:12, paddingVertical:12, alignItems:'center' }}>
                  <Text style={{ color:'#111827', fontWeight:'700' }}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={()=>{ updateDraft({ supportEmail, supportPhone }); animateTo(5, 1); }} style={{ width:'48%', backgroundColor:'#3B82F6', borderRadius:12, paddingVertical:12, alignItems:'center' }}>
                  <Text style={{ color:'#fff', fontWeight:'700' }}>Next</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}

          {step === 5 && bizType === 'sp' && (
            <Animated.View style={{ opacity: fade, transform: [{ translateX: slide.interpolate({ inputRange:[-1,0,1], outputRange:[-24,0,24] }) }] , marginTop:0, marginBottom:24, backgroundColor:'#fff', borderRadius:16, padding:16, borderWidth:1, borderColor:'#E0E7FF' }}>
              <Text style={{ fontSize:20, fontWeight:'800', marginBottom:8 }}>Your address</Text>
              <View style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:12, paddingVertical:10, marginBottom:8 }}>
                <Text style={{ color:'#111827' }}>{addr1 || 'Address line 1'}</Text>
              </View>
              <View style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:12, paddingVertical:10, marginBottom:8 }}>
                <Text style={{ color:'#111827' }}>{addr2 || 'Address line 2 (optional)'}</Text>
                  </View>
              <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
                <View style={{ width:'48%', borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:12, paddingVertical:10 }}>
                  <Text style={{ color:'#111827' }}>{city || 'City'}</Text>
                  </View>
                <View style={{ width:'48%', borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:12, paddingVertical:10 }}>
                  <Text style={{ color:'#111827' }}>{state || 'State'}</Text>
                  </View>
                  </View>
              <View style={{ marginTop:8, borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:12, paddingVertical:10 }}>
                <Text style={{ color:'#111827' }}>{postal || 'Postal code'}</Text>
                  </View>
              <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:16 }}>
                <TouchableOpacity onPress={()=>animateTo(4, -1)} style={{ width:'48%', backgroundColor:'#E5E7EB', borderRadius:12, paddingVertical:12, alignItems:'center' }}>
                  <Text style={{ color:'#111827', fontWeight:'700' }}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={()=>{ updateDraft({ principal: { line1: addr1, line2: addr2, city, state, postal_code: postal } }); animateTo(6, 1); }} style={{ width:'48%', backgroundColor:'#3B82F6', borderRadius:12, paddingVertical:12, alignItems:'center' }}>
                  <Text style={{ color:'#fff', fontWeight:'700' }}>Next</Text>
                  </TouchableOpacity>
              </View>
            </Animated.View>
          )}

          {step === 6 && bizType === 'sp' && (
            <Animated.View style={{ opacity: fade, transform: [{ translateX: slide.interpolate({ inputRange:[-1,0,1], outputRange:[-24,0,24] }) }] , marginTop:0, marginBottom:24, backgroundColor:'#fff', borderRadius:16, padding:16, borderWidth:1, borderColor:'#E0E7FF' }}>
              <Text style={{ fontSize:20, fontWeight:'800', marginBottom:8 }}>Processing estimates</Text>
              <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:8 }}>
                <View style={{ width:'48%', borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:12, paddingVertical:10 }}>
                  <Text style={{ color:'#111827' }}>{avgTicket || 'Avg ticket (USD)'}</Text>
                  </View>
                <View style={{ width:'48%', borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:12, paddingVertical:10 }}>
                  <Text style={{ color:'#111827' }}>{maxTicket || 'High ticket (USD)'}</Text>
                  </View>
                  </View>
              <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
                <View style={{ width:'48%', borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:12, paddingVertical:10 }}>
                  <Text style={{ color:'#111827' }}>{monthlyGross || 'Monthly volume (USD)'}</Text>
                    </View>
                <View style={{ width:'48%', borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:12, paddingVertical:10 }}>
                  <Text style={{ color:'#111827' }}>{monthlyTxn || 'Monthly tx count'}</Text>
                  </View>
                  </View>
              <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:16 }}>
                <TouchableOpacity onPress={()=>animateTo(5, -1)} style={{ width:'48%', backgroundColor:'#E5E7EB', borderRadius:12, paddingVertical:12, alignItems:'center' }}>
                  <Text style={{ color:'#111827', fontWeight:'700' }}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={()=>{
                  updateDraft({ est: { avg_ticket_usd: Number(avgTicket)||35, monthly_gross_usd: Number(monthlyGross)||2500, monthly_txn: Number(monthlyTxn)||50, max_ticket_usd: Number(maxTicket)||200 } });
                  submitIndividual();
                }} style={{ width:'48%', backgroundColor:'#3B82F6', borderRadius:12, paddingVertical:12, alignItems:'center' }}>
                  <Text style={{ color:'#fff', fontWeight:'700' }}>Submit</Text>
                </TouchableOpacity>
                    </View>
            </Animated.View>
          )}
          {step === 2 && bizType === 'sp' && (
            <Animated.View style={{ opacity: fade, transform: [{ translateX: slide.interpolate({ inputRange:[-1,0,1], outputRange:[-24,0,24] }) }] , marginTop:0, marginBottom:24, backgroundColor:'#fff', borderRadius:16, padding:16, borderWidth:1, borderColor:'#E0E7FF', overflow:'hidden' }}>
              <Text style={{ fontSize:20, fontWeight:'800', marginBottom:8 }}>What kind of events are you planning to host?</Text>

              {/* Dropdown trigger */}
              <TouchableOpacity onPress={()=>{
                if (!mccShow) {
                  // If image showing, slide out first
                  if (showMccImage) {
                    Animated.parallel([
                      Animated.timing(mccImageX, { toValue: 60, duration: ANIM_MS, useNativeDriver: true }),
                      Animated.timing(mccImageOpacity, { toValue: 0, duration: ANIM_MS, useNativeDriver: true })
                    ]).start(() => {
                      setShowMccImage(false);
                      Animated.timing(mccImageHeight, { toValue: 0, duration: ANIM_MS, useNativeDriver: false }).start(() => {
                        setMccOpen(true); setMccShow(true); mccOpacity.setValue(0);
                        Animated.timing(mccSpacer, { toValue: MCC_HEIGHT, duration: ANIM_MS, useNativeDriver: false, easing: Easing.out(Easing.quad) }).start(() => {
                          Animated.timing(mccOpacity, { toValue: 1, duration: ANIM_MS, useNativeDriver: true }).start();
                        });
                      });
                    });
                  } else {
                    setMccOpen(true); setMccShow(true); mccOpacity.setValue(0);
                    Animated.timing(mccSpacer, { toValue: MCC_HEIGHT, duration: ANIM_MS, useNativeDriver: false, easing: Easing.out(Easing.quad) }).start(() => {
                      Animated.timing(mccOpacity, { toValue: 1, duration: ANIM_MS, useNativeDriver: true }).start();
                    });
                  }
                } else {
                  Animated.timing(mccOpacity, { toValue: 0, duration: ANIM_MS, useNativeDriver: true }).start(() => {
                    setMccShow(false);
                    Animated.timing(mccSpacer, { toValue: 0, duration: ANIM_MS, useNativeDriver: false, easing: Easing.out(Easing.quad) }).start(() => setMccOpen(false));
                  });
                }
              }} style={{ paddingVertical:14, paddingHorizontal:12, borderRadius:12, borderWidth:2, borderColor:'#E5E7EB', backgroundColor:'#fff', flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
                <Text style={{ fontWeight:'800', color:'#111827' }}>
                  {spMcc==='7922' ? 'Shows, parties, or performances' : spMcc==='7999' ? 'Workshops, classes, or meetups' : 'Food or drink vendor'}
                </Text>
                <Ionicons name={(mccOpen||mccShow) ? 'chevron-up' : 'chevron-down'} size={18} color="#6B7280" />
                  </TouchableOpacity>

              {/* Spacer that makes options push content below if any */}
              <Animated.View style={{ height: mccSpacer }} />

              {/* Options overlay */}
              {mccShow && (
                <Animated.View style={{ position:'absolute', left:16, right:16, top:64, opacity: mccOpacity }}>
                  <View style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:12, backgroundColor:'#fff' }}>
                    {[{
                      key:'7922',
                      title:'Shows, parties, or performances',
                      d1:'Live music, DJ sets, club nights, comedy shows, or ticketed experiences.',
                      d2:'Great for promoters, performers, or nightlife organizers.',
                    }, {
                      key:'7999',
                      title:'Workshops, classes, or meetups',
                      d1:'Yoga flows, painting nights, group runs, or skill-sharing sessions.',
                      d2:'Perfect for teachers, organizers, and anyone building community around a passion.',
                    }, {
                      key:'5814',
                      title:'Food or drink vendor',
                      d1:'Food trucks, pop-up kitchens, coffee carts, tastings, or market booths.',
                      d2:'Ideal for creators serving up something delicious — no brick-and-mortar needed.',
                    }].map((opt, idx) => (
                      <TouchableOpacity key={opt.key} onPress={()=>{
                        setSpMcc(opt.key); updateDraft({ spMcc: opt.key });
                        Animated.timing(mccOpacity, { toValue: 0, duration: ANIM_MS, useNativeDriver: true }).start(() => {
                          setMccShow(false);
                          Animated.timing(mccSpacer, { toValue: 0, duration: ANIM_MS, useNativeDriver: false, easing: Easing.out(Easing.quad) }).start(() => {
                            setMccOpen(false);
                            // show placeholder panel
                            setShowMccImage(true);
                            Animated.timing(mccImageHeight, { toValue: PLACEHOLDER_H, duration: ANIM_MS, useNativeDriver: false }).start(() => {
                              mccImageX.setValue(-60);
                              mccImageOpacity.setValue(0);
                              Animated.parallel([
                                Animated.timing(mccImageX, { toValue: 0, duration: ANIM_MS, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
                                Animated.timing(mccImageOpacity, { toValue: 1, duration: ANIM_MS, useNativeDriver: true })
                              ]).start();
                            });
                          });
                        });
                      }} style={{ padding:14, borderBottomWidth: idx<2 ? 1 : 0, borderColor:'#F3F4F6' }}>
                        <View style={{ flexDirection:'row', alignItems:'center', marginBottom:6 }}>
                          <View style={{ width:22, height:22, borderRadius:11, borderWidth:2, borderColor: spMcc===opt.key ? '#3B82F6' : '#9CA3AF', alignItems:'center', justifyContent:'center', marginRight:10 }}>
                            {spMcc===opt.key && <View style={{ width:10, height:10, borderRadius:5, backgroundColor:'#3B82F6' }} />}
                      </View>
                          <Text style={{ fontWeight:'800', color:'#111827' }}>{opt.title}</Text>
                      </View>
                        <Text style={{ color:'#4B5563', marginBottom:2 }}>{opt.d1}</Text>
                        <Text style={{ color:'#6B7280' }}>{opt.d2}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </Animated.View>
              )}

              {/* Placeholder image area under selector */}
              <Animated.View style={{ height: mccImageHeight, marginTop:8, overflow:'hidden', borderRadius:12 }}>
                {showMccImage && (
                  <Animated.View style={{ flex:1, backgroundColor: spMcc==='7922' ? '#111827' : spMcc==='7999' ? '#0B1220' : '#1F2937', borderRadius:12, transform:[{ translateX: mccImageX }], opacity: mccImageOpacity, padding:12, justifyContent:'center' }}>
                    <Text style={{ color:'#fff', fontWeight:'800', marginBottom:4 }}>
                      {spMcc==='7922' ? 'Nightlife & Performances' : spMcc==='7999' ? 'Workshops & Community' : 'Food or Drink Vendor'}
                    </Text>
                    <Text style={{ color:'#E5E7EB' }}>{spMcc==='7922' ? 'Visual placeholder — ticketed vibes coming soon.' : spMcc==='7999' ? 'Visual placeholder — community vibes coming soon.' : 'Visual placeholder — vendor vibes coming soon.'}</Text>
                  </Animated.View>
                )}
              </Animated.View>

              {/* Footer moved to floating footer */}
            </Animated.View>
          )}

            </View>
          </View>
        </ScrollView>
        {(step===1 || (step===2 && bizType==='sp')) && (
          <View style={{ position:'absolute', left:0, right:0, bottom:24, alignItems:'center' }}>
            <View style={{ width:'100%', maxWidth:420, flexDirection:'row', justifyContent:'space-between', paddingHorizontal:16 }}>
              <TouchableOpacity onPress={()=> (step===1 ? animateTo(0, -1) : animateTo(1, -1))} style={{ width:'48%', backgroundColor:'#E5E7EB', borderRadius:12, paddingVertical:12, alignItems:'center' }}>
                <Text style={{ color:'#111827', fontWeight:'700' }}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={()=> (step===1 ? animateTo(2, 1) : animateTo(3, 1))} style={{ width:'48%', backgroundColor:'#3B82F6', borderRadius:12, paddingVertical:12, alignItems:'center' }}>
                <Text style={{ color:'#fff', fontWeight:'700' }}>{step===1 ? 'Next' : 'Next'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}


