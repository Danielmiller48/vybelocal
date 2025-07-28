// mobile/screens/HostCreateScreen.js
import React from 'react';
import { View, Text } from 'react-native';
import colors from '../theme/colors';
import AppHeader from '../components/AppHeader';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HostCreateScreen(){
  return (
    <SafeAreaView style={{ flex:1, backgroundColor: colors.card }} edges={['top','left','right']}> 
      <AppHeader />
      <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
        <Text style={{ fontSize:18, fontWeight:'600', color: colors.textPrimary }}>Host an event coming soon…</Text>
      </View>
    </SafeAreaView>
  );
} 