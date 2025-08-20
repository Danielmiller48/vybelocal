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
        <Text style={{ fontSize:22, fontWeight:'800', marginBottom:12 }}>Community Guidelines</Text>
        <Text style={{ color:'#4b5563', marginBottom:12 }}>
          VybeLocal exists to spark real‑world connection. These quick rules keep every vibe safe, inclusive,
          and legit.
        </Text>

        <Bullet text={
          <>
            <Text style={{ fontWeight:'700' }}>Respect the space.</Text> Treat hosts, guests, and venues like neighbors—because they are.
          </>
        } />
        <Bullet text={
          <>
            <Text style={{ fontWeight:'700' }}>Consent is non‑negotiable.</Text> Ask before filming, tagging, or stepping into personal bubbles.
          </>
        } />
        <Bullet text={
          <>
            <Text style={{ fontWeight:'700' }}>Adults‑only (18+) unless supervised.</Text> Until we roll out kid‑safe tools, events are for adults or minors accompanied by a responsible adult.
          </>
        } />
        <Bullet text={
          <>
            <Text style={{ fontWeight:'700' }}>Keep it legal.</Text> No illicit sales, hate speech, or anything that would make your grandma—or the cops—cringe.
          </>
        } />
        <Bullet text={
          <>
            <Text style={{ fontWeight:'700' }}>No spam or shady promos.</Text> VybeLocal isn’t the place for risqué “fan page” links, MLM recruiting, or selling unrelated services.
          </>
        } />
        <Bullet text={
          <>
            <Text style={{ fontWeight:'700' }}>Leave no trace.</Text> Pack out what you pack in. Good vibes don’t leave a mess.
          </>
        } />
        <Bullet text={
          <>
            <Text style={{ fontWeight:'700' }}>See something? Say something.</Text> Flag sketchy events or users in‑app and our crew will step in fast.
          </>
        } />
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
} 

function Bullet({ text }){
  return (
    <View style={{ flexDirection:'row', marginBottom:10 }}>
      <View style={{ width:8, height:8, borderRadius:4, backgroundColor:'#CBB4E3', marginTop:8, marginRight:10 }} />
      <Text style={{ lineHeight:22, color:'#111827', flex:1 }}>{text}</Text>
    </View>
  );
}