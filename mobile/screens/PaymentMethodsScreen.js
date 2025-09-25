import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Alert, StyleSheet, ActivityIndicator } from 'react-native';
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
  const status = b?.moov_status || null;
  const accountIdForWrites = b?.accountId || explicitAccountId || profile?.moov_account_id || null;


  // If no host onboarding started yet → replace with CTA
  if (!loading && !error && !status) {
    return (
      <LinearGradient colors={['rgba(203,180,227,0.2)', 'rgba(255,200,162,0.4)']} style={{ flex: 1 }} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }}>
          <AppHeader />
          <ScrollView contentContainerStyle={[styles.container,{ paddingHorizontal:16 }]}>
            <View style={[styles.card,{ alignItems:'center' }]}>
              <Ionicons name="card-outline" size={28} color={MIDNIGHT} style={{ marginBottom: 8 }} />
              <Text style={styles.title}>Set up payments</Text>
              <Text style={[styles.subtitle,{ textAlign:'center', marginTop: 4 }]}>Start host onboarding to link your payout method.</Text>
              <TouchableOpacity style={[styles.primaryBtn,{ marginTop: 12 }]} onPress={()=> navigation.navigate('Home', { screen: 'KybIntro' })}>
                <Text style={styles.primaryBtnText}>Begin onboarding</Text>
              </TouchableOpacity>
            </View>
            {!!error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color="#b91c1c" style={{ marginRight:8 }} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['rgba(203,180,227,0.2)', 'rgba(255,200,162,0.4)']} style={{ flex: 1 }} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }}>
        <AppHeader />
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <View style={{ padding: 16, paddingBottom: 8 }}>
            <Text style={styles.title}>Payment Methods</Text>
            <Text style={styles.subtitle}>Add or manage payout banks and cards used for hosting.</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <View style={{ flexDirection:'row', alignItems:'center' }}>
                <Ionicons name="cash-outline" size={18} color={MIDNIGHT} style={{ marginRight:8 }} />
                <Text style={styles.sectionTitle}>Host payouts</Text>
              </View>
              <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8 }}>
                <Chip icon="checkmark-circle-outline" label={`Status: ${b?.moov_status || 'unknown'}`} />
                <Chip icon="business-outline" label={`Bank: ${b?.bank_verification_status || 'none'}`} />
                <Chip icon="card-outline" label={`Payouts: ${b?.payouts_ok ? 'ready' : 'not ready'}`} />
              </View>
            </View>

            <TouchableOpacity
              onPress={()=> navigation.navigate('KybOnboardingClean2', { ff: true })}
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
                    <TouchableOpacity onPress={() => handleVerify(ba.bankAccountID)} style={[styles.primaryBtn,{ alignSelf:'flex-start', marginTop:6 }] }>
                      <Text style={styles.primaryBtnText}>Verify deposits</Text>
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
          </View>

          {!!error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color="#b91c1c" style={{ marginRight:8 }} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          {loading && <Text style={[styles.muted,{ textAlign:'center', marginTop:8 }]}>Loading…</Text>}

          <View style={{ height: 24 }} />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

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
