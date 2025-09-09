import React from 'react';
import { View, ActivityIndicator, Alert, Pressable, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { supabase } from '../utils/supabase';
import { useNavigation } from '@react-navigation/native';

export default function MoovOnboardingWeb({ route }) {
  const [loading, setLoading] = React.useState(true);
  const [userBearer, setUserBearer] = React.useState(null);
  const mcc = route?.params?.mcc || null;
  const acctType = route?.params?.type || null;
  const navigation = useNavigation();
  
  // CRITICAL: Get facilitator ID from React Native context (process.env doesn't work in WebView)
  const facilitatorId = '17963f1c-3e21-413e-a1ee-6f0fa917e46a'; // Your actual facilitator ID

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
          const facilitator = '${facilitatorId}';
          const chosenMcc = '${mcc || '7922'}';
          const drop = document.getElementById('drop');
          drop.facilitatorAccountID = facilitator;
          // Do not pre-request capabilities; let Moov Drops determine requirements
          drop.onError = (e)=> { try { if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(JSON.stringify({ type:'moov:error', payload:e })); } } catch(_) {} };
          const postDone=()=>{
            console.log('🎉 postDone called - onboarding should be finishing!');
            try { if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(JSON.stringify({ type:'moov:done' })); } } catch(_) {}
            try { location.hash = '#moov_done'; } catch(_) {}
          };
          drop.onComplete = () => { console.log('🎉 onComplete fired!'); postDone(); };
          drop.onSuccess = () => { console.log('🎉 onSuccess fired!'); postDone(); };
          drop.onResourceCreated = async ({ resourceType, resource })=>{
            console.log('onResourceCreated called:', resourceType, resource);
            if(resourceType==='account' && resource){
              const acctId = resource.id || resource.accountId || resource.accountID || resource.account_id;
              console.log('Processing account:', acctId);
              
              if (acctId) {
                console.log('Step 1: Token refresh...');
                try { 
                  drop.token = await fetchToken(acctId); 
                  console.log('✅ Token refresh successful');
                } catch(e){ 
                  console.error('❌ Token refresh failed:', e); 
                }
                
                console.log('Step 2: DB association...');
                try { 
                  const assocRes = await fetch('https://vybelocal.com/api/payments/moov/associate', { 
                    method:'POST', 
                    headers:{ 'Content-Type':'application/json', 'Authorization': 'Bearer ${userBearer || ''}' }, 
                    body: JSON.stringify({ accountId: acctId }) 
                  }); 
                  if (assocRes.ok) {
                    console.log('✅ DB association successful');
                  } else {
                    console.error('❌ DB association failed:', assocRes.status);
                  }
                } catch(e){ 
                  console.error('❌ DB association error:', e); 
                }
                
                console.log('✅ onResourceCreated completed for account:', acctId);
                // All disabled API calls removed - should complete cleanly now
              }
            } else {
              console.log('onResourceCreated for non-account resource:', resourceType);
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
          onNavigationStateChange={(st)=>{ try { if ((st?.url||'').includes('moov_done')) { if (navigation?.canGoBack?.()) navigation.goBack(); } } catch(_) {} }}
          onMessage={(evt)=>{
            try {
              const msg = JSON.parse(evt?.nativeEvent?.data||'{}');
              if (msg?.type === 'moov:error') {
                const m = msg?.payload?.error?.message || msg?.payload?.errorType || JSON.stringify(msg?.payload||{});
                Alert.alert('Onboarding error', m);
                return;
              }
              if (msg?.type === 'moov:done') {
                try { if (navigation?.canGoBack?.()) navigation.goBack(); } catch {}
                try { if (typeof window?.close === 'function') window.close(); } catch {}
                return;
              }
            } catch {}
          }}
          onError={(e)=>{ Alert.alert('Load error', e?.nativeEvent?.description || 'Unable to load onboarding.'); }}
        />
        <Pressable onPress={()=>{ try { if (navigation?.canGoBack?.()) navigation.goBack(); } catch {} }} style={{ position:'absolute', right:12, top:12, backgroundColor:'#00000080', paddingVertical:6, paddingHorizontal:10, borderRadius:8 }}>
          <Text style={{ color:'#fff', fontWeight:'700' }}>Close</Text>
        </Pressable>
        {loading && (
          <View style={{ position:'absolute', left:0, right:0, top:0, bottom:0, alignItems:'center', justifyContent:'center' }}>
            <ActivityIndicator />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}


