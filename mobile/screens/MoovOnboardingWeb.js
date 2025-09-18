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
  const tosToken = route?.params?.tosToken || null;
  const navigation = useNavigation();

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
        // Bridge console logs to React Native
        (function(){
          const originalLog = console.log;
          const originalError = console.error;
          const originalWarn = console.warn;
          console.log = function(...args) {
            originalLog.apply(console, args);
            try { if(window.ReactNativeWebView){ window.ReactNativeWebView.postMessage(JSON.stringify({type:'console', level:'log', args})); } } catch(e){}
          };
          console.error = function(...args) {
            originalError.apply(console, args);
            try { if(window.ReactNativeWebView){ window.ReactNativeWebView.postMessage(JSON.stringify({type:'console', level:'error', args})); } } catch(e){}
          };
          console.warn = function(...args) {
            originalWarn.apply(console, args);
            try { if(window.ReactNativeWebView){ window.ReactNativeWebView.postMessage(JSON.stringify({type:'console', level:'warn', args})); } } catch(e){}
          };
        })();
        
        (async function(){
          const facilitator = '17963f1c-3e21-413e-a1ee-6f0fa917e46a';
          const chosenMcc = '${mcc || '7922'}';
          const tosToken = '${tosToken || ''}';
          console.log('Drop setup - facilitator:', facilitator, 'mcc:', chosenMcc, 'tosToken:', tosToken ? 'present' : 'missing');
          const drop = document.getElementById('drop');
          drop.facilitatorAccountID = facilitator;
          // Do not pre-request capabilities; let Moov Drops determine requirements
          drop.onError = (e)=> { 
            console.error('❌ Drop onError fired:', e);
            try { if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(JSON.stringify({ type:'moov:error', payload:e })); } } catch(_) {} 
          };
          
          const postDone=()=>{
            console.log('🎉 postDone called - onboarding should be finishing!');
            try { if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(JSON.stringify({ type:'moov:done' })); } } catch(_) {}
            try { location.hash = '#moov_done'; } catch(_) {}
          };
          
          drop.onComplete = () => {
            console.log('🎉 Drop onComplete fired!');
            postDone();
          };
          
          drop.onSuccess = () => {
            console.log('🎉 Drop onSuccess fired!');
            postDone();
          };
          drop.onResourceCreated = async ({ resourceType, resource })=>{
            console.log('🔧 onResourceCreated called:', resourceType, resource);
            if(resourceType==='account' && resource){
              const acctId = resource.id || resource.accountId || resource.accountID || resource.account_id;
              console.log('Processing account:', acctId);
              if (acctId) {
                try { drop.token = await fetchToken(acctId); } catch(e){ console.error('token refresh failed', e); }
                // Persist association to our DB so webhooks are not required for initial link
                try { await fetch('https://vybelocal.com/api/payments/moov/associate', { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization': 'Bearer ${userBearer || ''}' }, body: JSON.stringify({ accountId: acctId }) }); } catch(_){ }
                // Immediately request wallet + collect-funds capabilities (idempotent)
                try { await fetch('https://vybelocal.com/api/payments/moov/capabilities/request', { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization': 'Bearer ${userBearer || ''}' }, body: JSON.stringify({ accountId: acctId }) }); } catch(_) {}
                
                // Check underwriting status
                console.log('Checking underwriting status for account:', acctId);
                try {
                  const uwRes = await fetch('https://vybelocal.com/api/payments/moov/underwriting?accountId=' + acctId);
                  if (uwRes.ok) {
                    const uwData = await uwRes.json();
                    console.log('🏦 Underwriting status:', uwData.summary);
                    if (uwData.underwriting) {
                      console.log('📋 Underwriting details:', {
                        status: uwData.underwriting.status,
                        averageTransactionSize: uwData.underwriting.averageTransactionSize,
                        maxTransactionSize: uwData.underwriting.maxTransactionSize,
                        collectFunds: uwData.underwriting.collectFunds ? 'configured' : 'missing'
                      });
                    }
                  } else {
                    console.error('❌ Underwriting check failed:', uwRes.status);
                  }
                } catch (e) {
                  console.error('❌ Underwriting check error:', e);
                }
                // Set MCC best‑effort so the Drop skips the big list
                if (chosenMcc) {
                  try {
                    await fetch('https://api.moov.io/v1/accounts/'+acctId+'/profile', {
                      method: 'PATCH',
                      headers: { 'Content-Type':'application/json', 'Authorization': 'Bearer '+drop.token, 'x-moov-version': 'v2024.01.00' },
                      body: JSON.stringify({ businessProfile: { mcc: chosenMcc } })
                    });
                  } catch(_){ }
                }
                
                // Patch TOS token to the account using our backend
                if (tosToken) {
                  console.log('Patching TOS token to account via backend:', acctId);
                  try {
                    const tosRes = await fetch('https://vybelocal.com/api/payments/moov/tos/patch', {
                      method: 'POST',
                      headers: { 
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({ 
                        accountId: acctId,
                        tosToken: tosToken
                      })
                    });
                    if (tosRes.ok) {
                      console.log('✅ TOS token patched successfully');
                    } else {
                      console.error('❌ TOS patch failed:', tosRes.status);
                    }
                  } catch(e) { 
                    console.error('❌ TOS patch error:', e);
                  }
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
          
          // AGGRESSIVE DEBUG: Intercept all network requests and DOM changes
          setTimeout(() => {
            console.log('🔍 AGGRESSIVE DEBUGGING STARTED - Intercepting everything...');
            
            // Intercept all fetch requests
            const originalFetch = window.fetch;
            window.fetch = async function(...args) {
              console.log('🌐 FETCH REQUEST:', args[0], args[1]);
              const response = await originalFetch.apply(this, args);
              const cloned = response.clone();
              try {
                const text = await cloned.text();
                console.log('🌐 FETCH RESPONSE:', response.status, text.substring(0, 200));
              } catch(e) {
                console.log('🌐 FETCH RESPONSE:', response.status, 'Unable to read body');
              }
              return response;
            };
            
            // Intercept all XMLHttpRequest
            const originalXHR = window.XMLHttpRequest;
            window.XMLHttpRequest = function() {
              const xhr = new originalXHR();
              const originalOpen = xhr.open;
              const originalSend = xhr.send;
              
              xhr.open = function(method, url, ...rest) {
                console.log('🌐 XHR REQUEST:', method, url);
                return originalOpen.apply(this, [method, url, ...rest]);
              };
              
              xhr.addEventListener('readystatechange', function() {
                if (xhr.readyState === 4) {
                  console.log('🌐 XHR RESPONSE:', xhr.status, xhr.responseText.substring(0, 200));
                }
              });
              
              return xhr;
            };
            
            // Monitor ALL DOM changes
            const observer = new MutationObserver((mutations) => {
              mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                  mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) {
                      console.log('🔍 NEW DOM ELEMENT:', node.tagName, node.className, node.textContent?.substring(0, 50));
                      
                      // Check for ANY buttons
                      const buttons = node.querySelectorAll ? node.querySelectorAll('button, [role="button"], input[type="submit"], [onclick]') : [];
                      buttons.forEach(btn => {
                        console.log('🔍 FOUND BUTTON:', btn.textContent, btn.type, btn.onclick);
                        btn.addEventListener('click', (e) => {
                          console.log('🔍 BUTTON CLICKED!', e.target.textContent, e.target);
                        }, { capture: true });
                      });
                      
                      // Check for forms
                      const forms = node.querySelectorAll ? node.querySelectorAll('form') : [];
                      forms.forEach(form => {
                        console.log('🔍 FOUND FORM:', form.action, form.method);
                        form.addEventListener('submit', (e) => {
                          console.log('🔍 FORM SUBMITTED!', e.target);
                        }, { capture: true });
                      });
                    }
                  });
                }
              });
            });
            observer.observe(document.body, { childList: true, subtree: true });
            
            // Check existing elements
            const allButtons = document.querySelectorAll('button, [role="button"], input[type="submit"], [onclick]');
            allButtons.forEach(btn => {
              console.log('🔍 EXISTING BUTTON:', btn.textContent, btn.type);
              btn.addEventListener('click', (e) => {
                console.log('🔍 EXISTING BUTTON CLICKED!', e.target.textContent, e.target);
              }, { capture: true });
            });
            
            console.log('🔍 Current Drop state:', {
              facilitatorAccountID: drop.facilitatorAccountID,
              capabilities: drop.capabilities,
              open: drop.open,
              token: drop.token ? 'present' : 'missing'
            });
            
          }, 2000);
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
              
              // Bridge WebView console logs to React Native
              if (msg?.type === 'console') {
                const prefix = `[WebView:${msg.level}]`;
                if (msg.level === 'error') {
                  console.error(prefix, ...msg.args);
                } else if (msg.level === 'warn') {
                  console.warn(prefix, ...msg.args);
                } else {
                  console.log(prefix, ...msg.args);
                }
                return;
              }
              
              console.log('[RN] WebView message:', msg);
              if (msg?.type === 'moov:error') {
                const m = msg?.payload?.error?.message || msg?.payload?.errorType || JSON.stringify(msg?.payload||{});
                Alert.alert('Onboarding error', m);
                return;
              }
              if (msg?.type === 'moov:done') {
                console.log('[RN] Onboarding completed - closing');
                try { if (navigation?.canGoBack?.()) navigation.goBack(); } catch {}
                try { if (typeof window?.close === 'function') window.close(); } catch {}
                return;
              }
            } catch (e) {
              console.log('[RN] WebView message parse error:', e);
            }
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


