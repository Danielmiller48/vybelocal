// mobile/screens/GuidelinesScreen.js
import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppHeader from '../components/AppHeader';
import HomeDrawerOverlay from '../components/HomeDrawerOverlay';
import colors from '../theme/colors';

export default function GuidelinesScreen(){
  return (
    <SafeAreaView style={{ flex:1, backgroundColor: 'transparent' }} edges={['top','left','right']}> 
      <HomeDrawerOverlay />
      <AppHeader />
      <ScrollView contentContainerStyle={{ padding:16 }}>
        <Text style={{ fontSize:18, fontWeight:'700', marginBottom:12 }}>Community Guidelines</Text>
        <Text style={{ lineHeight:22 }}>
          Placeholder guidelines. Be kind, be real, show up, no hate speech …
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
} 