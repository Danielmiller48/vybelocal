import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking, Alert, TextInput } from 'react-native';
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
  const [mcc, setMcc] = React.useState('7922');
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
      const payload = bizType === 'sp' ? {
        business: {
          type: 'sole_prop',
          legal_name: `${spFirst} ${spLast}`.trim(),
          dba: spDba || undefined,
          address: { line1: spAddr1, city: spCity, state: spState, postal_code: spZip },
          support: { email: supportEmail || undefined, phone: supportPhone || undefined },
          website: websiteOrPolicy,
          statement_descriptor: descriptor || undefined,
          mcc: mcc || undefined,
          underwriting: {
            product_description: productDesc || undefined,
            avg_ticket: avgTicket ? Number(avgTicket) : undefined,
            monthly_volume: monthlyVolume ? Number(monthlyVolume) : undefined,
            monthly_tx_count: monthlyTxCount ? Number(monthlyTxCount) : undefined,
            fulfillment_days: fulfillmentDays ? Number(fulfillmentDays) : undefined,
            checkout_mix: (checkoutInPerson || checkoutOnline) ? {
              in_person: checkoutInPerson ? Number(checkoutInPerson) : 0,
              online: checkoutOnline ? Number(checkoutOnline) : 0,
            } : undefined,
          }
        },
        bank: { holder: `${spFirst} ${spLast}`.trim(), routing: spRouting || undefined, account: spAccount || undefined, plaid_token: plaidToken || undefined },
        control_person: { first_name: spFirst, last_name: spLast, dob: cpDob, ssn: String(cpSsn).replace(/\D/g, ''), address: { line1: (cpAddr1||spAddr1), city: (cpCity||spCity), state: (cpState||spState), postal_code: (cpZip||spZip) } }
      } : {
        business: { type: 'llc', legal_name: llcName, tax_id: llcEin, start_or_incorp_date: llcStartDate || undefined, address: { line1: llcAddr1, city: llcCity, state: llcState, postal_code: llcZip }, support: { email: supportEmail, phone: supportPhone }, website: websiteOrPolicy, statement_descriptor: descriptor },
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
          <View style={{ backgroundColor:'#fff', borderRadius:16, padding:16, borderWidth:1, borderColor:'#E0E7FF', marginBottom:24 }}>
            <Text style={{ fontSize:22, fontWeight:'800', marginBottom:6 }}>Let’s lock in your payouts</Text>
            <Text style={{ color:'#111827' }}>It only takes a minute. You keep every dollar — guests cover a tiny fee.</Text>
          </View>
          {/* What you'll need moved to top */}
          <View style={{ backgroundColor:'#0B1220', borderRadius:16, padding:16, marginBottom:24 }}>
            <Text style={{ color:'#fff', fontWeight:'800', marginBottom:8 }}>Before we hit go…</Text>
            {[
              'Legal business name (or your name if sole proprietor)',
              'Tax ID (SSN or EIN)',
              'Business address and support email/phone',
              'Bank account & routing number',
              'Control person details (name, DOB, address)'
            ].map((item, idx)=> (
              <View key={idx} style={{ flexDirection:'row', alignItems:'center', marginBottom:6 }}>
                <Ionicons name="checkmark-circle" size={18} color="#60A5FA" style={{ marginRight:8 }} />
                <Text style={{ color:'#E5E7EB' }}>{item}</Text>
              </View>
            ))}
          </View>


          {!paymentsReady && (
            <View style={{ marginTop:0, marginBottom:24, backgroundColor:'#fff', borderRadius:16, padding:16, borderWidth:1, borderColor:'#E0E7FF' }}>
              <Text style={{ fontWeight:'800', marginBottom:12 }}>Business type</Text>
              <View style={{ flexDirection:'row', gap:8, marginBottom:16 }}>
                <TouchableOpacity onPress={()=>setBizType('sp')} style={{ paddingVertical:10, paddingHorizontal:12, borderRadius:10, backgroundColor: bizType==='sp' ? '#3B82F6' : '#E5E7EB' }}>
                  <Text style={{ color: bizType==='sp' ? '#fff' : '#111827', fontWeight:'700' }}>I’m an individual</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={()=>setBizType('llc')} style={{ paddingVertical:10, paddingHorizontal:12, borderRadius:10, backgroundColor: bizType==='llc' ? '#3B82F6' : '#E5E7EB' }}>
                  <Text style={{ color: bizType==='llc' ? '#fff' : '#111827', fontWeight:'700' }}>I have a business</Text>
                </TouchableOpacity>
              </View>

              {bizType==='sp' ? (
                <>
                  <Text style={{ fontWeight:'700', marginBottom:6 }}>Legal name (first, last)</Text>
                  <View style={{ flexDirection:'row', gap:8, marginBottom:12 }}>
                    <TextInput value={spFirst} onChangeText={setSpFirst} placeholder="Jane" style={{ flex:1, borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }} />
                    <TextInput value={spLast} onChangeText={setSpLast} placeholder="Doe" style={{ flex:1, borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }} />
                  </View>
                  <Text style={{ fontWeight:'700', marginBottom:6 }}>DBA / Public name</Text>
                  <TextInput value={spDba} onChangeText={setSpDba} placeholder="Jane’s Events" style={{ borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10, marginBottom:12 }} />
                  <Text style={{ fontWeight:'700', marginBottom:6 }}>Statement descriptor (ASCII, ≤20 chars)</Text>
                  <View style={{ marginBottom:12 }}>
                    <TextInput
                      value={descriptor}
                      onChangeText={(t)=>{ setDescriptor(t); setDescriptorLen((t||'').length); }}
                      placeholder="JANESEVENTS"
                      maxLength={20}
                      autoCapitalize="characters"
                      style={{ borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }}
                    />
                    <Text style={{ color:'#6B7280', marginTop:4 }}>{descriptorLen}/20</Text>
                  </View>
                  <Text style={{ fontWeight:'700', marginBottom:6 }}>Support email / phone</Text>
                  <View style={{ flexDirection:'row', gap:8, marginBottom:12 }}>
                    <TextInput value={supportEmail} onChangeText={setSupportEmail} placeholder="email@example.com" keyboardType="email-address" style={{ flex:1, borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }} />
                    <TextInput value={supportPhone} onChangeText={setSupportPhone} placeholder="(555) 555-5555" keyboardType="phone-pad" style={{ flex:1, borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }} />
                  </View>
                  <Text style={{ fontWeight:'700', marginBottom:6 }}>Website or Policy URL (optional)</Text>
                  <TextInput value={websiteOrPolicy} onChangeText={setWebsiteOrPolicy} placeholder="https://yourdomain.com (leave blank to use VybeLocal policy)" autoCapitalize="none" keyboardType="url" style={{ borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10, marginBottom:12 }} />
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
                  <Text style={{ fontWeight:'700', marginBottom:6 }}>Industry / MCC</Text>
                  <TextInput value={mcc} onChangeText={setMcc} placeholder="7922 (Entertainers/Live Events)" keyboardType="number-pad" style={{ borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10, marginBottom:12 }} />
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
                  <TouchableOpacity onPress={()=>setShowAdvanced(!showAdvanced)} style={{ marginTop:12, marginBottom:6 }}>
                    <Text style={{ fontWeight:'700' }}>{showAdvanced ? 'Hide advanced' : 'Advanced (optional)'}</Text>
                  </TouchableOpacity>
                  {showAdvanced && (
                    <>
                      <TextInput value={websiteOrPolicy} onChangeText={setWebsiteOrPolicy} placeholder="https://yourdomain.com" autoCapitalize="none" keyboardType="url" style={{ borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10, marginBottom:8 }} />
                      <TextInput value={descriptor} onChangeText={setDescriptor} placeholder="Statement descriptor (bank line)" style={{ borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }} />
                    </>
                  )}
                </>
              ) : (
                <>
                  <Text style={{ fontWeight:'700', marginBottom:6 }}>Legal business name</Text>
                  <TextInput value={llcName} onChangeText={setLlcName} placeholder="My LLC, Inc." style={{ borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10, marginBottom:12 }} />
                  <Text style={{ fontWeight:'700', marginBottom:6 }}>EIN</Text>
                  <TextInput value={llcEin} onChangeText={setLlcEin} placeholder="12-3456789" keyboardType="number-pad" style={{ borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10, marginBottom:12 }} />
                  <Text style={{ fontWeight:'700', marginBottom:6 }}>Start / Inc date</Text>
                  <TextInput value={llcStartDate} onChangeText={setLlcStartDate} placeholder="YYYY-MM-DD" style={{ borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10, marginBottom:12 }} />
                  <Text style={{ fontWeight:'700', marginBottom:6 }}>Support email / phone</Text>
                  <View style={{ flexDirection:'row', gap:8, marginBottom:12 }}>
                    <TextInput value={supportEmail} onChangeText={setSupportEmail} placeholder="email@example.com" keyboardType="email-address" style={{ flex:1, borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }} />
                    <TextInput value={supportPhone} onChangeText={setSupportPhone} placeholder="(555) 555-5555" keyboardType="phone-pad" style={{ flex:1, borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }} />
                  </View>
                  <Text style={{ fontWeight:'700', marginBottom:6 }}>Business address</Text>
                  <View style={{ marginBottom:12 }}>
                    <AddressAutocomplete
                      value={llcAddr1}
                      onChangeText={setLlcAddr1}
                      onSelect={({ line1, city, state, postal }) => {
                        setLlcAddr1(line1 || ''); setLlcCity(city || ''); setLlcState(state || ''); setLlcZip(postal || '');
                      }}
                    />
                  </View>
                  <View style={{ flexDirection:'row', gap:8, marginBottom:12 }}>
                    <TextInput value={llcCity} onChangeText={setLlcCity} placeholder="City" style={{ flex:1, borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }} />
                    <TextInput value={llcState} onChangeText={setLlcState} placeholder="ST" style={{ width:70, borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }} />
                    <TextInput value={llcZip} onChangeText={setLlcZip} placeholder="ZIP" keyboardType="number-pad" style={{ width:100, borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }} />
                  </View>
                  <Text style={{ fontWeight:'700', marginBottom:6 }}>Control person</Text>
                  <Text style={{ color:'#6B7280', marginBottom:8 }}>The person responsible for the business (managing member/officer). Used for verification only.</Text>
                  <TouchableOpacity onPress={()=>setCpIsSelf(!cpIsSelf)} style={{ flexDirection:'row', alignItems:'center', marginBottom:12 }}>
                    <View style={{ width:22, height:22, borderRadius:6, borderWidth:1, borderColor:'#c7cdd9', marginRight:8, backgroundColor: cpIsSelf ? '#3B82F6' : '#fff', alignItems:'center', justifyContent:'center' }}>
                      {cpIsSelf && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </View>
                    <Text style={{ color:'#111827' }}>I am the managing member/officer in control of this business</Text>
                  </TouchableOpacity>
                  <View style={{ flexDirection:'row', gap:8, marginBottom:12 }}>
                    <TextInput value={cpFirst} onChangeText={setCpFirst} placeholder="First name" style={{ flex:1, borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }} />
                    <TextInput value={cpLast} onChangeText={setCpLast} placeholder="Last name" style={{ flex:1, borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }} />
                  </View>
                  <TextInput value={cpDob} onChangeText={setCpDob} placeholder="YYYY-MM-DD" style={{ borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10, marginBottom:12 }} />
                  <TouchableOpacity onPress={()=>setCpUseBizAddr(!cpUseBizAddr)} style={{ flexDirection:'row', alignItems:'center', marginBottom:8 }}>
                    <View style={{ width:22, height:22, borderRadius:6, borderWidth:1, borderColor:'#c7cdd9', marginRight:8, backgroundColor: cpUseBizAddr ? '#3B82F6' : '#fff', alignItems:'center', justifyContent:'center' }}>
                      {cpUseBizAddr && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </View>
                    <Text style={{ color:'#111827' }}>Use business address for control person</Text>
                  </TouchableOpacity>
                  {!cpUseBizAddr && (
                    <>
                      <Text style={{ fontWeight:'700', marginBottom:6 }}>Control person address</Text>
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
                  <Text style={{ fontWeight:'700', marginBottom:6 }}>Banking</Text>
                  <View style={{ flexDirection:'row', gap:8 }}>
                    <TextInput value={llcRouting} onChangeText={setLlcRouting} placeholder="Routing" keyboardType="number-pad" style={{ flex:1, borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }} />
                    <TextInput value={llcAccount} onChangeText={setLlcAccount} placeholder="Account" keyboardType="number-pad" style={{ flex:1, borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, padding:10 }} />
                  </View>
                </>
              )}
              <TouchableOpacity onPress={openOnboarding} style={{ marginTop:24, backgroundColor:'#3B82F6', borderRadius:12, paddingVertical:14, alignItems:'center' }}>
                <Text style={{ color:'#fff', fontWeight:'700' }}>Start verification</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* removed extra info card per request */}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}


