import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import Constants from 'expo-constants';
import { supabase } from '../utils/supabase';

export default function CheckoutModal({ open, onClose, eventId, amountCents, onSuccess }){
  const WAITLIST_API_BASE = Constants.expoConfig?.extra?.waitlistApiBaseUrl || process.env?.EXPO_PUBLIC_WAITLIST_API_BASE_URL || 'https://vybelocal-waitlist.vercel.app';
  const [loading, setLoading] = useState(true);
  const [idem, setIdem] = useState(null);
  const [saveCard, setSaveCard] = useState(true);
  const [accountId, setAccountId] = useState(null);
  const [dropUrl, setDropUrl] = useState(null);
  const [dbgSeq, setDbgSeq] = useState(0);
  const dbg = (...args) => { try { console.log('[checkout]', ...args); } catch {} };

  useEffect(() => { if (open) setIdem(`ck_${Date.now()}_${Math.random().toString(36).slice(2)}`); }, [open]);

  // Ensure consumer account exists and build Drop URL
  useEffect(() => {
    (async () => {
      if (!open) return;
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const headers = { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };
        const res = await fetch(`${WAITLIST_API_BASE}/api/payments/moov/consumer/preset`, { method: 'POST', headers, body: '{}' });
        const txt = await res.text(); let j={}; try{ j=JSON.parse(txt);}catch{}
        if (!res.ok || !j?.accountId) throw new Error(j?.error || 'consumer_preset_failed');
        setAccountId(j.accountId);
        setDropUrl(`${WAITLIST_API_BASE}/drops/card?accountId=${encodeURIComponent(j.accountId)}`);
      } catch (e) {
        // fallback: allow page to load without accountId (will likely stay blank)
        setDropUrl(`${WAITLIST_API_BASE}/drops/card`);
      } finally {
        // keep spinner until WebView onLoadEnd fires
      }
    })();
  }, [open, WAITLIST_API_BASE]);

  const onWVMessage = async (e) => {
    try {
      const raw = e?.nativeEvent?.data || '';
      dbg('wv:msg', raw?.slice?.(0, 300));
      let msg = {};
      try { msg = JSON.parse(raw); } catch { msg = { type: 'unknown', raw }; }
      if (msg?.type === 'tokenized' || msg?.type === 'card:success') {
        // Create payment then charge
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const headers = { 'Content-Type': 'application/json', 'x-idempotency-key': idem, ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };
        const cRes = await fetch(`${WAITLIST_API_BASE}/api/payments/create`, { method:'POST', headers, body: JSON.stringify({ event_id: eventId, qty: 1 }) });
        const cTxt = await cRes.text(); let cj={}; try{ cj=JSON.parse(cTxt);}catch{}
        dbg('payments:create', { status: cRes.status, ok: cRes.ok, body: (cTxt||'').slice(0,200) });
        if (!cRes.ok) throw new Error(cj?.error || 'create_failed');
        const pId = cj?.payment_id;
        const chRes = await fetch(`${WAITLIST_API_BASE}/api/payments/charge`, { method:'POST', headers, body: JSON.stringify({ payment_id: pId }) });
        const chTxt = await chRes.text(); let chj={}; try{ chj=JSON.parse(chTxt);}catch{}
        dbg('payments:charge', { status: chRes.status, ok: chRes.ok, body: (chTxt||'').slice(0,200) });
        if (!chRes.ok) throw new Error(chj?.error || 'charge_failed');
        onSuccess?.();
        onClose?.();
      } else if (msg?.type === 'card:ready' || msg?.type === 'card:mount' || msg?.type === 'card:drop-error' || msg?.type === 'err' || msg?.type === 'console') {
        // surface Drop logs to native console
        dbg('drop', msg);
      }
    } catch (err) {
      // TODO: show error toast
      dbg('wv:error', err?.message || String(err));
    }
  };

  const htmlUrl = dropUrl || `${WAITLIST_API_BASE}/drops/card`;

  return (
    <Modal visible={open} transparent animationType='fade' onRequestClose={onClose}>
      <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.55)', justifyContent:'center', alignItems:'center', padding:16 }}>
        <View style={{ width:'92%', maxWidth:520, height:'70%', backgroundColor:'#fff', borderRadius:16, overflow:'hidden' }}>
          <View style={{ padding:12, borderBottomWidth:1, borderBottomColor:'#eee', flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
            <Text style={{ fontWeight:'800' }}>Checkout</Text>
            <TouchableOpacity onPress={onClose}><Text style={{ fontWeight:'800' }}>✕</Text></TouchableOpacity>
          </View>
          {!!htmlUrl && (
          <WebView
            source={{ uri: htmlUrl }}
            onLoadEnd={()=>setLoading(false)}
            onMessage={onWVMessage}
            style={{ flex:1 }}
            originWhitelist={['*']}
            javaScriptEnabled
            domStorageEnabled
            mixedContentMode='always'
            injectedJavaScriptBeforeContentLoaded={`(function(){try{var _l=console.log;console.log=function(){try{window.ReactNativeWebView.postMessage(JSON.stringify({type:'console', args:Array.prototype.slice.call(arguments)}));}catch(e){} try{_l&&_l.apply(console,arguments);}catch(e2){} };}catch(e){}})();true;`}
            onShouldStartLoadWithRequest={() => true}
            onContentProcessDidTerminate={() => {}}
          />)}
          {loading && <View style={{ position:'absolute', top:0,left:0,right:0,bottom:0, alignItems:'center', justifyContent:'center' }}><ActivityIndicator /></View>}
        </View>
      </View>
    </Modal>
  );
}













