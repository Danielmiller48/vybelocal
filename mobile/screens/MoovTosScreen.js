import React, { useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { View } from 'react-native';

export default function MoovTosScreen({ route, navigation }) {
  const { mcc, accountId } = route.params || {};
  const webRef = useRef(null);

  const html = `<!doctype html><html><head>
  <meta charset='utf-8'/>
  <meta name='viewport' content='width=device-width, initial-scale=1'/>
  <script src='https://js.moov.io/v1'></script>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif;margin:0;background:#f6f7fb}
    .wrap{max-width:720px;margin:0 auto;padding:16px;position:relative;z-index:0}
    h3{margin:0 0 12px}
    .box{background:#fff;border-radius:10px;box-shadow:0 1px 2px rgba(0,0,0,0.06);padding:12px;position:relative;overflow:auto}
    moov-terms-of-service{display:block}
    .btn{margin-top:16px;width:100%;background:#6366f1;color:#fff;border:none;border-radius:8px;padding:12px 16px;font-size:16px;position:relative;z-index:2;pointer-events:auto}
    .btn:disabled{background:#d1d5db}
  </style></head><body>
  <div class='wrap'>
    <h3>Terms of Service</h3>
    <div class='box'>
      <moov-terms-of-service id='tos'></moov-terms-of-service>
    </div>
    <button id='go' class='btn' disabled>Continue to Onboarding</button>
  </div>
  <script>(async function(){
    function log(){
      try{ if(window.ReactNativeWebView){ window.ReactNativeWebView.postMessage(JSON.stringify({type:'log', args:[...arguments]})); } }catch(e){}
      try{ console.log.apply(console, arguments); }catch(e){}
    }
    const termsOfService = document.querySelector('moov-terms-of-service');
    const btn = document.getElementById('go');
    let tosToken=null;
    log('TOS flow - no accountId needed yet');
    async function token(){
      const r = await fetch('https://vybelocal.com/api/payments/moov/token',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({})
      });
      const j = await r.json();
      return j.access_token;
    }
    const apiToken = await token();
    termsOfService.token = apiToken;
    termsOfService.setAttribute('token', apiToken);
    termsOfService.textColor='rgb(17,24,39)';
    termsOfService.linkColor='rgb(37,99,235)';
    termsOfService.backgroundColor='rgb(255,255,255)';
    termsOfService.fontSize='16px';
    termsOfService.onTermsOfServiceTokenReady=(termsOfServiceToken)=>{log('tos ready');tosToken=termsOfServiceToken;btn.disabled=false};
    termsOfService.onTermsOfServiceTokenError=(error)=>{log('tos error',error)};
    async function handleGo(){
      log('btn click');
      if(!tosToken){alert('Please accept the terms first');return;}
      try{
         const res=await fetch('https://vybelocal.com/api/payments/moov/tos/accept',{
           method:'POST',headers:{'Content-Type':'application/json'},
           body:JSON.stringify({ tosToken: tosToken })
        });
        if(res.ok){
          if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(JSON.stringify({type:'moov:tos:accepted'}));}
        }else{
          log('tos patch failed',res.status);
        }
      }catch(err){ log('tos patch error',err) }
    }
    btn.addEventListener('click', async function(){
      log('btn click');
      if(!tosToken){alert('Please accept the terms first');return;}
      // Pass TOS token directly to onboarding instead of trying to patch it here
      if(window.ReactNativeWebView){
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type:'moov:tos:accepted', 
          tosToken: tosToken
        }));
      }
    });
  })();</script>
  </body></html>`;

  const onMessage = (e) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'moov:tos:accepted') {
        navigation.navigate('MoovOnboardingWeb', { 
          mcc, 
          accountId, 
          tosAccepted: true,
          tosToken: msg.tosToken 
        });
      }
    } catch {}
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }} edges={['top']}> 
      <View style={{ flex: 1, backgroundColor: '#f6f7fb' }}>
        <WebView ref={webRef} source={{ html, baseUrl: 'https://vybelocal.com' }} onMessage={onMessage} />
      </View>
    </SafeAreaView>
  );
}
