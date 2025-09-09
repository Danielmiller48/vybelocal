import React from 'react';
import { View, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { supabase } from '../utils/supabase';

export default function MoovOnboardingWeb({ route }) {
  const [loading, setLoading] = React.useState(true);
  const [userBearer, setUserBearer] = React.useState(null);
  const mcc = route?.params?.mcc || null;
  const acctType = route?.params?.type || 'individual';

  React.useEffect(()=>{
    (async ()=>{
      const { data: { session } } = await supabase.auth.getSession();
      setUserBearer(session?.access_token || null);
    })();
  },[]);
  const html = `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <script src="https://js.moov.io/v1"></script>
      <style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif;margin:0;padding:16px;background:#f6f7fb} .wrap{max-width:720px;margin:0 auto}</style>
    </head>
    <body>
      <div class="wrap">
        <h3>Getting your onboarding ready…</h3>
        <moov-onboarding id="drop" show-logo></moov-onboarding>
      </div>
      <script>
        (async function(){
          const facilitator = '${process.env.MOOV_FACILITATOR_ACCOUNT_ID || process.env.MOOV_PLATFORM_ACCOUNT_ID || ''}';
          const chosenMcc = '${mcc || ''}';
          const drop = document.getElementById('drop');
          drop.facilitatorAccountID = facilitator;
          // Do not pre-request capabilities; let Moov Drops determine requirements
          drop.onError = (e)=> { try { if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(JSON.stringify({ type:'moov:error', payload:e })); } } catch(_) {} };
          drop.onComplete = ()=> { try { if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(JSON.stringify({ type:'moov:done' })); } } catch(_) {} };
          drop.onResourceCreated = async ({ resourceType, resource })=>{
            if(resourceType==='account' && resource){
              const acctId = resource.id || resource.accountId || resource.accountID || resource.account_id;
              if (acctId) {
                try { drop.token = await fetchToken(acctId); } catch(e){ console.error('token refresh failed', e); }
                // Persist association to our DB so webhooks are not required for initial link
                try { await fetch('https://vybelocal.com/api/payments/moov/associate', { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization': 'Bearer ${userBearer || ''}' }, body: JSON.stringify({ accountId: acctId }) }); } catch(_){ }
                // Immediately request wallet + collect-funds capabilities (idempotent)
                try { await fetch('https://vybelocal.com/api/payments/moov/capabilities/request', { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization': 'Bearer ${userBearer || ''}' }, body: JSON.stringify({ accountId: acctId }) }); } catch(_) {}
                // If user chose business, best‑effort set businessProfile.mcc to skip large list
                if (chosenMcc && '${acctType}' === 'business') {
                  try {
                    await fetch('https://api-sandbox.moov.io/v1/accounts/'+acctId+'/profile', {
                      method: 'PATCH',
                      headers: { 'Content-Type':'application/json', 'Authorization': 'Bearer '+drop.token },
                      body: JSON.stringify({ businessProfile: { mcc: chosenMcc } })
                    });
                  } catch(_){ }
                }
              }
            }
          };
          async function fetchToken(accountId){
            // Try primary domain, then vercel fallback
            const bodies = [
              ['', '/api/payments/moov/token'],
              ['https://vybelocal-waitlist.vercel.app','https://vybelocal-waitlist.vercel.app/api/payments/moov/token']
            ];
            for (const [base, url] of bodies){
              try {
                const res = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ accountId }) });
                const j = await res.json();
                if(res.ok && j.access_token){
                  try { if (!drop.facilitatorAccountID && j.facilitator_account_id) { drop.facilitatorAccountID = j.facilitator_account_id; } } catch {}
                  return j.access_token;
                }
              } catch (e) {}
            }
            throw new Error('token fetch failed');
          }
          try { drop.token = await fetchToken(); drop.open = true; } catch(e){ alert('Token error: '+e.message); }
        })();
      </script>
    </body>
  </html>`;
  if (!userBearer) {
    return (
      <SafeAreaView style={{ flex:1, backgroundColor:'#000' }} edges={['top','left','right']}>
        <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex:1, backgroundColor:'#000' }} edges={['top','left','right']}> 
      <View style={{ flex:1, backgroundColor:'#fff' }}>
        <WebView
          source={{ html, baseUrl: 'https://vybelocal.com' }}
          onLoadEnd={()=> setLoading(false)}
          startInLoadingState
          incognito
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={["*"]}
          setSupportMultipleWindows={false}
          mixedContentMode="always"
          onMessage={(evt)=>{
            try {
              const msg = JSON.parse(evt?.nativeEvent?.data||'{}');
              if (msg?.type === 'moov:error') {
                const m = msg?.payload?.error?.message || msg?.payload?.errorType || JSON.stringify(msg?.payload||{});
                Alert.alert('Onboarding error', m);
                return;
              }
              if (msg?.type === 'moov:done') {
                try { if (global?.navigationRef?.canGoBack?.()) global.navigationRef.goBack(); } catch {}
                try { if (typeof window?.close === 'function') window.close(); } catch {}
                return;
              }
            } catch {}
          }}
          onError={(e)=>{ Alert.alert('Load error', e?.nativeEvent?.description || 'Unable to load onboarding.'); }}
        />
        {loading && (
          <View style={{ position:'absolute', left:0, right:0, top:0, bottom:0, alignItems:'center', justifyContent:'center' }}>
            <ActivityIndicator />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}


