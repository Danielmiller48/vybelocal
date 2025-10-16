import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Alert, StyleSheet, ActivityIndicator, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../utils/supabase';
import { useNavigation } from '@react-navigation/native';
import Constants from 'expo-constants';

const LAVENDER = '#CBB4E3';
const MIDNIGHT = '#111827';

const API_BASE = Constants.expoConfig?.extra?.apiBaseUrl || process.env?.EXPO_PUBLIC_API_BASE_URL || 'https://vybelocal.com';
const WAITLIST_API_BASE = Constants.expoConfig?.extra?.waitlistApiBaseUrl || process.env?.EXPO_PUBLIC_WAITLIST_API_BASE_URL || 'https://vybelocal-waitlist.vercel.app';

export default function PaymentMethodsScreen({ route }) {
  const { profile, session } = useAuth();
  const navigation = useNavigation();
  const explicitAccountId = route?.params?.accountId || profile?.moov_account_id || null;
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [deletingBankId, setDeletingBankId] = useState(null);
  const [deletingCardId, setDeletingCardId] = useState(null);
  const [deletingWalletCardId, setDeletingWalletCardId] = useState(null);
  const [walletBusy, setWalletBusy] = useState(false);
  // Verify modal state
  const [verifyVisible, setVerifyVisible] = useState(false);
  const [verifyStage, setVerifyStage] = useState('choose'); // 'choose' | 'complete'
  const [verifyChoice, setVerifyChoice] = useState(null); // 'instant' | 'micro' | null
  const [lastBank, setLastBank] = useState({ accountId: null, bankAccountId: null });
  const [loadingInstant, setLoadingInstant] = useState(false);
  const [loadingMicro, setLoadingMicro] = useState(false);
  const [instantCode, setInstantCode] = useState('');
  const [microA, setMicroA] = useState('');
  const [microB, setMicroB] = useState('');

  const fetchSummary = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      // Ensure we have a Supabase JWT
      let jwt = session?.access_token || null;
      if (!jwt) {
        try {
          const { data } = await supabase.auth.getSession();
          jwt = data?.session?.access_token || null;
        } catch {}
      }
      if (!jwt) {
        throw new Error('Sign in required');
      }

      const bases = [
        API_BASE,
        'https://vybelocal-waitlist.vercel.app',
      ];
      let lastErr = null;
      for (const base of bases) {
        try {
          const url = new URL(`${base}/api/payments/moov/payment-methods/summary`);
          if (explicitAccountId) url.searchParams.set('accountId', explicitAccountId);
          const headers = { Accept: 'application/json', Authorization: `Bearer ${jwt}` };
          const res = await fetch(url.toString(), { headers });
          const text = await res.text();
          let json = {};
          try { json = JSON.parse(text); } catch {}
          if (!res.ok) throw new Error(json?.error || text || `HTTP ${res.status}`);
          setData(json);
          lastErr = null;
          break;
        } catch (err) {
          lastErr = err;
          continue;
        }
      }
      if (lastErr) throw lastErr;
    } catch (e) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [explicitAccountId, session?.access_token]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchSummary(); }, [fetchSummary]);

  const handleVerify = async (bankAccountID) => {
    Alert.prompt(
      'Verify micro‑deposits',
      'Enter two amounts in cents, comma‑separated (e.g., 12,34)',
      async (text) => {
        try {
          const cleaned = String(text || '').split(',').map(t => parseInt(t.trim(), 10)).filter(n => Number.isFinite(n));
          if (cleaned.length !== 2) { Alert.alert('Invalid', 'Enter two numbers, e.g., 12,34'); return; }
          const res = await fetch(`${API_BASE}/api/payments/moov/bank-verify`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accountId: accountIdForWrites, bankAccountId: bankAccountID, amounts: cleaned })
          });
          const j = await res.json();
          if (!res.ok) throw new Error(j?.error || 'Verification failed');
          Alert.alert('Submitted', 'We will confirm once verified.');
          fetchSummary();
        } catch (e) {
          Alert.alert('Error', e?.message || 'Failed');
        }
      },
      'plain-text'
    );
  };

  const handleDeleteBank = async (bankAccountID) => {
    Alert.alert(
      'Remove bank account',
      'Are you sure you want to remove this bank from payouts?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            setDeletingBankId(bankAccountID);
            // Ensure auth header like other calls
            let jwt = session?.access_token || null;
            if (!jwt) {
              try { const { data } = await supabase.auth.getSession(); jwt = data?.session?.access_token || null; } catch {}
            }
            const headers = { 'Content-Type': 'application/json', ...(jwt ? { 'Authorization': `Bearer ${jwt}` } : {}) };
            const res = await fetch(`${API_BASE}/api/payments/moov/bank/delete`, {
              method: 'POST', headers,
              body: JSON.stringify({ accountId: accountIdForWrites, bankAccountId: bankAccountID })
            });
            const j = await res.json().catch(()=>({}));
            if (!res.ok) throw new Error((j?.error || `HTTP ${res.status}`) + (j?.reqId ? ` (reqId ${j.reqId})` : ''));
            Alert.alert('Removed', 'Bank account removed.');
            fetchSummary();
          } catch (e) {
            Alert.alert('Error', e?.message || 'Failed to remove bank');
          } finally {
            setDeletingBankId(null);
          }
        } }
      ]
    );
  };

  const handleDeleteCard = async (cardID) => {
    Alert.alert(
      'Remove card',
      'Are you sure you want to remove this card?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            setDeletingCardId(cardID);
            let jwt = session?.access_token || null;
            if (!jwt) {
              try { const { data } = await supabase.auth.getSession(); jwt = data?.session?.access_token || null; } catch {}
            }
            const headers = { 'Content-Type': 'application/json', ...(jwt ? { 'Authorization': `Bearer ${jwt}` } : {}) };
            const res = await fetch(`${API_BASE}/api/payments/moov/card/delete`, {
              method: 'POST', headers,
              body: JSON.stringify({ accountId: accountIdForWrites, cardId: cardID })
            });
            const j = await res.json().catch(()=>({}));
            if (!res.ok) throw new Error((j?.error || `HTTP ${res.status}`) + (j?.reqId ? ` (reqId ${j.reqId})` : ''));
            Alert.alert('Removed', 'Card removed.');
            fetchSummary();
          } catch (e) {
            Alert.alert('Error', e?.message || 'Failed to remove card');
          } finally {
            setDeletingCardId(null);
          }
        } }
      ]
    );
  };

  const b = data?.business || {};
  const banks = b?.banks || [];
  const cards = b?.cards || [];
  const sources = Array.isArray(b?.sources) ? b.sources : [];
  const status = b?.moov_status || null;
  const accountIdForWrites = b?.accountId || explicitAccountId || profile?.moov_account_id || null;
  const hasHostAccount = !!(b?.accountId || profile?.moov_account_id || explicitAccountId);
  const missingAccount = String(error || '').toLowerCase().includes('missing_account');

  // Consumer (Vybe Wallet)
  const c = data?.consumer || {};
  const cBanks = Array.isArray(c?.banks) ? c.banks : [];
  const cCards = Array.isArray(c?.cards) ? c.cards : [];
  const cSources = Array.isArray(c?.sources) ? c.sources : [];
  const cAccountId = c?.accountId || null;

  try {
    console.log('[PM][empty-check]', {
      loading,
      error: !!error ? String(error) : null,
      status,
      bAccountId: b?.accountId || null,
      profileAccountId: profile?.moov_account_id || null,
      explicitAccountId: explicitAccountId || null,
      accountIdForWrites: accountIdForWrites || null,
      hasHostAccount,
      missingAccount
    });
  } catch(_) {}

  // Find any pending bank verification from normalized sources
  const pendingBank = React.useMemo(() => {
    const normalized = (sources || []).filter((s) => s && s.source_type === 'bank' && s.status && s.status !== 'deleted');
    // handle 'pending' and older variants
    const isPending = (st) => {
      const v = String(st || '').toLowerCase();
      return v === 'pending' || v === 'pending-instant' || v === 'pending-microdeposits' || v === 'pending-micro';
    };
    return normalized.find((s) => isPending(s.status)) || null;
  }, [sources]);

  const getMethodForBankId = React.useCallback((bankAccountID) => {
    try {
      const hit = (sources || []).find((s) => s && s.source_type === 'bank' && String(s.source_id) === String(bankAccountID) && s.status !== 'deleted');
      return (hit && hit.verification_method) || null;
    } catch { return null; }
  }, [sources]);

  const formatCents = React.useCallback((digits) => {
    const d = String(digits || '').replace(/[^0-9]/g, '').slice(0, 2);
    const a = d.length > 0 ? d[0] : '0';
    const b2 = d.length > 1 ? d[1] : '0';
    return `0.${a}${b2}`;
  }, []);

  const openVerifyModal = React.useCallback((bankAccountId) => {
    try { setLastBank({ accountId: accountIdForWrites || null, bankAccountId }); } catch {}
    const m = (getMethodForBankId(bankAccountId) || '').toLowerCase();
    if (m === 'instant' || m === 'micro') { setVerifyChoice(m); setVerifyStage('complete'); }
    else { setVerifyChoice(null); setVerifyStage('choose'); }
    setInstantCode(''); setMicroA(''); setMicroB('');
    setVerifyVisible(true);
  }, [accountIdForWrites, getMethodForBankId]);

  const initiateInstantVerify = React.useCallback(async ()=>{
    try{
      if (loadingInstant) return; setLoadingInstant(true);
      // Ensure JWT
      let jwt = session?.access_token || null;
      if (!jwt) { try { const { data } = await supabase.auth.getSession(); jwt = data?.session?.access_token || null; } catch {}
      }
      if(!jwt){ Alert.alert('Sign in required','Please sign in again.'); return; }
      if(!accountIdForWrites || !lastBank?.bankAccountId){ Alert.alert('Missing info','No bank account found. Try linking again.'); return; }
      // Persist choice
      try{
        const headers = { 'Content-Type':'application/json','Authorization':`Bearer ${jwt}` };
        const payload = { method:'instant', sourceType:'bank', sourceId:lastBank.bankAccountId, accountId: accountIdForWrites, accountKind:'business' };
        fetch(`${WAITLIST_API_BASE}/api/payments/verify/state`, { method:'POST', headers, body: JSON.stringify(payload) }).catch(()=>{});
      }catch{}
      // Initiate with Moov
      const r = await fetch(`${WAITLIST_API_BASE}/api/payments/moov/bank/initiate`, {
        method:'POST', headers:{ 'Content-Type':'application/json','Authorization':`Bearer ${jwt}` },
        body: JSON.stringify({ accountId: accountIdForWrites, bankAccountId: lastBank.bankAccountId, method:'instant' })
      });
      const txt = await r.text().catch(()=> ''); let j={}; try{ j=JSON.parse(txt)||{}; }catch{}
      const rid = j?.reqId || r.headers?.get?.('x-request-id') || null;
      if(r.ok){ setVerifyChoice('instant'); setVerifyStage('complete'); }
      else { Alert.alert('Could not start instant verify', (String(j?.error||j?.message||r.status)) + (rid?`\nreqId: ${rid}`:'')); }
    }catch(e){ Alert.alert('Error', String(e?.message||e)); }
    finally { setLoadingInstant(false); }
  }, [API_BASE, session?.access_token, accountIdForWrites, lastBank, loadingInstant]);

  const initiateMicroDeposits = React.useCallback(async ()=>{
    try{
      if (loadingMicro) return; setLoadingMicro(true);
      let jwt = session?.access_token || null;
      if (!jwt) { try { const { data } = await supabase.auth.getSession(); jwt = data?.session?.access_token || null; } catch {}
      }
      if(!jwt){ Alert.alert('Sign in required','Please sign in again.'); return; }
      if(!accountIdForWrites || !lastBank?.bankAccountId){ Alert.alert('Missing info','No bank account found. Try linking again.'); return; }
      // Persist choice
      try{
        const headers = { 'Content-Type':'application/json','Authorization':`Bearer ${jwt}` };
        const payload = { method:'micro', sourceType:'bank', sourceId:lastBank.bankAccountId, accountId: accountIdForWrites, accountKind:'business' };
        fetch(`${WAITLIST_API_BASE}/api/payments/verify/state`, { method:'POST', headers, body: JSON.stringify(payload) }).catch(()=>{});
      }catch{}
      // Initiate Moov micro-deposits
      const r = await fetch(`${WAITLIST_API_BASE}/api/payments/moov/bank/micro-deposits`, {
        method:'POST', headers:{ 'Content-Type':'application/json','Authorization':`Bearer ${jwt}` },
        body: JSON.stringify({ accountId: accountIdForWrites, bankAccountId: lastBank.bankAccountId })
      });
      const txt = await r.text().catch(()=> ''); let j={}; try{ j=JSON.parse(txt)||{}; }catch{}
      const rid = j?.reqId || r.headers?.get?.('x-request-id') || null;
      if(r.ok){ setVerifyChoice('micro'); setVerifyStage('complete'); }
      else { const extra = [j?.body, j?.preMethod && `preMethod=${j.preMethod}`, j?.preStatus && `preStatus=${j.preStatus}`].filter(Boolean).join('\n'); Alert.alert('Could not send micro-deposits', [String(j?.error||j?.message||r.status), rid?`reqId: ${rid}`:null, extra||null].filter(Boolean).join('\n')); }
    }catch(e){ Alert.alert('Error', String(e?.message||e)); }
    finally { setLoadingMicro(false); }
  }, [API_BASE, session?.access_token, accountIdForWrites, lastBank, loadingMicro]);

  const completeVerification = React.useCallback(async (params)=>{
    try{
      let jwt = session?.access_token || null;
      if (!jwt) { try { const { data } = await supabase.auth.getSession(); jwt = data?.session?.access_token || null; } catch {}
      }
      if(!jwt){ Alert.alert('Sign in required','Please sign in again.'); return; }
      if(!accountIdForWrites || !lastBank?.bankAccountId){ Alert.alert('Missing info','No bank account found.'); return; }
      const payload = { accountId: accountIdForWrites, bankAccountId: lastBank.bankAccountId, ...params };
      const r = await fetch(`${WAITLIST_API_BASE}/api/payments/moov/bank-verify`, { method:'POST', headers:{ 'Content-Type':'application/json','Authorization':`Bearer ${jwt}` }, body: JSON.stringify(payload) });
      const txt = await r.text().catch(()=> ''); let j={}; try{ j=JSON.parse(txt)||{}; }catch{}
      const rid = j?.reqId || r.headers?.get?.('x-request-id') || null;
      if(r.ok){ setVerifyVisible(false); Alert.alert('Verification complete','Your bank is verified.', [ { text:'Back to Payment Methods' } ], { cancelable:false }); fetchSummary(); }
      else { Alert.alert('Verification failed', (String(j?.error||j?.message||r.status)) + (rid?`\nreqId: ${rid}`:'')); }
    }catch(e){ Alert.alert('Error', String(e?.message||e)); }
  }, [WAITLIST_API_BASE, session?.access_token, accountIdForWrites, lastBank, fetchSummary]);

  const handleDeleteWalletCard = async (cardID) => {
    Alert.alert(
      'Remove card',
      'Are you sure you want to remove this card from your Vybe Wallet?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            setDeletingWalletCardId(cardID);
            let jwt = session?.access_token || null;
            if (!jwt) { try { const { data } = await supabase.auth.getSession(); jwt = data?.session?.access_token || null; } catch {}
            }
            if (!cAccountId) throw new Error('Wallet not set up');
            const headers = { 'Content-Type': 'application/json', ...(jwt ? { 'Authorization': `Bearer ${jwt}` } : {}) };
            const res = await fetch(`${API_BASE}/api/payments/moov/card/delete`, {
              method: 'POST', headers,
              body: JSON.stringify({ accountId: cAccountId, cardId: cardID })
            });
            const j = await res.json().catch(()=>({}));
            if (!res.ok) throw new Error((j?.error || `HTTP ${res.status}`) + (j?.reqId ? ` (reqId ${j.reqId})` : ''));
            Alert.alert('Removed', 'Card removed from Vybe Wallet.');
            fetchSummary();
          } catch (e) {
            Alert.alert('Error', e?.message || 'Failed to remove card');
          } finally {
            setDeletingWalletCardId(null);
          }
        } }
      ]
    );
  };

  const setupVybeWallet = async () => {
    try {
      if (walletBusy) return; setWalletBusy(true);
      let jwt = session?.access_token || null;
      if (!jwt) { try { const { data } = await supabase.auth.getSession(); jwt = data?.session?.access_token || null; } catch {}
      }
      if (!jwt) { Alert.alert('Sign in required'); return; }
      const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwt}` };
      const res = await fetch(`${WAITLIST_API_BASE}/api/payments/moov/consumer/preset`, { method:'POST', headers, body: '{}' });
      const txt = await res.text(); let j={}; try{ j=JSON.parse(txt);}catch{}
      if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`);
      fetchSummary();
    } catch (e) {
      Alert.alert('Wallet setup failed', e?.message || 'Try again later');
    } finally { setWalletBusy(false); }
  };


  // removed early return; host placeholder renders inline below

  return (
    <>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <LinearGradient colors={['rgba(203,180,227,0.2)', 'rgba(255,200,162,0.4)']} style={{ flex: 1 }} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
          <AppHeader />
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <View style={{ padding: 16, paddingBottom: 8 }}>
            <Text style={styles.title}>Payment Methods</Text>
            <Text style={styles.subtitle}>Manage Vybe Payouts and your Vybe Wallet.</Text>
          </View>

          

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <View style={{ flexDirection:'row', alignItems:'center' }}>
                <Ionicons name="cash-outline" size={18} color={MIDNIGHT} style={{ marginRight:8 }} />
                <Text style={styles.sectionTitle}>Vybe Payouts</Text>
              </View>
            </View>

            <Text style={{ color:'#6b7280', marginTop:6 }}>Get paid for hosting. Link a bank so your earnings flow straight to you.</Text>

            {loading ? (
              <View style={{ paddingVertical:12, alignItems:'center' }}>
                <ActivityIndicator size="small" color="#6B7280" />
                <Text style={{ color:'#6B7280', marginTop:8 }}>Loading…</Text>
              </View>
            ) : (!hasHostAccount || missingAccount) ? (
              <>
                <View style={{ marginTop:8 }}>
                  <Text style={{ color: MIDNIGHT, fontWeight:'800', marginBottom:6 }}>Vybe Payouts</Text>
                  <Text style={{ color:'#6b7280' }}>Get paid for hosting. Link a bank so your earnings flow straight to you.</Text>
                </View>
                <TouchableOpacity style={[styles.primaryBtn,{ marginTop:12, alignSelf:'flex-start' }]} onPress={()=> navigation.navigate('Home', { screen: 'KybIntro' })}>
                  <Text style={styles.primaryBtnText}>Start Vybe Payouts</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8, marginTop:8 }}>
                  <Chip icon="checkmark-circle-outline" label={`Status: ${b?.moov_status || 'unknown'}`} />
                  <Chip icon="business-outline" label={`Bank: ${b?.bank_verification_status || 'none'}`} />
                  <Chip icon="card-outline" label={`Payouts: ${b?.payouts_ok ? 'ready' : 'not ready'}`} />
                </View>

                {pendingBank && (
                  <View style={[styles.infoBox,{ borderColor:'#BFDBFE', backgroundColor:'#EFF6FF' }]}> 
                    <Ionicons name="information-circle-outline" size={16} color="#1D4ED8" style={{ marginRight:8 }} />
                    <View style={{ flex:1 }}>
                      <Text style={{ color:'#1D4ED8', fontWeight:'700' }}>Bank verification pending</Text>
                      <Text style={{ color:'#1D4ED8', fontSize:12 }}>Resume verification now or anytime from here.</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => navigation.navigate('KybOnboardingClean2', { openVerify: true, bankAccountId: pendingBank.source_id, method: pendingBank.verification_method || 'micro' })}
                      style={{ marginLeft:8, backgroundColor:'#2563EB', borderRadius:8, paddingVertical:8, paddingHorizontal:12 }}
                    >
                      <Text style={{ color:'#fff', fontWeight:'700' }}>Resume</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <TouchableOpacity
                  onPress={()=> {
                    const hasVerifiedBank = Array.isArray(banks) && banks.some(ba => String(ba?.status||'').toLowerCase() === 'verified');
                    const hasVerifiedSource = Array.isArray(sources) && sources.some(s => s && s.source_type==='bank' && String(s.status||'').toLowerCase()==='verified');
                    const oc = !!(b?.payouts_ok || hasVerifiedBank || hasVerifiedSource);
                    navigation.navigate('KybOnboardingClean2', { ff: true, oc });
                  }}
                  style={{ marginTop:12, backgroundColor: LAVENDER, borderRadius: 10, paddingVertical: 10, alignItems:'center', borderWidth:1, borderColor:'rgba(186,164,235,0.6)' }}
                >
                  <Text style={{ color:'#fff', fontWeight:'800' }}>Add payment method</Text>
                </TouchableOpacity>

                {status === 'pending' && (
                  <View style={styles.infoBox}>
                    <Ionicons name="time-outline" size={16} color="#92400e" style={{ marginRight:8 }} />
                    <Text style={styles.infoText}>Underwriting in review. You can still add and view payout methods.</Text>
                  </View>
                )}

                <View style={styles.divider} />

                <Text style={styles.sectionSmallTitle}>Banks</Text>
                {banks.length === 0 ? (
                  <Text style={styles.muted}>No bank accounts.</Text>
                ) : banks.map((ba) => (
                  <View key={ba.bankAccountID} style={[styles.listRow,{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }]}> 
                    <View style={{ flex:1, paddingRight:12 }}>
                      <Text style={styles.rowMain}>{ba.bankName || 'Bank'} •••• {ba.lastFourAccountNumber}</Text>
                      <Text style={styles.rowSub}>Status: {ba.status}</Text>
                      {(ba.status === 'new' || ba.status === 'pending') && (
                        <TouchableOpacity onPress={() => openVerifyModal(ba.bankAccountID)} style={[styles.primaryBtn,{ alignSelf:'flex-start', marginTop:6 }] }>
                          <Text style={styles.primaryBtnText}>Verify account</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <TouchableOpacity disabled={deletingBankId===ba.bankAccountID} onPress={() => handleDeleteBank(ba.bankAccountID)} style={{ paddingVertical:6, paddingHorizontal:10, opacity: deletingBankId===ba.bankAccountID ? 0.5 : 1 }}>
                      {deletingBankId===ba.bankAccountID ? (
                        <View style={{ flexDirection:'row', alignItems:'center' }}>
                          <ActivityIndicator size="small" color="#DC2626" style={{ marginRight:6 }} />
                          <Text style={{ color:'#DC2626', fontWeight:'700' }}>Deleting…</Text>
                        </View>
                      ) : (
                        <Text style={{ color:'#DC2626', fontWeight:'700' }}>Delete</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ))}

                <Text style={[styles.sectionSmallTitle,{ marginTop: 12 }]}>Business cards</Text>
                {cards.length === 0 ? <Text style={styles.muted}>No cards.</Text> : cards.map((c) => (
                  <View key={c.cardID} style={[styles.listRow,{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }]}> 
                    <View style={{ flex:1, paddingRight:12 }}>
                      <Text style={styles.rowMain}>{c.brand} {c.cardType?.toUpperCase?.()} •••• {c.lastFourCardNumber}</Text>
                      <Text style={styles.rowSub}>Exp {c.expiration?.month}/{c.expiration?.year}</Text>
                    </View>
                    <TouchableOpacity disabled={deletingCardId===c.cardID} onPress={() => handleDeleteCard(c.cardID)} style={{ paddingVertical:6, paddingHorizontal:10, opacity: deletingCardId===c.cardID ? 0.5 : 1 }}>
                      {deletingCardId===c.cardID ? (
                        <View style={{ flexDirection:'row', alignItems:'center' }}>
                          <ActivityIndicator size="small" color="#DC2626" style={{ marginRight:6 }} />
                          <Text style={{ color:'#DC2626', fontWeight:'700' }}>Deleting…</Text>
                        </View>
                      ) : (
                        <Text style={{ color:'#DC2626', fontWeight:'700' }}>Delete</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}
          </View>

          {!!error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color="#b91c1c" style={{ marginRight:8 }} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          {/* Loading indicator moved into the Host payouts card */}

          {/* Vybe Wallet */}
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <View style={{ flexDirection:'row', alignItems:'center' }}>
                <Ionicons name="wallet-outline" size={18} color={MIDNIGHT} style={{ marginRight:8 }} />
                <Text style={styles.sectionTitle}>Vybe Wallet</Text>
              </View>
            </View>
            <Text style={{ color:'#6b7280', marginTop:6 }}>Save a card to RSVP faster next time — no digging through your pockets.</Text>

            {!cAccountId && cCards.length === 0 ? (
              <>
                <View style={{ marginTop:8 }}>
                  <Text style={{ color: MIDNIGHT, fontWeight:'800', marginBottom:6 }}>Set up Vybe Wallet</Text>
                  <Text style={{ color:'#6b7280' }}>Create your personal wallet and save a card for quicker RSVPs.</Text>
                </View>
                <TouchableOpacity disabled={walletBusy} style={[styles.primaryBtn,{ marginTop:12, alignSelf:'flex-start', opacity: walletBusy?0.7:1 }]} onPress={setupVybeWallet}>
                  <Text style={styles.primaryBtnText}>{walletBusy ? 'Setting up…' : 'Set up Vybe Wallet'}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={[styles.sectionSmallTitle,{ marginTop: 12 }]}>Cards</Text>
                {cCards.length === 0 ? (
                  <Text style={styles.muted}>No cards saved.</Text>
                ) : cCards.map((c) => (
                  <View key={c.cardID} style={[styles.listRow,{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }]}> 
                    <View style={{ flex:1, paddingRight:12 }}>
                      <Text style={styles.rowMain}>{(c.brand||'').toString().toUpperCase()} •••• {c.lastFourCardNumber || c.lastFour}</Text>
                      <Text style={styles.rowSub}>Exp {c.expiration?.month}/{c.expiration?.year}</Text>
                    </View>
                    <TouchableOpacity disabled={deletingWalletCardId===c.cardID} onPress={() => handleDeleteWalletCard(c.cardID)} style={{ paddingVertical:6, paddingHorizontal:10, opacity: deletingWalletCardId===c.cardID ? 0.5 : 1 }}>
                      {deletingWalletCardId===c.cardID ? (
                        <View style={{ flexDirection:'row', alignItems:'center' }}>
                          <ActivityIndicator size="small" color="#DC2626" style={{ marginRight:6 }} />
                          <Text style={{ color:'#DC2626', fontWeight:'700' }}>Deleting…</Text>
                        </View>
                      ) : (
                        <Text style={{ color:'#DC2626', fontWeight:'700' }}>Delete</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>

    {/* Verification Modal (cloned from onboarding, simplified) */}
    <Modal visible={verifyVisible} transparent={false} animationType="slide" onRequestClose={()=> setVerifyVisible(false)}>
          <View style={{ flex:1, backgroundColor:'#FFFFFF', justifyContent:'center', alignItems:'center' }}>
            <View style={{ width:'92%', maxWidth:480, backgroundColor:'#FFFFFF', padding:16, borderRadius:16, shadowColor:'#000', shadowOpacity:0.08, shadowRadius:12, elevation:6 }}>
            {verifyStage === 'choose' && (
              <>
                <Text style={{ fontSize:22, fontWeight:'900', marginBottom:8 }}>Verify your bank</Text>
                <Text style={{ color:'#4B5563', marginBottom:4 }}>Choose how you want to confirm your payout account. Fast lane or old‑school — up to you.</Text>
                <Text style={{ color:'#6B7280', marginBottom:8 }}>(Not ready? You can always come back from Payment Methods.)</Text>
                <View style={{ marginBottom:16 }}>
                  <Text style={{ color:'#111827', fontWeight:'800', marginBottom:4 }}>Instant (Recommended)</Text>
                  <Text style={{ color:'#4B5563' }}>{'• We\u2019ll send a $0.01 test deposit with a short code in the description'}</Text>
                  <Text style={{ color:'#4B5563' }}>{'• Drop the code here to finish verification'}</Text>
                  <Text style={{ color:'#4B5563', marginBottom:8 }}>{'• Most banks clear it in minutes — no 2-day wait'}</Text>
                  <Text style={{ color:'#111827', fontWeight:'800', marginBottom:4 }}>Micro‑Deposits</Text>
                  <Text style={{ color:'#4B5563' }}>{'• We\u2019ll send two tiny deposits to your account'}</Text>
                  <Text style={{ color:'#4B5563' }}>{'• Start before 4:15 PM ET → usually shows up same day'}</Text>
                  <Text style={{ color:'#4B5563' }}>{'• After that → lands the next business day'}</Text>
                </View>
                <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
                  <TouchableOpacity disabled={loadingInstant} onPress={initiateInstantVerify} style={{ width:'48%', backgroundColor: loadingInstant ? '#93C5FD' : '#2563EB', borderRadius:12, paddingVertical:12, alignItems:'center', opacity: loadingInstant ? 0.7 : 1 }}>
                    <Text style={{ color:'#fff', fontWeight:'700' }}>{loadingInstant ? 'Starting…' : 'Instant verify'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity disabled={loadingMicro} onPress={initiateMicroDeposits} style={{ width:'48%', backgroundColor: loadingMicro ? '#FDE68A' : '#F59E0B', borderRadius:12, paddingVertical:12, alignItems:'center', opacity: loadingMicro ? 0.7 : 1 }}>
                    <Text style={{ color:'#111827', fontWeight:'700' }}>{loadingMicro ? 'Sending…' : 'Send micro‑deposits'}</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={()=> setVerifyVisible(false)} style={{ marginTop:12, backgroundColor:'#E5E7EB', borderRadius:12, paddingVertical:12, alignItems:'center' }}>
                  <Text style={{ color:'#111827', fontWeight:'700' }}>Back to Payment Methods</Text>
                </TouchableOpacity>
              </>
            )}
            {verifyStage === 'complete' && (
              <>
                <Text style={{ fontSize:22, fontWeight:'900', marginBottom:10 }}>{verifyChoice==='instant' ? 'Enter bank verification code' : 'Enter micro‑deposit amounts'}</Text>
                {verifyChoice === 'instant' ? (
                  <>
                    <Text style={{ color:'#4B5563', marginBottom:12 }}>Enter the code from your bank (formats: MV0000 or 0000).</Text>
                    <TextInput value={instantCode} onChangeText={setInstantCode} placeholder="MV1234" placeholderTextColor="#9CA3AF" autoCapitalize="characters" style={{ borderWidth:1, borderColor:'#E5E7EB', backgroundColor:'#FFFFFF', color:'#111827', borderRadius:10, paddingHorizontal:12, paddingVertical:10, marginBottom:12 }} />
                    <TouchableOpacity onPress={()=>{ const code=instantCode.trim(); if(code){ completeVerification({ code }); } else { Alert.alert('Code required'); } }} style={{ backgroundColor:'#10B981', borderRadius:12, paddingVertical:12, alignItems:'center' }}>
                      <Text style={{ color:'#fff', fontWeight:'700' }}>Finish verification</Text>
                    </TouchableOpacity>
                    <Text style={{ color:'#6B7280', marginTop:10, fontSize:12, textAlign:'center' }}>Instant verification completes immediately after you enter your code.</Text>
                  </>
                ) : (
                  <>
                    <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
                      <View style={{ width:'48%' }}>
                        <Text style={{ color:'#374151', fontWeight:'700', marginBottom:6 }}>Deposit 1</Text>
                        <TextInput value={formatCents(microA)} onChangeText={(t)=>{ const only=String(t||'').replace(/[^0-9]/g,''); const two=only.length<=2?only:only.slice(only.length-2); setMicroA(two); }} keyboardType="number-pad" placeholder="0.00" placeholderTextColor="#9CA3AF" style={{ borderWidth:1, borderColor:'#E5E7EB', backgroundColor:'#FFFFFF', color:'#111827', borderRadius:10, paddingHorizontal:12, paddingVertical:10 }} />
                      </View>
                      <View style={{ width:'48%' }}>
                        <Text style={{ color:'#374151', fontWeight:'700', marginBottom:6 }}>Deposit 2</Text>
                        <TextInput value={formatCents(microB)} onChangeText={(t)=>{ const only=String(t||'').replace(/[^0-9]/g,''); const two=only.length<=2?only:only.slice(only.length-2); setMicroB(two); }} keyboardType="number-pad" placeholder="0.00" placeholderTextColor="#9CA3AF" style={{ borderWidth:1, borderColor:'#E5E7EB', backgroundColor:'#FFFFFF', color:'#111827', borderRadius:10, paddingHorizontal:12, paddingVertical:10 }} />
                      </View>
                    </View>
                    <TouchableOpacity
                      disabled={!(String(microA||'').replace(/[^0-9]/g,'').length===2 && String(microB||'').replace(/[^0-9]/g,'').length===2)}
                      onPress={()=>{
                        const da = String(microA||'').replace(/[^0-9]/g,'');
                        const db = String(microB||'').replace(/[^0-9]/g,'');
                        if(da.length !== 2 || db.length !== 2){ Alert.alert('Two digits each required','Enter exactly two digits for each amount (e.g., 00 and 00).'); return; }
                        const a = parseInt(da, 10); const b = parseInt(db, 10);
                        completeVerification({ amounts:[a, b] });
                      }}
                      style={{ marginTop:12, backgroundColor: (String(microA||'').replace(/[^0-9]/g,'').length===2 && String(microB||'').replace(/[^0-9]/g,'').length===2) ? '#10B981' : '#D1D5DB', borderRadius:12, paddingVertical:12, alignItems:'center' }}
                    >
                      <Text style={{ color:'#fff', fontWeight:'700' }}>Finish verification</Text>
                    </TouchableOpacity>
                    <Text style={{ color:'#9CA3AF', marginTop:10, fontSize:12, textAlign:'center' }}>This step confirms it’s really your account. Deposits usually appear within 48 hours.</Text>
                  </>
                )}
                <TouchableOpacity onPress={()=> setVerifyVisible(false)} style={{ marginTop:12, backgroundColor:'#E5E7EB', borderRadius:12, paddingVertical:12, alignItems:'center' }}>
                  <Text style={{ color:'#111827', fontWeight:'700' }}>Close</Text>
                </TouchableOpacity>
              </>
            )}
            </View>
          </View>
        </Modal>
    </>
  );
}

// Append verification modal UI inside component return (placed before closing tags above)

function Chip({ icon, label, onPress }){
  return (
    <TouchableOpacity onPress={onPress} style={styles.chip}>
      {icon ? <Ionicons name={icon} size={16} color={MIDNIGHT} style={{ marginRight:6 }} /> : null}
      <Text style={styles.chipText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: MIDNIGHT,
    fontWeight: '800',
    fontSize: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginVertical: 12,
  },
  sectionSmallTitle: {
    color: MIDNIGHT,
    fontWeight: '800',
    marginBottom: 6,
  },
  listRow: {
    paddingVertical: 8,
    borderBottomColor: '#f3f4f6',
    borderBottomWidth: 1,
  },
  rowMain: {
    color: '#1f2937',
    fontWeight: '600',
  },
  rowSub: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(240,235,250,0.9)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BAA4EB',
  },
  chipText: {
    color: MIDNIGHT,
    fontWeight: '700',
    fontSize: 12,
  },
  primaryBtn: {
    backgroundColor: LAVENDER,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(186,164,235,0.6)',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '800',
  },
  muted: {
    color: '#6b7280',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginHorizontal: 16,
    marginTop: 8,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 12,
    flex: 1,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderColor: 'rgba(251, 191, 36, 0.2)',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  infoText: {
    color: '#92400e',
    fontSize: 12,
    flex: 1,
  },
});
