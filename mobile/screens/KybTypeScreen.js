import React from 'react';
import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AppHeader from '../components/AppHeader';

export default function KybTypeScreen({ navigation, route }) {
  const [type, setType] = React.useState('individual');
  const [mcc, setMcc] = React.useState('7922');

  const businessOptions = [
    { key:'7922', title:'Event ticketing / promoters', desc:'Concerts, shows, paid RSVPs' },
    { key:'5812', title:'Food & beverage events', desc:'Pop‑ups, tastings, dinners' },
    { key:'7999', title:'Classes & community', desc:'Workshops, fitness, clubs' },
    { key:'8299', title:'Education / workshops', desc:'Lessons, seminars' },
  ];

  const start = () => {
    const params = type === 'business' ? { mcc, type } : { type };
    navigation.navigate('MoovOnboardingWeb', params);
  };

  return (
    <SafeAreaView style={{ flex:1 }} edges={['top','left','right']}>
      <AppHeader />
      <ScrollView contentContainerStyle={{ padding:16, paddingBottom:24 }}>
        <Text style={{ fontSize:22, fontWeight:'800', marginBottom:12 }}>How are you operating?</Text>
        <View style={{ backgroundColor:'#fff', borderRadius:12, padding:12, borderWidth:1, borderColor:'#EAE7F8' }}>
          {[
            { key:'individual', title:'Individual', desc:'Sole operator. Fastest setup.' },
            { key:'business', title:'Business (LLC/Corp/Nonprofit)', desc:'Company details and EIN.' },
          ].map(opt => (
            <Pressable key={opt.key} onPress={()=> setType(opt.key)} style={{ paddingVertical:10, flexDirection:'row', alignItems:'center' }}>
              <Ionicons name={type===opt.key? 'radio-button-on' : 'radio-button-off'} size={18} color={type===opt.key? '#6B46FF':'#9CA3AF'} style={{ marginRight:10 }} />
              <View style={{ flex:1 }}>
                <Text style={{ fontWeight:'700', color:'#111827' }}>{opt.title}</Text>
                <Text style={{ color:'#6B7280', fontSize:12 }}>{opt.desc}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        {type === 'business' && (
          <View style={{ marginTop:16, backgroundColor:'#fff', borderRadius:12, padding:12, borderWidth:1, borderColor:'#EAE7F8' }}>
            <Text style={{ fontSize:16, fontWeight:'800', marginBottom:8 }}>Select your category</Text>
            {businessOptions.map(opt => (
              <Pressable key={opt.key} onPress={()=> setMcc(opt.key)} style={{ paddingVertical:10, flexDirection:'row', alignItems:'center' }}>
                <Ionicons name={mcc===opt.key? 'radio-button-on' : 'radio-button-off'} size={18} color={mcc===opt.key? '#6B46FF':'#9CA3AF'} style={{ marginRight:10 }} />
                <View style={{ flex:1 }}>
                  <Text style={{ fontWeight:'700', color:'#111827' }}>{opt.title}</Text>
                  <Text style={{ color:'#6B7280', fontSize:12 }}>{opt.desc}</Text>
                </View>
              </Pressable>
            ))}
            <Text style={{ color:'#6b7280', marginTop:8 }}>We’ll set this on your Moov profile to speed up verification.</Text>
          </View>
        )}

      </ScrollView>

      <View style={{ position:'absolute', left:0, right:0, bottom:0, padding:16 }}>
        <Pressable onPress={start} style={{ backgroundColor:'#A78BFA', paddingVertical:14, borderRadius:14, alignItems:'center' }}>
          <Text style={{ color:'#fff', fontWeight:'800' }}>Continue</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}


