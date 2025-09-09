import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Pressable, Dimensions, Animated, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AppHeader from '../components/AppHeader';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../utils/supabase';
import MoovOnboardingWeb from './MoovOnboardingWeb';

export default function KybIntroScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [faqOpen, setFaqOpen] = React.useState([false, false, false, false]);
  const winH = Dimensions.get('window').height;
  const panelH = Math.min(140, Math.max(96, Math.floor(winH * 0.14)));
  const pulse = React.useRef(new Animated.Value(1)).current;
  const [submitting, setSubmitting] = React.useState(false);
  const [mcc, setMcc] = React.useState('7922'); // default: ticketed events/promoters

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.04, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const toggleFaq = (idx) => {
    setFaqOpen((prev) => prev.map((v, i) => (i === idx ? !v : v)));
  };

  const GridTile = ({ icon, title, body }) => (
    <View style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderRadius: 16, padding: 12, marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name={icon} size={20} color="#6B46FF" style={{ marginRight: 10 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '700', color: '#111827' }}>{title}</Text>
          <Text style={{ color: '#374151', fontSize: 14 }}>{body}</Text>
        </View>
      </View>
    </View>
  );

  const Step = ({ n, title, body }) => (
    <View style={{ flexDirection:'row', marginBottom:12 }}>
      <View style={{ width:26 }}>
        <View style={{ width:24, height:24, borderRadius:12, backgroundColor:'#E5E7EB', alignItems:'center', justifyContent:'center' }}>
          <Text style={{ fontSize:12, fontWeight:'700', color:'#111827' }}>{n}</Text>
        </View>
      </View>
      <View style={{ flex:1 }}>
        <Text style={{ fontWeight:'700', color:'#111827' }}>{title}</Text>
        <Text style={{ color:'#374151', fontSize:13 }}>{body}</Text>
      </View>
    </View>
  );

  const Check = ({ text }) => (
    <View style={{ flexDirection:'row', alignItems:'center', marginBottom:6 }}>
      <Ionicons name="checkmark-circle" size={16} color="#A78BFA" style={{ marginRight:8 }} />
      <Text style={{ color:'#111827' }}>{text}</Text>
    </View>
  );

  const handleStart = async () => {
    try {
      setSubmitting(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { Alert.alert('Sign in required', 'Please log in to continue.'); return; }
      // Preflight status to avoid duplicate onboarding
      try {
        const res = await fetch('https://vybelocal.com/api/payments/moov/status', { headers: { 'Authorization': `Bearer ${token}` } });
        const j = await res.json();
        const status = (j?.moov_status || '').toLowerCase();
        if (status === 'in_review' || status === 'active') {
          Alert.alert('Already submitted', status === 'active' ? 'Your account is active.' : 'Your details are pending review.');
          return;
        }
        if (status === 'action_required') { navigation.navigate('MoovOnboardingWeb'); return; }
      } catch (_) {}
      navigation.navigate('MoovOnboardingWeb');
    } finally { setSubmitting(false); }
  };

  return (
    <LinearGradient colors={['rgba(203,180,227,0.2)', 'rgba(255,200,162,0.4)']} style={{ flex: 1 }} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <AppHeader />
        <ScrollView contentContainerStyle={{ padding:16, paddingBottom: panelH + insets.bottom + 24 }}>
          {/* Hero */}
          <View style={{ backgroundColor:'#fff', borderRadius:16, padding:18, borderWidth:1, borderColor:'#EAE7F8' }}>
            <Text style={{ fontSize:24, fontWeight:'800', marginBottom:6 }}>Turn your vibe into income.</Text>
            <Text style={{ color:'#6B7280', marginBottom:12 }}>It’s fast, free, and built for real ones.</Text>
            <View style={{ backgroundColor:'#F3EFFF', borderColor:'#A78BFA', borderWidth:1, paddingVertical:12, paddingHorizontal:14, borderRadius:12 }}>
              <Text style={{ color:'#4C1D95', fontWeight:'700' }}>Hosts keep 100%.</Text>
              <Text style={{ color:'#6B46FF' }}>Guests pay a tiny fee to keep the lights on.</Text>
            </View>
          </View>

          {/* Why VybeLocal (concise) */}
          <View style={{ marginTop:28, backgroundColor:'#fff', borderRadius:16, padding:16, borderWidth:1, borderColor:'#EAE7F8' }}>
            <Text style={{ fontSize:16, fontWeight:'800', marginBottom:8 }}>Why VybeLocal</Text>
            <View style={{ flexDirection:'column' }}>
              <GridTile icon="ticket-outline" title="Sell out your event — literally." body="Paid RSVPs straight through VybeLocal." />
              <GridTile icon="shield-checkmark-outline" title="Get paid fast." body="We handle payouts so you don’t have to chase checks." />
              <GridTile icon="stats-chart-outline" title="Know who showed up." body="Track attendance, earnings, and growth in one place." />
            </View>
          </View>

          

          {/* How it works */}
          <View style={{ marginTop:28, backgroundColor:'#fff', borderRadius:16, padding:16, borderWidth:1, borderColor:'#EAE7F8' }}>
            <Text style={{ fontSize:16, fontWeight:'800', marginBottom:8 }}>How it works</Text>
            <Step n={1} title="Add details" body="Event info and where to send payouts." />
            <Step n={2} title="Verify (KYB)" body="Quick identity/business check." />
            <Step n={3} title="Publish" body="RSVPs open in minutes." />
            <Step n={4} title="Payout" body="24h after your event ends." />
          </View>

          

          {/* Choose category (maps to MCC) */}
          <View style={{ marginTop:16, backgroundColor:'#fff', borderRadius:12, padding:16 }}>
            <Text style={{ fontSize:16, fontWeight:'800', marginBottom:8 }}>Your category</Text>
            {[
              { key:'7922', title:'Event ticketing / promoters', desc:'Concerts, shows, paid RSVPs' },
              { key:'5812', title:'Food & beverage events', desc:'Pop‑ups, tastings, dinners' },
              { key:'7999', title:'Classes & community', desc:'Workshops, fitness, clubs' },
              { key:'8299', title:'Education / workshops', desc:'Lessons, seminars' },
            ].map(opt => (
              <Pressable key={opt.key} onPress={()=> setMcc(opt.key)} style={{ paddingVertical:10, flexDirection:'row', alignItems:'center' }}>
                <Ionicons name={mcc===opt.key? 'radio-button-on' : 'radio-button-off'} size={18} color={mcc===opt.key? '#6B46FF':'#9CA3AF'} style={{ marginRight:10 }} />
                <View style={{ flex:1 }}>
                  <Text style={{ fontWeight:'700', color:'#111827' }}>{opt.title}</Text>
                  <Text style={{ color:'#6B7280', fontSize:12 }}>{opt.desc}</Text>
                </View>
              </Pressable>
            ))}
            <Text style={{ color:'#6b7280', marginTop:8 }}>We’ll set this on your account so Moov skips the big list.</Text>
          </View>

          {/* Requirements */}
          <View style={{ marginTop:16, backgroundColor:'#fff', borderRadius:12, padding:16 }}>
            <Text style={{ fontSize:16, fontWeight:'800', marginBottom:8 }}>What you need</Text>
            <Check text="Legal name and contact" />
            <Check text="Bank for payouts" />
            <Check text="ID / tax details (KYB)" />
            <Check text="Optional business info (LLC/corp)" />
            <Text style={{ color:'#6b7280', marginTop:8 }}>Encrypted end‑to‑end. We don’t sell data.</Text>
          </View>

          {/* FAQ accordion */}
          <View style={{ marginTop:16, backgroundColor:'#fff', borderRadius:12, padding:8 }}>
            {[
              ['Do I need a company?', 'Nope. You can start as a solo act. Sole proprietors are welcome.'],
              ['Taxes?', 'Earn $600 or more in a year? We’ll send a 1099 for your records.'],
              ['Free events?', 'Absolutely. Monetize if you want—vibes are always free.'],
              ['Who sees my data?', 'Just us and our secure payment partner. No third‑party nonsense.'],
            ].map(([q,a],i)=> (
              <View key={i} style={{ borderTopWidth: i===0 ? 0 : 1, borderTopColor:'#E5E7EB' }}>
                <Pressable onPress={()=>toggleFaq(i)} style={{ paddingHorizontal:8, paddingVertical:12, flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
                  <Text style={{ fontWeight:'700', color:'#111827' }}>{q}</Text>
                  <Ionicons name={faqOpen[i] ? 'chevron-up' : 'chevron-down'} size={18} color="#6B7280" />
                </Pressable>
                {faqOpen[i] && (
                  <Text style={{ color:'#374151', fontSize:13, paddingHorizontal:8, paddingBottom:12 }}>{a}</Text>
                )}
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Compact sticky CTA (lavender button) */}
        <View style={{ position:'absolute', left:0, right:0, bottom:0, height: panelH + insets.bottom, paddingBottom: insets.bottom + 8, alignItems:'center', justifyContent:'flex-end' }}>
          <Pressable onPress={handleStart} disabled={submitting} style={{ width:'100%', alignItems:'center' }}>
            <Animated.View style={{ width:'92%', backgroundColor:'#A78BFA', opacity: submitting ? 0.7 : 1, borderRadius:16, paddingVertical:14, alignItems:'center', transform:[{ scale: pulse }] }}>
              <Text style={{ color:'#fff', fontWeight:'800', fontSize:16 }}>{submitting ? 'Starting…' : 'Start verification'}</Text>
            </Animated.View>
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}


