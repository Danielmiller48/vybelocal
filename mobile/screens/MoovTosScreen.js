import React, { useRef, useState } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../utils/supabase';

export default function MoovTosScreen({ route, navigation }) {
  const { mcc, accountId } = route.params || {};
  const [loading, setLoading] = useState(false);
  const webViewRef = useRef(null);

  const handleWebViewMessage = async (event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      console.log('TOS WebView message:', message);

      if (message.type === 'moov:tos:accepted') {
        setLoading(true);
        console.log('TOS accepted, proceeding to onboarding...');
        navigation.navigate('MoovOnboardingWeb', { mcc, accountId });
      } else if (message.type === 'moov:tos:error') {
        Alert.alert('Error', 'There was an issue with terms acceptance. Please try again.');
        setLoading(false);
      } else if (message.type === 'moov:tos:cancel') {
        navigation.goBack();
      }
    } catch (e) {
      console.error('TOS message parse error:', e);
    }
  };

  const facilitatorId = '17963f1c-3e21-413e-a1ee-6f0fa917e46a';

  const htmlContent = `
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <script src="https://js.moov.io/v1"></script>
      <style>
        body {
          font-family: system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial, sans-serif;
          margin: 0;
          padding: 16px;
          background: #f6f7fb;
        }
        .wrap {
          max-width: 720px;
          margin: 0 auto;
        }
        .continue-btn {
          background: #6366f1;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 16px;
          margin-top: 16px;
          cursor: pointer;
          width: 100%;
        }
        .continue-btn:disabled {
          background: #d1d5db;
          cursor: not-allowed;
        }
      </style>
    </head>
    <body>
      <div class="wrap">
        <h3>Terms of Service</h3>
        <moov-terms-of-service id="tos-drop"></moov-terms-of-service>
        <button id="continue-btn" class="continue-btn" disabled>Continue to Onboarding</button>
      </div>
      <script>
        (async function(){
          const facilitator = '${facilitatorId}';
          const accountId = '${accountId || ''}';
          const tosDrop = document.getElementById('tos-drop');
          const continueBtn = document.getElementById('continue-btn');
          
          let tosToken = null;
          
          // Get initial token for TOS Drop
          async function fetchToken() {
            try {
              const res = await fetch('/api/payments/moov/token', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ accountId }) 
              });
              const j = await res.json();
              return j?.access_token;
            } catch (e) {
              console.error('Token fetch failed:', e);
              return null;
            }
          }
          
          try {
            tosDrop.token = await fetchToken();
            console.log('✅ TOS Drop token set');
          } catch (e) {
            console.error('❌ TOS Drop token failed:', e);
          }

          tosDrop.onTermsOfServiceTokenReady = (termsOfServiceToken) => {
            console.log('✅ TOS token generated:', termsOfServiceToken);
            tosToken = termsOfServiceToken;
            continueBtn.disabled = false;
            continueBtn.textContent = 'Continue to Onboarding';
          };

          tosDrop.onTermsOfServiceTokenError = (error) => {
            console.error('❌ TOS token error:', error);
            try { 
              if (window.ReactNativeWebView) { 
                window.ReactNativeWebView.postMessage(JSON.stringify({ type:'moov:tos:error', error })); 
              } 
            } catch(_) {}
          };

          continueBtn.addEventListener('click', async () => {
            if (!tosToken) {
              alert('Please accept the terms of service first');
              return;
            }
            
            continueBtn.disabled = true;
            continueBtn.textContent = 'Processing...';
            
            // Patch TOS token to account
            if (accountId && tosToken) {
              try {
                const res = await fetch('/api/payments/moov/tos/accept', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ accountId, tosToken })
                });
                
                if (res.ok) {
                  console.log('✅ TOS patched to account');
                  try { 
                    if (window.ReactNativeWebView) { 
                      window.ReactNativeWebView.postMessage(JSON.stringify({ type:'moov:tos:accepted' })); 
                    } 
                  } catch(_) {}
                } else {
                  console.error('❌ TOS patch failed:', res.status);
                  try { 
                    if (window.ReactNativeWebView) { 
                      window.ReactNativeWebView.postMessage(JSON.stringify({ type:'moov:tos:error', status: res.status })); 
                    } 
                  } catch(_) {}
                }
              } catch (e) {
                console.error('❌ TOS patch error:', e);
                try { 
                  if (window.ReactNativeWebView) { 
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type:'moov:tos:error', error: e.message })); 
                  } 
                } catch(_) {}
              }
            } else {
              try { 
                if (window.ReactNativeWebView) { 
                  window.ReactNativeWebView.postMessage(JSON.stringify({ type:'moov:tos:accepted' })); 
                } 
              } catch(_) {}
            }
          });

          console.log('🚀 TOS Drop initialized');
        })();
      </script>
    </body>
  </html>`;

  return (
    <SafeAreaView style={styles.container}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Processing terms acceptance...</Text>
        </View>
      )}
      <WebView
        ref={webViewRef}
        source={{ html: htmlContent }}
        style={styles.webview}
        onMessage={handleWebViewMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={false}
        mixedContentMode="compatibility"
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f7fb',
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingText: {
    color: 'white',
    marginTop: 10,
    fontSize: 16,
  },
});
