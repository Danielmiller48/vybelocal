import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Animated, Easing, Dimensions, Alert, TextInput, Linking, ActivityIndicator, Pressable } from 'react-native';
import { WebView } from 'react-native-webview';
import AddressAutocomplete from '../components/AddressAutocomplete';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AppHeader from '../components/AppHeader';
import { useOnboardingDraft } from '../components/OnboardingDraftProvider';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../utils/supabase';
import Constants from 'expo-constants';

const API_BASE_URL = Constants.expoConfig?.extra?.waitlistApiBaseUrl || process.env?.EXPO_PUBLIC_WAITLIST_API_BASE_URL || 'https://vybelocal-waitlist.vercel.app';
const POLICY_URL = `${API_BASE_URL}/policies`;
const PRIVACY_URL = `${API_BASE_URL}/privacy`;
const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' }, { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' }, { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' },
  { code: 'DC', name: 'District of Columbia' }, { code: 'FL', name: 'Florida' }, { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' }, { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' }, { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' }, { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' }, { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' }, { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' }, { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' }, { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' }, { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' }, { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' }, { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }
];

export default function KybOnboardingScreen() {
  const { profile, user } = useAuth();
  const { draft, updateDraft } = useOnboardingDraft();
  const [step, setStep] = React.useState(0);
  const [bizType, setBizType] = React.useState(draft.bizType || 'sp'); // 'sp' | 'llc' | '501c3'
  const [spMcc, setSpMcc] = React.useState(draft.spMcc || '7922'); // individual MCC selection
  const [supportEmail, setSupportEmail] = React.useState(draft.supportEmail || '');
  const [supportPhone, setSupportPhone] = React.useState(draft.supportPhone || '');
  const [addr1, setAddr1] = React.useState(draft.principal?.line1 || '');
  const [addr2, setAddr2] = React.useState(draft.principal?.line2 || '');
  const [city, setCity] = React.useState(draft.principal?.city || '');
  const [state, setState] = React.useState(draft.principal?.state || '');
  const [postal, setPostal] = React.useState(draft.principal?.postal_code || '');
  const [avgTicket, setAvgTicket] = React.useState(String(draft.est?.avg_ticket_usd || 25));
  const [monthlyGross, setMonthlyGross] = React.useState(String(draft.est?.monthly_gross_usd || 500));
  const [monthlyTxn, setMonthlyTxn] = React.useState(String(draft.est?.monthly_txn || 20));
  const [maxTicket, setMaxTicket] = React.useState(String(draft.est?.max_ticket_usd || 50));
  const [agreed, setAgreed] = React.useState(false);
  const [tosToken, setTosToken] = React.useState(null);
  const slide = React.useRef(new Animated.Value(0)).current;
  const fade  = React.useRef(new Animated.Value(1)).current;
  const ANIM_MS = 200;
  const SCREEN_WIDTH = Dimensions.get('window').width;
  const SCREEN_HEIGHT = Dimensions.get('window').height;
  const ph1 = React.useRef(new Animated.Value(0)).current;
  const ph2 = React.useRef(new Animated.Value(0)).current;
  const ph3 = React.useRef(new Animated.Value(0)).current;

  const [creatingAccount, setCreatingAccount] = React.useState(false);
  const [selectorOpen, setSelectorOpen] = React.useState(false);
  const [showOptions, setShowOptions] = React.useState(false);
  const [baseLegal, setBaseLegal] = React.useState(null);
  const [ssn, setSsn] = React.useState(''); // raw digits only
  const [dobUs, setDobUs] = React.useState(''); // MM-DD-YYYY display
  const [bankHolder, setBankHolder] = React.useState('');
  const [bankName, setBankName] = React.useState('');
  const [bankRouting, setBankRouting] = React.useState('');
  const [bankAccount, setBankAccount] = React.useState('');
  const [cpFirstName, setCpFirstName] = React.useState('');
  const [cpLastName, setCpLastName] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [idemKey, setIdemKey] = React.useState(null);
  const [moovAccountId, setMoovAccountId] = React.useState(null);
  const [pmLinked, setPmLinked] = React.useState(false);
  const piiWebRef = React.useRef(null);
  const ssnHiddenRef = React.useRef(null);
  const dropdownSpacer = React.useRef(new Animated.Value(0)).current; // pushes placeholders down
  const dropdownOpacity = React.useRef(new Animated.Value(0)).current;
  const OPTIONS_HEIGHT = 170;
  // Business fields (LLC/Corp)
  const [bizLegalName, setBizLegalName] = React.useState('');
  const [bizEin, setBizEin] = React.useState(''); // 9-digit digits only
  const [bizIncorpUs, setBizIncorpUs] = React.useState(''); // MM-DD-YYYY
  const [bizWebsite, setBizWebsite] = React.useState('');
  const [bizSupportEmail, setBizSupportEmail] = React.useState('');
  const [bizSupportPhone, setBizSupportPhone] = React.useState('');
  // Removed previous processor field; server defaults to "I've never processed payments before"
  const isBizDetailsValid = React.useMemo(() => {
    const nameOk = !!String(bizLegalName||'').trim();
    const einOk = /^\d{9}$/.test(String(bizEin||'').replace(/\D/g,''));
    const dateOk = /^\d{2}-\d{2}-\d{4}$/.test(String(bizIncorpUs||''));
    const addrOk = !!String(addr1||'').trim();
    const cityOk = !!String(city||'').trim();
    const stateOk = !!String(state||'').trim();
    const zipOk = /^\d{5}(-\d{4})?$/.test(String(postal||'').trim());
    return nameOk && einOk && dateOk && addrOk && cityOk && stateOk && zipOk;
  }, [bizLegalName, bizEin, bizIncorpUs, addr1, city, state, postal]);

  // Step 2 (MCC) dropdown animations
  const [mccOpen, setMccOpen] = React.useState(false);
  const [mccShow, setMccShow] = React.useState(false);
  const mccSpacer = React.useRef(new Animated.Value(0)).current;
  const mccOpacity = React.useRef(new Animated.Value(0)).current;
  const MCC_HEIGHT = 440;
  const [mccSelected, setMccSelected] = React.useState(false);
  const [optionsHeight, setOptionsHeight] = React.useState(0);
  const MCC_SPACER_ADJUST = 70; // trims extra gap so box aligns with last option
  // Business class/subclass selection
  const [bizClass, setBizClass] = React.useState(null); // 'food' | 'events' | 'fitness' | 'arts'
  const [subOpen, setSubOpen] = React.useState(false);
  const [bizMcc, setBizMcc] = React.useState(draft.bizMcc || null);
  const [bizSubclass, setBizSubclass] = React.useState(draft.bizSubclass || null); // unique UI selection key
  const [bizMccSelected, setBizMccSelected] = React.useState(!!draft.bizMcc);
  // Placeholder image under MCC selector
  const [showMccImage, setShowMccImage] = React.useState(false);
  const mccImageHeight = React.useRef(new Animated.Value(0)).current;
  const mccImageX = React.useRef(new Animated.Value(-60)).current;
  const mccImageOpacity = React.useRef(new Animated.Value(0)).current;
  const PLACEHOLDER_H = 280;

  // Fast-forward into step 5 when account is active but payouts not yet OK
  React.useEffect(()=>{
    (async ()=>{
      try{
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return;
        const r = await fetch('https://vybelocal.com/api/payments/moov/status',{ headers:{ 'Authorization': `Bearer ${token}` } });
        const j = await r.json();
        const status = String(j?.moov_status||'').toLowerCase();
        const payoutsOk = !!j?.payouts_ok;
        if (status==='active' && !payoutsOk) {
          if (j?.moov_account_id) setMoovAccountId(j.moov_account_id);
          setStep(5);
        }
      }catch{}
    })();
  },[]);

  // Debug: log when step/bizType changes
  React.useEffect(() => {
    try { console.log('[KYB][debug] step:', step, 'bizType:', bizType); } catch {}
    if (step === 4 && bizType === 'sp') {
      try { console.log('[KYB][debug] Rendering INDIVIDUAL PII WebView step (step 4)'); } catch {}
    }
  }, [step, bizType]);

  // Embedded composable PII WebView HTML (Moov Drops) for SSN/DOB collection
  const piiHtml = `<!doctype html>
  <html>
    <head>
      <meta charset='utf-8'/>
      <meta name='viewport' content='width=device-width, initial-scale=1'/>
      <script src='https://js.moov.io/v1'></script>
      <style>
        body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif;margin:0;background:#fff}
        .wrap{padding:8px}
        .box{background:#fff;border-radius:10px;border:1px solid #E5E7EB;padding:10px}
        label{display:block;font-weight:700;margin:6px 0 4px;color:#111827;font-size:13px}
        moov-text-input, moov-form{display:block;border:1px solid #E5E7EB;border-radius:8px;height:38px;overflow:hidden}
        moov-text-input:focus-within{border-color:#3B82F6;box-shadow:0 0 0 2px rgba(59,130,246,0.2)}
        .btn{margin-top:10px;width:100%;background:#3B82F6;color:#fff;border:none;border-radius:8px;padding:10px 12px;font-weight:700;font-size:14px}
        .row{display:flex;gap:8px}
      </style>
    </head>
    <body>
      <div class='wrap'>
        <div class='box'>
          <moov-form name='pii-form' method='POST' action='/noop'></moov-form>
          <div class='row'>
            <div style='flex:1'>
              <label>SSN (9 digits)</label>
              <moov-text-input id='ssn' formname='pii-form' name='ssn' placeholder='***-**-****'></moov-text-input>
            </div>
            <div style='flex:1'>
              <label>DOB (YYYY-MM-DD)</label>
              <moov-text-input id='dob' formname='pii-form' name='dob' placeholder='1990-01-31'></moov-text-input>
            </div>
          </div>
          <button id='save' class='btn'>Use these values</button>
        </div>
      </div>
      <script>
        (async function(){
          function post(type, payload){ try { if(window.ReactNativeWebView){ window.ReactNativeWebView.postMessage(JSON.stringify({ type, payload })); } } catch(_){} }
          const form = document.querySelector('moov-form');
          const ssn = document.getElementById('ssn');
          const dob = document.getElementById('dob');
          const save = document.getElementById('save');

          // Token setup
          try {
            const r = await fetch('https://vybelocal-waitlist.vercel.app/api/payments/moov/token',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({}) });
            const j = await r.json();
            if (j && j.access_token) { form.requestHeaders = { 'content-type':'application/json', 'Authorization': 'Bearer ' + j.access_token }; }
          } catch(_){ }

          // Nuclear approach: Continuous value monitoring and correction
          function attachShadowMasked(host, cfg){
            if (!host || host.__masked) return; 
            host.__masked = true;
            const maxDigits = cfg.maxDigits || 9;
            const groups = cfg.groups || [3,2,4];
            const sep = cfg.sep || '-';
            console.log('[MASK] Setting up NUCLEAR masking for', host.id, 'maxDigits:', maxDigits);

            const formatDigits = (raw)=>{
              const d = String(raw||'').replace(/[^0-9]/g,'').slice(0, maxDigits);
              if (!groups.length) return d;
              let i=0, out='';
              for (const g of groups){ 
                const chunk=d.slice(i, i+g); 
                if (!chunk) break; 
                out += (out?sep:'') + chunk; 
                i += g; 
              }
              return out;
            };

            const getAllInputs = ()=>{
              const inputs = [];
              // Try multiple ways to get the input
              try { 
                const shadow = host.shadowRoot && host.shadowRoot.querySelector('input');
                if (shadow) inputs.push(shadow);
              } catch(_){}
              
              try {
                const direct = host.querySelector && host.querySelector('input');
                if (direct) inputs.push(direct);
              } catch(_){}
              
              try {
                if (host.value !== undefined) inputs.push(host); // host itself might be input-like
              } catch(_){}
              
              return [...new Set(inputs)]; // dedupe
            };

            const correctValue = ()=>{
              const inputs = getAllInputs();
              inputs.forEach(input => {
                try {
                  const current = input.value || '';
                  const digits = current.replace(/[^0-9]/g, '');
                  if (digits.length > maxDigits || /[^0-9-]/.test(current)) {
                    const corrected = formatDigits(digits);
                    if (corrected !== current) {
                      console.log('[MASK] Correcting', host.id, 'from:', current, 'to:', corrected);
                      input.value = corrected;
                      // Trigger input event to notify Moov
                      input.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                  }
                } catch(e) {
                  console.log('[MASK] Error correcting value:', e);
                }
              });
            };

            // Approach 1: Continuous polling (brute force)
            const pollInterval = setInterval(correctValue, 50); // Check every 50ms
            setTimeout(() => clearInterval(pollInterval), 30000); // Stop after 30s

            // Approach 2: Event capture on host and document
            const captureEvents = ['keydown', 'keyup', 'input', 'beforeinput', 'paste'];
            captureEvents.forEach(eventType => {
              host.addEventListener(eventType, (e) => {
                if (e.key && e.key.length === 1 && !/[0-9]/.test(e.key)) {
                  console.log('[MASK] Blocking', eventType, e.key);
                  e.preventDefault();
                  e.stopPropagation();
                  e.stopImmediatePropagation();
                }
                setTimeout(correctValue, 0); // Correct after event
              }, { capture: true, passive: false });

              document.addEventListener(eventType, (e) => {
                if (e.target === host || (e.composedPath && e.composedPath().includes(host))) {
                  setTimeout(correctValue, 0);
                }
              }, { capture: true, passive: true });
            });

            // Approach 3: MutationObserver on host and shadow
            try {
              const observer = new MutationObserver(() => correctValue());
              observer.observe(host, { attributes: true, childList: true, subtree: true });
              
              const checkShadow = () => {
                try {
                  if (host.shadowRoot) {
                    observer.observe(host.shadowRoot, { attributes: true, childList: true, subtree: true });
                    return true;
                  }
                } catch(_) {}
                return false;
              };
              
              if (!checkShadow()) {
                // Retry shadow observation
                let shadowAttempts = 0;
                const retryShadow = () => {
                  if (checkShadow() || shadowAttempts++ > 20) return;
                  setTimeout(retryShadow, 100);
                };
                setTimeout(retryShadow, 100);
              }
            } catch(e) {
              console.log('[MASK] MutationObserver setup failed:', e);
            }

            // Approach 4: Focus/blur formatting
            host.addEventListener('focus', () => setTimeout(correctValue, 0), true);
            host.addEventListener('blur', () => setTimeout(correctValue, 0), true);

            console.log('[MASK] Nuclear masking setup complete for', host.id);
          }

          // Apply masking to SSN (###-##-####) and DOB (YYYY-MM-DD)
          attachShadowMasked(ssn, { maxDigits: 9, groups:[3,2,4], sep:'-' });
          attachShadowMasked(dob, { maxDigits: 8, groups:[4,2,2], sep:'-' });

          save.addEventListener('click', ()=>{
            const getShadowValue = (el)=>{
              try { 
                const input = el.shadowRoot && el.shadowRoot.querySelector('input');
                return input ? input.value : el.value || '';
              } catch(_){ 
                return el.value || ''; 
              }
            };

            const ssnVal = getShadowValue(ssn);
            const dobVal = getShadowValue(dob);
            const ssnDigits = ssnVal.replace(/\\D/g,'');
            
            if (ssnDigits.length !== 9) { alert('Enter a 9-digit SSN'); return; }
            if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(dobVal)) { alert('DOB must be YYYY-MM-DD'); return; }
            
            post('poc:submit', { ssn: ssnDigits, dob: dobVal });
          });
        })();
      </script>
    </body>
  </html>`;

  const toE164US = (input) => {
    try {
      const digits = String(input || '').replace(/\D/g, '');
      if (!digits) return null;
      if (digits.startsWith('1') && digits.length === 11) return `+${digits}`;
      if (digits.length === 10) return `+1${digits}`;
      // If already has + prefix or other country code digits, best effort
      if (String(input || '').trim().startsWith('+')) return String(input).trim();
      return `+${digits}`;
    } catch {
      return null;
    }
  };

  const mccToDescription = (mcc) => {
    const code = String(mcc || '').trim();
    if (code === '7922') return 'Ticketed shows and events (admission via VybeLocal)';
    if (code === '5812' || code === '5814') return 'Food and beverage events (pop-ups, tastings) hosted via VybeLocal';
    return 'Local classes and community events hosted via VybeLocal';
  };

  // Prefill data for PII WebView (individual pipeline)
  const prefillFirstName = React.useMemo(() => {
    const base = profile?.name || user?.user_metadata?.full_name || user?.email || 'Vybe User';
    const parts = String(base).trim().split(/\s+/);
    return parts[0] || 'Vybe';
  }, [profile?.name, user?.user_metadata?.full_name, user?.email]);

  const prefillLastName = React.useMemo(() => {
    const base = profile?.name || user?.user_metadata?.full_name || user?.email || 'User';
    const parts = String(base).trim().split(/\s+/);
    return parts.slice(-1)[0] || 'User';
  }, [profile?.name, user?.user_metadata?.full_name, user?.email]);

  const prefillPhone = React.useMemo(() => {
    const raw = supportPhone || profile?.phone || user?.user_metadata?.phone || null;
    return toE164US(raw);
  }, [supportPhone, profile?.phone, user?.user_metadata?.phone]);

  const prefill = React.useMemo(() => ({
    firstName: prefillFirstName,
    lastName: prefillLastName,
    email: supportEmail || user?.email || null,
    phone: prefillPhone || null,
    address: { line1: addr1 || '', line2: (addr2 || null), city: city || '', state: state || '', postal: postal || '' }
  }), [prefillFirstName, prefillLastName, supportEmail, user?.email, prefillPhone, addr1, addr2, city, state, postal]);

  const submitIndividual = async () => {
    try {
      // Validate address fields before proceeding to sensitive step (accept full state names)
      const streetOk = !!(addr1 && addr1.trim());
      const cityOk = !!(city && city.trim());
      const stateOk = !!(state && String(state).trim());
      const zipOk = /^\d{5}(-\d{4})?$/.test(String(postal||'').trim());
      if (!streetOk || !cityOk || !stateOk || !zipOk) {
        Alert.alert('Address required', 'Enter street, city, state, and 5‑digit ZIP.');
        return;
      }

      const rawPhone = supportPhone || profile?.phone || user?.user_metadata?.phone || null;
      const legal_entity = {
        mcc: spMcc,
        region: 'US',
        address: {
          street: addr1 || draft.principal?.line1 || '',
          street2: addr2 || draft.principal?.line2 || null,
          city: city || draft.principal?.city || '',
          state: state || draft.principal?.state || '',
          postal_code: postal || draft.principal?.postal_code || '',
          country: 'US'
        },
        website: 'https://vybelocal.com/policies',
        is_501c3: false,
        structure: 'sole_proprietorship',
        legal_name: (profile?.name || user?.user_metadata?.full_name || user?.email || 'VybeLocal User'),
        principals: [
          {
            email: supportEmail || user?.email,
            phone: toE164US(rawPhone),
            address: {
              street: addr1 || draft.principal?.line1 || '',
              street2: addr2 || draft.principal?.line2 || null,
              city: city || draft.principal?.city || '',
              state: state || draft.principal?.state || '',
              postal_code: postal || draft.principal?.postal_code || '',
              country: 'US'
            },
            id_number: null,
            job_title: 'owner',
            last_name: (profile?.name?.split?.(' ')?.slice(-1)[0] || 'User'),
            first_name: (profile?.name?.split?.(' ')?.[0] || 'Vybe'),
            is_applicant: true,
            date_of_birth: null,
            is_control_prong: true,
            previous_address: null,
            percent_ownership: 100
          }
        ],
        bank_account: null,
        support_email: (user?.email || null),
        support_phone: (profile?.phone || null),
        tax_id_number: null,
        charity_document: null,
        // Use server-aligned defaults for sole props
        processing_volume: {
          currency: 'usd',
          high_ticket_amount: 50 * 100,
          monthly_processing_volume: 500 * 100,
          monthly_transaction_count: 50,
          average_transaction_amount_card: 25 * 100,
          average_transaction_amount_debit: 25 * 100
        },
        number_of_terminals: null,
        patriot_act_details: {
          business_license: null,
          articles_of_incorporation: null
        },
        product_description: mccToDescription(spMcc),
        statement_descriptor: 'VYBELOCAL*EVENT',
        date_of_incorporation: null,
        existing_processor_name: 'None',
        percent_business_to_business: 0,
        days_billed_prior_to_shipment: 0,
        card_checkout_method_breakdown: {
          percent_swiped: 0,
          percent_e_commerce: 100,
          percent_manual_card_not_present: 0
        }
      };

      // Store base (non-sensitive) data and move user forward immediately to Step 4 (PII)
      setBaseLegal(legal_entity);
      if (!bankHolder) setBankHolder(legal_entity?.legal_name || profile?.name || user?.email || 'VybeLocal User');
      setIdemKey(`onboard_${user.id}_${Date.now()}`);
      animateTo(4, 1);

      // Ensure Moov account exists (idempotent)
      setTimeout(async () => {
      try {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token || null;
          const headers = token
            ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
            : { 'Content-Type': 'application/json' };
        const presetRes = await fetch(`${API_BASE_URL}/api/payments/moov/preset`, {
          method: 'POST',
            headers,
          body: JSON.stringify({ mcc: spMcc, type: 'individual' })
        });
        const presetTxt = await presetRes.text();
        let presetJson; try { presetJson = JSON.parse(presetTxt); } catch { presetJson = {}; }
          if (presetRes.ok && presetJson?.moov_account_id) {
        setMoovAccountId(presetJson.moov_account_id);
          } else {
            try { console.warn('[KYB] preset failed', presetRes.status, presetTxt?.slice?.(0,200)); } catch {}
          }
      } catch (e) {
          try { console.warn('[KYB] preset error', e?.message || String(e)); } catch {}
        }
      }, 0);
    } catch (e) {
      Alert.alert('Error', e?.message || 'Onboarding failed');
    }
  };

  const finalizeIndividual = async () => {
    try {
      setIsSubmitting(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { Alert.alert('Please sign in'); return; }
      // Ensure we have a Moov accountId before submitting PII
      if (!moovAccountId) {
        try {
          const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
          const presetRes = await fetch(`${API_BASE_URL}/api/payments/moov/preset`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ mcc: spMcc, type: 'individual' })
          });
          const presetTxt = await presetRes.text();
          let presetJson; try { presetJson = JSON.parse(presetTxt); } catch { presetJson = {}; }
          if (presetRes.ok && presetJson?.moov_account_id) {
            setMoovAccountId(presetJson.moov_account_id);
          }
        } catch {}
        if (!moovAccountId) {
          Alert.alert('Preparing account', 'We\'re setting up your Moov account. Please try again in a few seconds.');
          setIsSubmitting(false);
          return;
        }
      }
      // Basic client validation
      const ssnDigits = String(ssn || '').replace(/\D/g, '');
      if (ssnDigits.length !== 9) { Alert.alert('SSN required', 'Enter a 9‑digit SSN.'); return; }
      if (!/^\d{2}-\d{2}-\d{4}$/.test(dobUs)) { Alert.alert('DOB format', 'Use MM‑DD‑YYYY.'); return; }
      // Bank details collected in Step 5; skip bank validations here
      if (!agreed) { Alert.alert('Agreement required', 'Please agree to the Terms before submitting.'); return; }

      const toIsoFromUS = (mmddyyyy) => {
        const d = String(mmddyyyy||'').replace(/[^\d]/g,'');
        const mm = d.slice(0,2), dd = d.slice(2,4), yyyy = d.slice(4,8);
        return `${yyyy}-${mm}-${dd}`;
      };

      // Merge sensitive fields into payload
      const merged = JSON.parse(JSON.stringify(baseLegal || {}));
      merged.product_description = mccToDescription(merged.mcc || spMcc);
      if (Array.isArray(merged.principals) && merged.principals[0]) {
        merged.principals[0].id_number = ssnDigits;
        merged.principals[0].date_of_birth = toIsoFromUS(dobUs);
      }
      // FEIN for sole prop: copy SSN as tax_id_number when provided
      merged.tax_id_number = ssnDigits;
      // Ensure processing volume uses our fixed defaults (avoid UI confusion)
      merged.processing_volume = {
        currency: 'usd',
        high_ticket_amount: 50 * 100,
        monthly_processing_volume: 500 * 100,
        monthly_transaction_count: 50,
        average_transaction_amount_card: 25 * 100,
        average_transaction_amount_debit: 25 * 100,
      };

      // Bank account not included here; handled via payment methods step

      // Create Moov representative with PII data - MATCH SDK STRUCTURE EXACTLY
      const dobIso = toIsoFromUS(dobUs); // YYYY-MM-DD
      const [year, month, day] = dobIso.split('-').map(n => parseInt(n));
      
      const moovRepPayload = {
        name: { 
          firstName: baseLegal?.principals?.[0]?.first_name || 'Vybe', 
          lastName: baseLegal?.principals?.[0]?.last_name || 'User' 
        },
        email: baseLegal?.principals?.[0]?.email || user?.email || null,
        phone: baseLegal?.principals?.[0]?.phone || null,
        address: {
          addressLine1: baseLegal?.address?.street || '',
          addressLine2: baseLegal?.address?.street2 || null,
          city: baseLegal?.address?.city || '',
          stateOrProvince: baseLegal?.address?.state || '',
          postalCode: baseLegal?.address?.postal_code || '',
          country: 'US'
        },
        birthDate: { year, month, day },
        governmentID: { ssn: { full: ssnDigits } },
        responsibilities: {
          jobTitle: 'owner',
          ownershipPercentage: 100,
          isController: true,
          isOwner: true
        }
      };

      const res = await fetch(`${API_BASE_URL}/api/payments/moov/individual`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-idempotency-key': idemKey || `onboard_${user.id}_${Date.now()}`,
        },
        body: JSON.stringify({ 
          accountId: moovAccountId,
          representative: moovRepPayload
        })
      });
      const text = await res.text();
      // Show payload back in dev for verification
      if (__DEV__) {
        try { 
          const maskedPayload = {
            accountId: moovAccountId,
            representative: { ...moovRepPayload, governmentID: '***MASKED***' }
          };
          console.log('[KYB][client] submitted MOOV payload:', JSON.stringify(maskedPayload, null, 2)); 
        } catch {}
      }
      let json; try { json = JSON.parse(text); } catch { json = {}; }
      if (!res.ok) { Alert.alert('Error', json?.error || 'Onboarding failed'); return; }
      // Success: continue to payment method linking
      animateTo(5, 1);
    } catch (e) {
      Alert.alert('Error', e?.message || 'Onboarding failed');
    } finally { setIsSubmitting(false); }
  };

  const animateTo = (nextStep, dir) => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: ANIM_MS, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
      Animated.timing(slide, { toValue: dir, duration: ANIM_MS, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
    ]).start(() => {
      slide.setValue(-dir);
      setStep(nextStep);
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: ANIM_MS, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
        Animated.timing(slide, { toValue: 0, duration: ANIM_MS, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
      ]).start();
    });
  };

  const getTosToken = async () => {
    setCreatingAccount(true);
    try {
      // Get TOS token for Moov onboarding
      const tokenRes = await fetch('https://vybelocal.com/api/payments/moov/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      if (!tokenRes.ok) {
        Alert.alert('Error', 'Unable to get authorization token');
        return;
      }
      
      const tokenData = await tokenRes.json();
      const authToken = tokenData.access_token;
      
      // Get TOS token from Moov
      const tosRes = await fetch('https://api.moov.io/tos-token', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      if (!tosRes.ok) {
        Alert.alert('Error', 'Unable to get terms of service');
        return;
      }
      
      const tosData = await tosRes.json();
      setTosToken(tosData.token);
      
      // Proceed to onboarding with TOS token ready
      animateTo(1, 1);
    } catch (e) {
      Alert.alert('Error', e?.message || 'Unable to start onboarding');
    } finally {
      setCreatingAccount(false);
    }
  };

  React.useEffect(() => {
    if (step !== 1) return;
    ph1.setValue(0); ph2.setValue(0); ph3.setValue(0);
    Animated.stagger(80, [
      Animated.timing(ph1, { toValue: 1, duration: ANIM_MS, useNativeDriver: true }),
      Animated.timing(ph2, { toValue: 1, duration: ANIM_MS, useNativeDriver: true }),
      Animated.timing(ph3, { toValue: 1, duration: ANIM_MS, useNativeDriver: true }),
    ]).start();
  }, [step, ph1, ph2, ph3]);

  const CARD_W = Math.min(320, SCREEN_WIDTH - 64);
  const CARD_H = 160;
  const overlapPad = 24;
  const topOffsets = { tl: 0, mr: CARD_H - overlapPad, bl: 2 * (CARD_H - overlapPad) };

  const renderPlaceholders = () => {
    const items = bizType === 'llc'
      ? [
          { key:'dj', label:'Bar Night / DJ Event', pos:'tl', col:'#111827' },
          { key:'food', label:'Food Truck Pop-Up', pos:'mr', col:'#0B1220' },
          { key:'openmic', label:'Coffee Shop Open Mic', pos:'bl', col:'#1F2937' },
        ]
      : bizType === '501c3'
      ? [
          { key:'fundraiser', label:'Charity Fundraiser', pos:'tl', col:'#059669' },
          { key:'volunteer', label:'Volunteer Drive', pos:'mr', col:'#0B1220' },
          { key:'community', label:'Community Meetup', pos:'bl', col:'#1F2937' },
        ]
      : [
          { key:'yoga', label:'Yoga in the Park', pos:'tl', col:'#0B1220' },
          { key:'fitness', label:'Run Group or Bootcamp', pos:'mr', col:'#111827' },
          { key:'workshop', label:'Creative Pop-Up', pos:'bl', col:'#1F2937' },
        ];
    const mats = [ph1, ph2, ph3];
    const cardStyle = (i, pos) => ({
      position:'absolute', width:CARD_W, height:CARD_H, borderRadius:14, borderWidth:1, borderColor:'#374151', padding:12,
      opacity: mats[i], transform:[{ translateY: mats[i].interpolate({ inputRange:[0,1], outputRange:[12,0] }) }],
      ...(pos==='tl' ? { top: topOffsets.tl, left: 0 } : {}),
      ...(pos==='mr' ? { top: topOffsets.mr, right: 0 } : {}),
      ...(pos==='bl' ? { top: topOffsets.bl, left: 0 } : {}),
    });
    return (
      <View style={{ height: topOffsets.bl + CARD_H + 8, marginBottom: 12 }}>
        {items.map((it, i) => (
          <Animated.View key={it.key} style={[cardStyle(i, it.pos), { backgroundColor: it.col }] }>
            <Text style={{ color:'#fff', fontWeight:'800', marginBottom:6 }}>{it.label}</Text>
            <Text style={{ color:'#E5E7EB', fontSize:12 }}>Soon you can host things like this on VybeLocal.</Text>
          </Animated.View>
        ))}
      </View>
    );
  };

  const getSubclassOptions = () => {
    if (bizClass === 'events_promotions') {
      return [
        { key: 'promoter_ticket', mcc: '7922', title: 'Event promoter or ticket agency', d1: 'Live events, ticketed shows, or cultural gatherings where you run the door.', d2: 'Great for venue operators, booking teams, and independent promoters.' },
        { key: 'talent_collective', mcc: '7922', title: 'Performance or talent collective', d1: 'Touring acts, entertainment groups, or businesses that manage artists or performers.', d2: 'Ideal for production companies, booking agencies, and performance brands.' },
        { key: 'nightlife_venue', mcc: '5812', title: 'Bar, club, or nightlife venue', d1: 'Brick-and-mortar spaces where people come to drink, dance, and gather after dark.', d2: 'Best for bar owners, club managers, or hospitality businesses hosting events.' },
      ];
    }
    if (bizClass === 'food_beverage') {
      return [
        { key: 'restaurant_cafe', mcc: '5812', title: 'Restaurant, café, or dining space', d1: 'A permanent space serving meals, drinks, or snacks to the public.', d2: 'Perfect for restaurant owners, coffee shop operators, or food-focused venues.' },
        { key: 'mobile_food', mcc: '5499', title: 'Mobile food vendor', d1: 'Food trucks, street vendors, caterers, or pop-ups without a storefront.', d2: 'Made for mobile food businesses serving events, markets, or rotating locations.' },
      ];
    }
    if (bizClass === 'fitness_wellness') {
      return [
        { key: 'gym_fitness', mcc: '7999', title: 'Gym or fitness studio', d1: 'Brick-and-mortar spaces offering training, group fitness, or membership programs.', d2: 'Great for studio owners, gym operators, or team-based fitness brands.' },
        { key: 'sports_rec', mcc: '7999', title: 'Sports or rec organization', d1: 'Clubs, leagues, or programs built around movement, competition, or group activity.', d2: 'Ideal for athletic orgs, run clubs, or community rec leaders.' },
        { key: 'wellness_therapeutic', mcc: '8099', title: 'Wellness or therapeutic space', d1: 'Services or studios focused on healing, alignment, or holistic health.', d2: 'Built for licensed wellness businesses — yoga, bodywork, or health services.' },
      ];
    }
    if (bizClass === 'arts_education') {
      return [
        { key: 'gallery_exhibit', mcc: '8299', title: 'Art gallery or exhibit space', d1: 'A curated space for visual art, installations, or cultural exhibitions.', d2: 'Best for gallery owners, curators, or arts orgs with a physical presence.' },
        { key: 'workshop_learning', mcc: '8299', title: 'Workshop or creative learning', d1: 'Skill-sharing spaces offering classes, lectures, or hands-on creative sessions.', d2: 'Great for makerspaces, instructors, and experience-based businesses.' },
      ];
    }
    return [];
  };

  const normalizeUrl = (val) => {
    const v = String(val||'').trim();
    if (!v) return '';
    if (/^https?:\/\//i.test(v)) return v;
    return `https://${v}`;
  };

  const isBizContactValid = React.useMemo(() => {
    const urlOk = !!normalizeUrl(bizWebsite);
    const emailOk = /.+@.+\..+/.test(String(bizSupportEmail||''));
    const phoneDigits = String(bizSupportPhone||'').replace(/\D/g,'');
    const phoneOk = /^\d{9,10}$/.test(phoneDigits);
    return urlOk && emailOk && phoneOk;
  }, [bizWebsite, bizSupportEmail, bizSupportPhone]);

  // Representative draft (business: role + ownership; charity: controller 0%)
  const [cpTitle, setCpTitle] = React.useState('owner');
  const [cpOwnership, setCpOwnership] = React.useState('0');
  const [principals, setPrincipals] = React.useState([]); // {first,last,title,ownership,ssn,dob,address}
  const resetCpDraft = () => { setCpFirstName(''); setCpLastName(''); setCpTitle('owner'); setCpOwnership('0'); setSsn(''); setDobUs(''); };

  return (
    <LinearGradient colors={['rgba(59,130,246,0.18)', 'rgba(14,165,233,0.18)']} style={{ flex: 1 }} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>        
        <AppHeader />
        <ScrollView contentContainerStyle={{ padding:16, flexGrow:1, justifyContent:'center' }}>
          <View style={{ alignItems:'center' }}>
            <View style={{ width:'100%', maxWidth:420 }}>
          <Animated.View style={{ opacity: fade, transform: [{ translateX: slide.interpolate({ inputRange:[-1,0,1], outputRange:[-24,0,24] }) }] }}>
            {step === 0 && (
              <View>
          <View style={{ backgroundColor:'#fff', borderRadius:16, padding:16, borderWidth:1, borderColor:'#E0E7FF', marginBottom:24 }}>
            <Text style={{ fontSize:22, fontWeight:'800', marginBottom:6 }}>Let's lock in your payouts</Text>
            <Text style={{ color:'#111827' }}>It only takes a minute. You keep every dollar — guests cover a tiny fee.</Text>
          </View>
                <View style={{ backgroundColor:'#0B1220', borderRadius:16, padding:16, marginBottom:16 }}>
            <Text style={{ color:'#fff', fontWeight:'800', marginBottom:8 }}>Before we hit go…</Text>
                  {['Legal name (or business name)','SSN or EIN','Business address and support contact','Bank account & routing','DOB & residential address'].map((item, idx)=> (
              <View key={idx} style={{ flexDirection:'row', alignItems:'center', marginBottom:6 }}>
                <Ionicons name="checkmark-circle" size={18} color="#60A5FA" style={{ marginRight:8 }} />
                <Text style={{ color:'#E5E7EB' }}>{item}</Text>
              </View>
            ))}
          </View>
                <View style={{ borderRadius:12, overflow:'hidden', borderWidth:1, borderColor:'#E5E7EB' }}>
                  <WebView 
                    style={{ height:200, backgroundColor:'#fff' }}
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                    startInLoadingState={true}
                    originWhitelist={['*']}
                    source={{ 
                      html: `<!doctype html><html><head>
                        <meta charset='utf-8'/>
                        <meta name='viewport' content='width=device-width, initial-scale=1'/>
                        <script src='https://js.moov.io/v1'></script>
                        <style>
                          body{font-family:system-ui;margin:0;padding:8px;background:#fff;min-height:180px}
                          moov-terms-of-service{display:block;width:100%;min-height:160px;font-size:14px;line-height:1.5;text-align:center}
                          .loading{text-align:center;padding:60px 0;color:#6B7280}
                          moov-terms-of-service p{margin:0 0 8px;word-wrap:break-word;hyphens:auto;text-align:center}
                          moov-terms-of-service a{word-wrap:break-word}
                        </style></head><body>
                         <div class='loading'>Loading terms...</div>
                         <moov-terms-of-service id='tos'></moov-terms-of-service>
                        <script>(async function(){
                          function log(){try{if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(JSON.stringify({type:'log',args:[...arguments]}));}}catch(e){} try{console.log.apply(console,arguments);}catch(e){}}
                          const tos=document.querySelector('moov-terms-of-service');
                          const loading=document.querySelector('.loading');
                          try{
                            log('Fetching Moov token...');
                            const r=await fetch('https://vybelocal-waitlist.vercel.app/api/payments/moov/token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({})});
                            if(!r.ok){log('Token fetch failed:',r.status,r.statusText);return;}
                            const j=await r.json();
                            log('Token received:', j.access_token ? 'yes' : 'no');
                            if(!j.access_token){log('No access token in response:', j);return;}
                            tos.token=j.access_token; tos.textColor='rgb(17,24,39)'; tos.linkColor='rgb(37,99,235)'; tos.backgroundColor='rgb(255,255,255)'; tos.fontSize='14px';
                            tos.onTermsOfServiceTokenReady=(token)=>{ log('TOS token ready!'); loading.style.display='none'; if(window.ReactNativeWebView){ window.ReactNativeWebView.postMessage(JSON.stringify({type:'tos:ready', tosToken: token})); } };
                            tos.onTermsOfServiceTokenError=(error)=>{ log('TOS error:', error); };
                          }catch(e){ log('TOS setup error:', e.message||e.toString(), e.stack); }
                        })();</script>
                        </body></html>`,
                      baseUrl: 'https://vybelocal.com'
                    }}
                    onMessage={(e) => {
                      try {
                        const msg = JSON.parse(e.nativeEvent.data);
                        if (msg.type === 'tos:ready') { setTosToken(msg.tosToken); }
                      } catch {}
                    }}
                    onError={(e) => console.log('WebView error:', e)}
                    onLoadEnd={() => console.log('WebView loaded')}
                  />
                </View>
                <TouchableOpacity 
                  onPress={() => animateTo(1, 1)} 
                  disabled={!tosToken}
                  style={{ backgroundColor: tosToken ? '#3B82F6' : '#9CA3AF', borderRadius:12, paddingVertical:14, alignItems:'center', marginTop:12 }}
                >
                  <Text style={{ color:'#fff', fontWeight:'700' }}>
                    {tosToken ? 'Continue' : 'Accept terms above'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>

          {step === 1 && (
            <Animated.View style={{ opacity: fade, transform: [{ translateX: slide.interpolate({ inputRange:[-1,0,1], outputRange:[-24,0,24] }) }] }}>
              <View style={{ backgroundColor:'#fff', borderRadius:16, padding:16, borderWidth:1, borderColor:'#E0E7FF', marginBottom:12 }}>
                <Text style={{ fontSize:20, fontWeight:'800', marginBottom:8 }}>Are you an individual or a business?</Text>
                <Text style={{ color:'#4B5563' }}>Pick one to tailor the questions. You can switch later.</Text>
              </View>
              <View style={{ marginBottom:12 }}>
                <TouchableOpacity onPress={()=>{
                  if (!showOptions) {
                    setSelectorOpen(true);
                    Animated.timing(dropdownSpacer, { toValue: OPTIONS_HEIGHT, duration: ANIM_MS, useNativeDriver: false, easing: Easing.out(Easing.quad) }).start(() => {
                      setShowOptions(true);
                      dropdownOpacity.setValue(0);
                      Animated.timing(dropdownOpacity, { toValue: 1, duration: ANIM_MS, useNativeDriver: true }).start();
                    });
                  } else {
                    Animated.timing(dropdownOpacity, { toValue: 0, duration: ANIM_MS, useNativeDriver: true }).start(() => {
                      setShowOptions(false);
                      Animated.timing(dropdownSpacer, { toValue: 0, duration: ANIM_MS, useNativeDriver: false, easing: Easing.out(Easing.quad) }).start(() => setSelectorOpen(false));
                    });
                  }
                }} style={{ paddingVertical:14, paddingHorizontal:12, borderRadius:12, borderWidth:2, borderColor:'#E5E7EB', backgroundColor:'#fff', flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
                  <Text style={{ fontWeight:'800', color:'#111827' }}>
                    {bizType==='sp' ? "I'm an individual" : bizType==='llc' ? 'I have a business' : "I'm a 501c3 charitable foundation"}
                  </Text>
                  <Ionicons name={(selectorOpen||showOptions) ? 'chevron-up' : 'chevron-down'} size={18} color="#6B7280" />
                </TouchableOpacity>
                <View style={{ position:'relative' }}>
                  <Animated.View style={{ height: dropdownSpacer }} />
                  {showOptions && (
                    <Animated.View style={{ position:'absolute', top:0, left:0, right:0, opacity: dropdownOpacity }}>
                      <View style={{ marginTop:8, borderWidth:1, borderColor:'#E5E7EB', borderRadius:12, backgroundColor:'#fff' }}>
                        {[
                          { key:'sp', label:"I'm an individual" },
                          { key:'llc', label:'I have a business' },
                          { key:'501c3', label:"I'm a 501c3 charitable foundation" },
                        ].map((opt, idx)=> (
                          <TouchableOpacity key={opt.key} onPress={()=>{
                            setBizType(opt.key); updateDraft({ bizType: opt.key });
                            if (opt.key === '501c3') {
                              setBizMcc('8398');
                              setMccSelected(true);
                            }
                            Animated.timing(dropdownOpacity, { toValue: 0, duration: ANIM_MS, useNativeDriver: true }).start(() => {
                              setShowOptions(false);
                              Animated.timing(dropdownSpacer, { toValue: 0, duration: ANIM_MS, useNativeDriver: false, easing: Easing.out(Easing.quad) }).start(() => setSelectorOpen(false));
                            });
                          }} style={{ paddingVertical:14, paddingHorizontal:12, borderBottomWidth: idx<2 ? 1 : 0, borderColor:'#F3F4F6' }}>
                            <Text style={{ fontWeight: bizType===opt.key ? '800' : '600', color:'#111827' }}>{opt.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </Animated.View>
                  )}
                </View>
              </View>
              {renderPlaceholders()}
            </Animated.View>
          )}

          
          {step === 3 && bizType === 'sp' && (
            <Animated.View style={{ opacity: fade, transform: [{ translateX: slide.interpolate({ inputRange:[-1,0,1], outputRange:[-24,0,24] }) }] , marginTop:0, marginBottom:24, backgroundColor:'#fff', borderRadius:16, padding:16, borderWidth:1, borderColor:'#E0E7FF' }}>
              <Text style={{ fontSize:20, fontWeight:'800', marginBottom:8 }}>Your address</Text>
              <View style={{ marginBottom:8 }}>
                <AddressAutocomplete
                  value={addr1}
                  onChangeText={setAddr1}
                  onSelect={({ line1, city, state, postal }) => { setAddr1(line1||''); setCity(city||''); setState(state||''); setPostal(postal||''); }}
                />
              </View>
              <TextInput value={addr2} onChangeText={setAddr2} placeholder="Address line 2 (optional)" style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:12, paddingVertical:10, marginBottom:8 }} />
              <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
                <TextInput value={city} onChangeText={setCity} placeholder="City" style={{ width:'48%', borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:12, paddingVertical:10 }} />
                <TextInput value={state} onChangeText={setState} placeholder="State" style={{ width:'48%', borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:12, paddingVertical:10 }} />
              </View>
              <TextInput value={postal} onChangeText={setPostal} placeholder="Postal code" keyboardType="number-pad" style={{ marginTop:8, borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:12, paddingVertical:10 }} />
              {/* moved ToS checkbox to Step 4 */}
              <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:16 }}>
                <TouchableOpacity onPress={()=>animateTo(2, -1)} style={{ width:'48%', backgroundColor:'#E5E7EB', borderRadius:12, paddingVertical:12, alignItems:'center' }}>
                  <Text style={{ color:'#111827', fontWeight:'700' }}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={()=>{ updateDraft({ principal: { line1: addr1, line2: addr2, city, state, postal_code: postal } }); submitIndividual(); }} style={{ width:'48%', backgroundColor:'#3B82F6', borderRadius:12, paddingVertical:12, alignItems:'center' }}>
                  <Text style={{ color:'#fff', fontWeight:'700' }}>Next</Text>
                  </TouchableOpacity>
              </View>
            </Animated.View>
          )}
          {step === 3 && bizType === 'llc' && (
            <Animated.View style={{ opacity: fade, transform: [{ translateX: slide.interpolate({ inputRange:[-1,0,1], outputRange:[-24,0,24] }) }] , marginTop:0, marginBottom:24, backgroundColor:'#fff', borderRadius:16, padding:16, borderWidth:1, borderColor:'#E0E7FF' }}>
              <Text style={{ fontSize:20, fontWeight:'800', marginBottom:8 }}>Pick your specific business type</Text>
              <Text style={{ color:'#4B5563', marginBottom:12 }}>This helps us match the right MCC for your business.</Text>
              <View style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:12, backgroundColor:'#fff' }}>
                {getSubclassOptions().map((opt, idx) => (
                  <TouchableOpacity key={opt.key || `${opt.mcc}_${idx}` } onPress={()=>{ setBizMcc(opt.mcc); setBizSubclass(opt.key || `${opt.mcc}_${idx}`); setBizMccSelected(true); updateDraft({ bizMcc: opt.mcc, bizSubclass: (opt.key || `${opt.mcc}_${idx}`) }); }} style={{ padding:14, borderBottomWidth: idx<getSubclassOptions().length-1 ? 1 : 0, borderColor:'#F3F4F6' }}>
                    <View style={{ flexDirection:'row', alignItems:'center', marginBottom:6 }}>
                      <View style={{ width:22, height:22, borderRadius:11, borderWidth:2, borderColor: (bizSubclass === (opt.key || `${opt.mcc}_${idx}`)) ? '#3B82F6' : '#9CA3AF', alignItems:'center', justifyContent:'center', marginRight:10 }}>
                        {(bizSubclass === (opt.key || `${opt.mcc}_${idx}`)) && <View style={{ width:10, height:10, borderRadius:5, backgroundColor:'#3B82F6' }} />}
                      </View>
                      <Text style={{ fontWeight:'800', color:'#111827' }}>{opt.title}</Text>
                    </View>
                    <Text style={{ color:'#4B5563' }}>{opt.d1}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:16 }}>
                <TouchableOpacity onPress={()=>animateTo(2, -1)} style={{ width:'48%', backgroundColor:'#E5E7EB', borderRadius:12, paddingVertical:12, alignItems:'center' }}>
                  <Text style={{ color:'#111827', fontWeight:'700' }}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={()=>{ if (!bizMccSelected) { Alert.alert('Choose one', 'Please select a subclass to continue.'); return; } animateTo(4, 1); }} style={{ width:'48%', backgroundColor: bizMccSelected ? '#3B82F6' : '#9CA3AF', borderRadius:12, paddingVertical:12, alignItems:'center' }}>
                  <Text style={{ color:'#fff', fontWeight:'700' }}>Next</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}
          {step === 4 && (bizType === 'llc' || bizType === '501c3') && (
            <Animated.View style={{ opacity: fade, transform: [{ translateX: slide.interpolate({ inputRange:[-1,0,1], outputRange:[-24,0,24] }) }] , marginTop:0, marginBottom:24, backgroundColor:'#fff', borderRadius:16, padding:16, borderWidth:1, borderColor:'#E0E7FF' }}>
              <Text style={{ fontSize:20, fontWeight:'800', marginBottom:8 }}>Business details</Text>
              <View style={{ marginBottom:8 }}>
                <Text style={{ fontWeight:'700', color:'#111827', marginBottom:6 }}>Legal business name</Text>
                <TextInput value={bizLegalName} onChangeText={setBizLegalName} placeholder="Your LLC legal name" style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:12, paddingVertical:10 }} />
              </View>
              <View style={{ marginBottom:8 }}>
                <Text style={{ fontWeight:'700', color:'#111827', marginBottom:6 }}>EIN</Text>
                <TextInput value={(function(){ const d=String(bizEin||'').replace(/\D/g,'').slice(0,9); const a=d.slice(0,2), b=d.slice(2,9); return [a,b].filter(Boolean).join('-'); })()} onChangeText={(t)=>setBizEin(String(t||'').replace(/\D/g,'').slice(0,9))} placeholder="12-3456789" keyboardType="number-pad" maxLength={10} style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:12, paddingVertical:10 }} />
              </View>
              <View style={{ marginBottom:8 }}>
                <Text style={{ fontWeight:'700', color:'#111827', marginBottom:6 }}>Date of incorporation (MM‑DD‑YYYY)</Text>
                <TextInput value={(function(){ const d=String(bizIncorpUs||'').replace(/\D/g,'').slice(0,8); const mm=d.slice(0,2), dd=d.slice(2,4), yyyy=d.slice(4,8); return [mm,dd,yyyy].filter(Boolean).join('-'); })()} onChangeText={(t)=>{ const d=String(t||'').replace(/\D/g,'').slice(0,8); const mm=d.slice(0,2), dd=d.slice(2,4), yyyy=d.slice(4,8); setBizIncorpUs([mm,dd,yyyy].filter(Boolean).join('-')); }} placeholder="01-31-2020" keyboardType="number-pad" maxLength={10} style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:12, paddingVertical:10 }} />
              </View>
              <Text style={{ fontSize:16, fontWeight:'800', marginTop:8, marginBottom:8 }}>Business address</Text>
              <View style={{ marginBottom:8 }}>
                <AddressAutocomplete
                  value={addr1}
                  onChangeText={setAddr1}
                  onSelect={({ line1, city, state, postal }) => { setAddr1(line1||''); setCity(city||''); setState(state||''); setPostal(postal||''); }}
                />
              </View>
              <TextInput value={addr2} onChangeText={setAddr2} placeholder="Address line 2 (optional)" style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:12, paddingVertical:10, marginBottom:8 }} />
              <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
                <TextInput value={city} onChangeText={setCity} placeholder="City" style={{ width:'48%', borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:12, paddingVertical:10 }} />
                <TextInput value={state} onChangeText={setState} placeholder="State" style={{ width:'48%', borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:12, paddingVertical:10 }} />
              </View>
              <TextInput value={postal} onChangeText={setPostal} placeholder="Postal code" keyboardType="number-pad" style={{ marginTop:8, borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:12, paddingVertical:10 }} />
              <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:16 }}>
                <TouchableOpacity onPress={()=> (bizType==='501c3' ? animateTo(2, -1) : animateTo(3, -1))} style={{ width:'48%', backgroundColor:'#E5E7EB', borderRadius:12, paddingVertical:12, alignItems:'center' }}>
                  <Text style={{ color:'#111827', fontWeight:'700' }}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity disabled={!isBizDetailsValid} onPress={()=>{ if (!isBizDetailsValid) { Alert.alert('Missing info','Please complete all required fields.'); return; } animateTo(5, 1); }} style={{ width:'48%', backgroundColor: isBizDetailsValid ? '#3B82F6' : '#9CA3AF', borderRadius:12, paddingVertical:12, alignItems:'center' }}>
                  <Text style={{ color:'#fff', fontWeight:'700' }}>Next</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}
          {step === 5 && (bizType === 'llc' || bizType === '501c3') && (
            <Animated.View style={{ opacity: fade, transform: [{ translateX: slide.interpolate({ inputRange:[-1,0,1], outputRange:[-24,0,24] }) }] , marginTop:0, marginBottom:24, backgroundColor:'#fff', borderRadius:16, padding:16, borderWidth:1, borderColor:'#E0E7FF' }}>
              <Text style={{ fontSize:20, fontWeight:'800', marginBottom:8 }}>Business contact & profile</Text>
              <Text style={{ color:'#4B5563', marginBottom:12 }}>We'll show this to guests and processors. You can change this later.</Text>
              <View style={{ marginBottom:8 }}>
                <Text style={{ fontWeight:'700', color:'#111827', marginBottom:6 }}>Website</Text>
                <TextInput value={bizWebsite} onChangeText={setBizWebsite} placeholder="https://example.com" autoCapitalize="none" style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:12, paddingVertical:10 }} />
              </View>
              <View style={{ marginBottom:8 }}>
                <Text style={{ fontWeight:'700', color:'#111827', marginBottom:6 }}>Support email</Text>
                <TextInput value={bizSupportEmail} onChangeText={setBizSupportEmail} placeholder="support@example.com" autoCapitalize="none" keyboardType="email-address" style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:12, paddingVertical:10 }} />
              </View>
              <View style={{ marginBottom:8 }}>
                <Text style={{ fontWeight:'700', color:'#111827', marginBottom:6 }}>Support phone</Text>
                <TextInput value={bizSupportPhone} onChangeText={setBizSupportPhone} placeholder="(555) 555-5555" keyboardType="phone-pad" style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:12, paddingVertical:10 }} />
              </View>
              {/* Previous processor removed; we always default to None server-side */}
              <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:16 }}>
                <TouchableOpacity onPress={()=>animateTo(4, -1)} style={{ width:'48%', backgroundColor:'#E5E7EB', borderRadius:12, paddingVertical:12, alignItems:'center' }}>
                  <Text style={{ color:'#111827', fontWeight:'700' }}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity disabled={!isBizContactValid} onPress={()=>{ if (!isBizContactValid) { Alert.alert('Missing info','Please provide website and support contact.'); return; } animateTo(6, 1); }} style={{ width:'48%', backgroundColor: isBizContactValid ? '#3B82F6' : '#9CA3AF', borderRadius:12, paddingVertical:12, alignItems:'center' }}>
                  <Text style={{ color:'#fff', fontWeight:'700' }}>Next</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}
          {step === 6 && (bizType === 'llc' || bizType === '501c3') && (
            <Animated.View style={{ opacity: fade, transform: [{ translateX: slide.interpolate({ inputRange:[-1,0,1], outputRange:[-24,0,24] }) }] , marginTop:0, marginBottom:24, backgroundColor:'#fff', borderRadius:16, padding:16, borderWidth:1, borderColor:'#E0E7FF' }}>
              <Text style={{ fontSize:20, fontWeight:'800', marginBottom:8 }}>Review & continue</Text>
              <Text style={{ color:'#4B5563', marginBottom:12 }}>We'll send these to the processor. Sensitive info will be added last.</Text>
              <View style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:12, padding:12, backgroundColor:'#F9FAFB' }}>
                <Text style={{ fontWeight:'800', marginBottom:6 }}>Business</Text>
                <Text>Legal name: {bizLegalName||'-'}</Text>
                <Text>EIN: {(function(){ const d=String(bizEin||'').replace(/\D/g,''); return d ? `${d.slice(0,2)}-${d.slice(2)}` : '-'; })()}</Text>
                <Text>Date of incorp: {bizIncorpUs||'-'}</Text>
                <Text>Address: {addr1} {addr2?` | ${addr2}`:''} | {city}, {state} {postal}</Text>
                <Text style={{ fontWeight:'800', marginVertical:6 }}>Profile</Text>
                <Text>Website: {normalizeUrl(bizWebsite)||'-'}</Text>
                <Text>Support: {bizSupportEmail||'-'} | {bizSupportPhone||'-'}</Text>
                {/* Prev processor omitted; defaults to None on server */}
              </View>
              <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:16 }}>
                <TouchableOpacity onPress={()=>animateTo(5, -1)} style={{ width:'48%', backgroundColor:'#E5E7EB', borderRadius:12, paddingVertical:12, alignItems:'center' }}>
                  <Text style={{ color:'#111827', fontWeight:'700' }}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={()=>animateTo(7, 1)} style={{ width:'48%', backgroundColor:'#10B981', borderRadius:12, paddingVertical:12, alignItems:'center' }}>
                  <Text style={{ color:'#fff', fontWeight:'700' }}>Continue</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}

          {step === 2 && bizType === 'sp' && (
            <Animated.View style={{ opacity: fade, transform: [{ translateX: slide.interpolate({ inputRange:[-1,0,1], outputRange:[-24,0,24] }) }] , marginTop:0, marginBottom:24, backgroundColor:'#fff', borderRadius:16, padding:16, borderWidth:1, borderColor:'#E0E7FF', overflow:'hidden' }}>
              <Text style={{ fontSize:20, fontWeight:'800', marginBottom:8 }}>What kind of events are you planning to host?</Text>

              {/* Dropdown trigger */}
              <TouchableOpacity onPress={()=>{
                if (!mccShow) {
                  // If image showing, slide out first
                  if (showMccImage) {
                    Animated.parallel([
                      Animated.timing(mccImageX, { toValue: 60, duration: ANIM_MS, useNativeDriver: true }),
                      Animated.timing(mccImageOpacity, { toValue: 0, duration: ANIM_MS, useNativeDriver: true })
                    ]).start(() => {
                      setShowMccImage(false);
                      Animated.timing(mccImageHeight, { toValue: 0, duration: ANIM_MS, useNativeDriver: false }).start(() => {
                        setMccOpen(true); setMccShow(true); mccOpacity.setValue(0);
                        Animated.timing(mccSpacer, { toValue: MCC_HEIGHT, duration: ANIM_MS, useNativeDriver: false, easing: Easing.out(Easing.quad) }).start(() => {
                          Animated.timing(mccOpacity, { toValue: 1, duration: ANIM_MS, useNativeDriver: true }).start();
                        });
                      });
                    });
                  } else {
                    setMccOpen(true); setMccShow(true); mccOpacity.setValue(0);
                    Animated.timing(mccSpacer, { toValue: Math.max(0, (optionsHeight || MCC_HEIGHT) - MCC_SPACER_ADJUST), duration: ANIM_MS, useNativeDriver: false, easing: Easing.out(Easing.quad) }).start(() => {
                      Animated.timing(mccOpacity, { toValue: 1, duration: ANIM_MS, useNativeDriver: true }).start();
                    });
                  }
                } else {
                  Animated.timing(mccOpacity, { toValue: 0, duration: ANIM_MS, useNativeDriver: true }).start(() => {
                    setMccShow(false);
                    Animated.timing(mccSpacer, { toValue: 0, duration: ANIM_MS, useNativeDriver: false, easing: Easing.out(Easing.quad) }).start(() => setMccOpen(false));
                  });
                }
              }} style={{ paddingVertical:14, paddingHorizontal:12, borderRadius:12, borderWidth:2, borderColor:'#E5E7EB', backgroundColor:'#fff', flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
                <Text style={{ fontWeight:'800', color:'#111827' }}>
                  {mccSelected ? (spMcc==='7922' ? 'Shows, parties, or performances' : spMcc==='7999' ? 'Workshops, classes, or meetups' : 'Food or drink vendor') : "What's your vybe?"}
                </Text>
                <Ionicons name={(mccOpen||mccShow) ? 'chevron-up' : 'chevron-down'} size={18} color="#6B7280" />
                  </TouchableOpacity>

              {/* Spacer that makes options push content below if any */}
              <Animated.View style={{ height: mccSpacer }} />

              {/* Options overlay */}
              {mccShow && (
                <Animated.View style={{ position:'absolute', left:16, right:16, top:64, opacity: mccOpacity }}>
                  <View onLayout={(e)=>{ const h=e.nativeEvent.layout.height; if (h && h!==optionsHeight) { setOptionsHeight(h); if (mccShow) { Animated.timing(mccSpacer,{ toValue: Math.max(0,h - MCC_SPACER_ADJUST), duration:100, useNativeDriver:false }).start(); } } }} style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:12, backgroundColor:'#fff' }}>
                    {[{
                      key:'7922',
                      title:'Shows, parties, or performances',
                      d1:'Live music, DJ sets, club nights, comedy shows, or ticketed experiences.',
                      d2:'Great for promoters, performers, or nightlife organizers.',
                    }, {
                      key:'7999',
                      title:'Workshops, classes, or meetups',
                      d1:'Yoga flows, painting nights, group runs, or skill-sharing sessions.',
                      d2:'Perfect for teachers, organizers, and anyone building community around a passion.',
                    }, {
                      key:'5814',
                      title:'Food or drink vendor',
                      d1:'Food trucks, pop-up kitchens, coffee carts, tastings, or market booths.',
                      d2:'Ideal for creators serving up something delicious — no brick-and-mortar needed.',
                    }].map((opt, idx) => (
                      <TouchableOpacity key={opt.key} onPress={()=>{
                        setSpMcc(opt.key); updateDraft({ spMcc: opt.key }); setMccSelected(true);
                        Animated.timing(mccOpacity, { toValue: 0, duration: ANIM_MS, useNativeDriver: true }).start(() => {
                          setMccShow(false);
                          Animated.timing(mccSpacer, { toValue: 0, duration: ANIM_MS, useNativeDriver: false, easing: Easing.out(Easing.quad) }).start(() => {
                            setMccOpen(false);
                            // show placeholder panel
                            setShowMccImage(true);
                            Animated.timing(mccImageHeight, { toValue: PLACEHOLDER_H, duration: ANIM_MS, useNativeDriver: false }).start(() => {
                              mccImageX.setValue(-60);
                              mccImageOpacity.setValue(0);
                              Animated.parallel([
                                Animated.timing(mccImageX, { toValue: 0, duration: ANIM_MS, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
                                Animated.timing(mccImageOpacity, { toValue: 1, duration: ANIM_MS, useNativeDriver: true })
                              ]).start();
                            });
                          });
                        });
                      }} style={{ padding:14, borderBottomWidth: idx<2 ? 1 : 0, borderColor:'#F3F4F6' }}>
                        <View style={{ flexDirection:'row', alignItems:'center', marginBottom:6 }}>
                          <View style={{ width:22, height:22, borderRadius:11, borderWidth:2, borderColor: spMcc===opt.key ? '#3B82F6' : '#9CA3AF', alignItems:'center', justifyContent:'center', marginRight:10 }}>
                            {spMcc===opt.key && <View style={{ width:10, height:10, borderRadius:5, backgroundColor:'#3B82F6' }} />}
                      </View>
                          <Text style={{ fontWeight:'800', color:'#111827' }}>{opt.title}</Text>
                      </View>
                        <Text style={{ color:'#4B5563', marginBottom:2 }}>{opt.d1}</Text>
                        <Text style={{ color:'#6B7280' }}>{opt.d2}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </Animated.View>
              )}

              {/* Placeholder image area under selector */}
              {showMccImage && (
                <Animated.View style={{ height: mccImageHeight, marginTop:8, overflow:'hidden', borderRadius:12 }}>
                  <Animated.View style={{ flex:1, backgroundColor: spMcc==='7922' ? '#111827' : spMcc==='7999' ? '#0B1220' : '#1F2937', borderRadius:12, transform:[{ translateX: mccImageX }], opacity: mccImageOpacity, padding:12, justifyContent:'center' }}>
                    <Text style={{ color:'#fff', fontWeight:'800', marginBottom:4 }}>
                      {spMcc==='7922' ? 'Nightlife & Performances' : spMcc==='7999' ? 'Workshops & Community' : 'Food or Drink Vendor'}
                    </Text>
                    <Text style={{ color:'#E5E7EB' }}>{spMcc==='7922' ? 'Visual placeholder — ticketed vibes coming soon.' : spMcc==='7999' ? 'Visual placeholder — community vibes coming soon.' : 'Visual placeholder — vendor vibes coming soon.'}</Text>
                  </Animated.View>
                </Animated.View>
              )}

              {/* Footer moved to floating footer */}
            </Animated.View>
          )}

          {step === 2 && (bizType === 'llc' || bizType === '501c3') && (
            <Animated.View style={{ opacity: fade, transform: [{ translateX: slide.interpolate({ inputRange:[-1,0,1], outputRange:[-24,0,24] }) }] , marginTop:0, marginBottom:24, backgroundColor:'#fff', borderRadius:16, padding:16, borderWidth:1, borderColor:'#E0E7FF', overflow:'hidden' }}>
              <Text style={{ fontSize:20, fontWeight:'800', marginBottom:8 }}>What kind of events are you planning to host?</Text>

              {/* Dropdown trigger */}
              <TouchableOpacity onPress={()=>{
                if (!mccShow) {
                  // If image showing, slide out first
                  if (showMccImage) {
                    Animated.parallel([
                      Animated.timing(mccImageX, { toValue: 60, duration: ANIM_MS, useNativeDriver: true }),
                      Animated.timing(mccImageOpacity, { toValue: 0, duration: ANIM_MS, useNativeDriver: true })
                    ]).start(() => {
                      setShowMccImage(false);
                      Animated.timing(mccImageHeight, { toValue: 0, duration: ANIM_MS, useNativeDriver: false }).start(() => {
                        setMccOpen(true); setMccShow(true); mccOpacity.setValue(0);
                        Animated.timing(mccSpacer, { toValue: MCC_HEIGHT, duration: ANIM_MS, useNativeDriver: false, easing: Easing.out(Easing.quad) }).start(() => {
                          Animated.timing(mccOpacity, { toValue: 1, duration: ANIM_MS, useNativeDriver: true }).start();
                        });
                      });
                    });
                  } else {
                    setMccOpen(true); setMccShow(true); mccOpacity.setValue(0);
                    Animated.timing(mccSpacer, { toValue: Math.max(0, (optionsHeight || MCC_HEIGHT) - MCC_SPACER_ADJUST), duration: ANIM_MS, useNativeDriver: false, easing: Easing.out(Easing.quad) }).start(() => {
                      Animated.timing(mccOpacity, { toValue: 1, duration: ANIM_MS, useNativeDriver: true }).start();
                    });
                  }
                } else {
                  Animated.timing(mccOpacity, { toValue: 0, duration: ANIM_MS, useNativeDriver: true }).start(() => {
                    setMccShow(false);
                    Animated.timing(mccSpacer, { toValue: 0, duration: ANIM_MS, useNativeDriver: false, easing: Easing.out(Easing.quad) }).start(() => setMccOpen(false));
                  });
                }
              }} style={{ paddingVertical:14, paddingHorizontal:12, borderRadius:12, borderWidth:2, borderColor:'#E5E7EB', backgroundColor:'#fff', flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
                <Text style={{ fontWeight:'800', color:'#111827' }}>
                  {bizType==='llc' && (
                    mccSelected ? (
                      bizClass==='events_promotions' ? 'Promoters, venues, and ticketed events' :
                      bizClass==='food_beverage' ? 'Bars, cafés, food trucks, and kitchens' :
                      bizClass==='fitness_wellness' ? 'Gyms, studios, and wellness spaces' :
                      bizClass==='arts_education' ? 'Galleries, workshops, and learning spaces' : "What's your vybe?"
                    ) : "What's your vybe?"
                  )}
                  {bizType==='501c3' && (
                    mccSelected ? (
                      bizMcc==='7922' ? 'Primarily ticketed shows' :
                      bizMcc==='8299' ? 'Classes or workshops' :
                      bizMcc==='8299' ? 'Museum or gallery' : 'Other nonprofit activities'
                    ) : "What's your vybe?"
                  )}
                  {bizType==='sp' && (
                    mccSelected ? (spMcc==='7922' ? 'Shows, parties, or performances' : spMcc==='7999' ? 'Workshops, classes, or meetups' : 'Food or drink vendor') : "What's your vybe?"
                  )}
                </Text>
                <Ionicons name={(mccOpen||mccShow) ? 'chevron-up' : 'chevron-down'} size={18} color="#6B7280" />
                  </TouchableOpacity>

              {/* Spacer that makes options push content below if any */}
              <Animated.View style={{ height: mccSpacer }} />

              {/* Options overlay */}
              {mccShow && (
                <Animated.View style={{ position:'absolute', left:16, right:16, top:64, opacity: mccOpacity }}>
                  <View onLayout={(e)=>{ const h=e.nativeEvent.layout.height; if (h && h!==optionsHeight) { setOptionsHeight(h); if (mccShow) { Animated.timing(mccSpacer,{ toValue: Math.max(0,h - MCC_SPACER_ADJUST), duration:100, useNativeDriver:false }).start(); } } }} style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:12, backgroundColor:'#fff' }}>
                    {(bizType==='501c3' ? [
                      { key:'ticketed', title:'Primarily ticketed shows', d1:'Concerts, performances, or fundraisers with admission.', mapMcc:'7922' },
                      { key:'classes', title:'Classes or workshops', d1:'Education, training, or community programming.', mapMcc:'8299' },
                      { key:'museum_gallery', title:'Museum or gallery', d1:'Exhibitions, galleries, or cultural showcases.', mapMcc:'8299' },
                      { key:'other_npo', title:'Other nonprofit activities', d1:'General charitable services and social programs.', mapMcc:'8398' },
                    ] : [
                      { key:'events_promotions', title:'Promoters, venues, and ticketed events', d1:'For businesses that host, organize, or promote live shows, parties, and cultural gatherings.', d2:'Great for booking teams, venue operators, and event production crews.' },
                      { key:'food_beverage', title:'Bars, cafés, food trucks, and kitchens', d1:'For businesses serving up food, drinks, or hospitality — in a fixed space or on the move.', d2:'Perfect for restaurant owners, pop-up vendors, and mobile food operators.' },
                      { key:'fitness_wellness', title:'Gyms, studios, and wellness spaces', d1:'For businesses that help people move, train, stretch, or reset — physically or mentally.', d2:'Ideal for gyms, fitness collectives, or wellness studios with a consistent location.' },
                      { key:'arts_education', title:'Galleries, workshops, and learning spaces', d1:'For creative businesses focused on teaching, sharing, or showcasing ideas and expression.', d2:'Built for galleries, arts organizations, and hands-on education spaces.' },
                    ]).map((opt, idx) => (
                      <TouchableOpacity key={opt.key} onPress={()=>{
                        if (bizType==='501c3') {
                          setBizClass(opt.key); setMccSelected(true); setBizMcc(opt.mapMcc);
                        } else {
                          setBizClass(opt.key); setMccSelected(true);
                        }
                        Animated.timing(mccOpacity, { toValue: 0, duration: ANIM_MS, useNativeDriver: true }).start(() => {
                          setMccShow(false);
                          Animated.timing(mccSpacer, { toValue: 0, duration: ANIM_MS, useNativeDriver: false, easing: Easing.out(Easing.quad) }).start(() => {
                            setMccOpen(false);
                            // show placeholder panel for class selection
                            setShowMccImage(true);
                            Animated.timing(mccImageHeight, { toValue: PLACEHOLDER_H, duration: ANIM_MS, useNativeDriver: false }).start(() => {
                              mccImageX.setValue(-60);
                              mccImageOpacity.setValue(0);
                              Animated.parallel([
                                Animated.timing(mccImageX, { toValue: 0, duration: ANIM_MS, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
                                Animated.timing(mccImageOpacity, { toValue: 1, duration: ANIM_MS, useNativeDriver: true })
                              ]).start();
                            });
                          });
                        });
                      }} style={{ padding:14, borderBottomWidth: idx<2 ? 1 : 0, borderColor:'#F3F4F6' }}>
                        <View style={{ flexDirection:'row', alignItems:'center', marginBottom:6 }}>
                          <View style={{ width:22, height:22, borderRadius:11, borderWidth:2, borderColor: bizClass===opt.key ? '#3B82F6' : '#9CA3AF', alignItems:'center', justifyContent:'center', marginRight:10 }}>
                            {bizClass===opt.key && <View style={{ width:10, height:10, borderRadius:5, backgroundColor:'#3B82F6' }} />}
                      </View>
                          <Text style={{ fontWeight:'800', color:'#111827' }}>{opt.title}</Text>
                      </View>
                        <Text style={{ color:'#4B5563', marginBottom:2 }}>{opt.d1}</Text>
                        {opt.d2 && <Text style={{ color:'#6B7280' }}>{opt.d2}</Text>}
                      </TouchableOpacity>
                    ))}
                  </View>
                </Animated.View>
              )}

              {/* Placeholder image area under selector */}
              <Animated.View style={{ height: mccImageHeight, marginTop:8, overflow:'hidden', borderRadius:12 }}>
                {showMccImage && (
                  <Animated.View style={{ flex:1, backgroundColor: (
                    bizType==='llc'
                      ? (bizClass==='events_promotions' ? '#111827' : bizClass==='food_beverage' ? '#1F2937' : bizClass==='fitness_wellness' ? '#0B1220' : '#374151')
                      : bizType==='501c3'
                        ? (bizMcc==='7922' ? '#111827' : bizMcc==='8299' ? '#0B1220' : '#1F2937')
                        : (spMcc==='7922' ? '#111827' : spMcc==='7999' ? '#0B1220' : '#1F2937')
                  ), borderRadius:12, transform:[{ translateX: mccImageX }], opacity: mccImageOpacity, padding:12, justifyContent:'center' }}>
                    <Text style={{ color:'#fff', fontWeight:'800', marginBottom:4 }}>
                      {bizType==='llc'
                        ? (bizClass==='events_promotions' ? 'Events & Promotions' : bizClass==='food_beverage' ? 'Food & Beverage' : bizClass==='fitness_wellness' ? 'Fitness & Wellness' : 'Arts & Education')
                        : bizType==='501c3'
                          ? (bizMcc==='7922' ? 'Ticketed shows' : bizMcc==='8299' ? 'Classes & Workshops' : bizMcc==='8299' ? 'Museum/Gallery' : 'Nonprofit activities')
                          : (spMcc==='7922' ? 'Nightlife & Performances' : spMcc==='7999' ? 'Workshops & Community' : 'Food or Drink Vendor')}
                    </Text>
                    <Text style={{ color:'#E5E7EB' }}>
                      {bizType==='llc'
                        ? 'Visual placeholder — business vibes coming soon.'
                        : bizType==='501c3'
                          ? 'Visual placeholder — nonprofit vibes coming soon.'
                          : (spMcc==='7922' ? 'Visual placeholder — ticketed vibes coming soon.' : spMcc==='7999' ? 'Visual placeholder — community vibes coming soon.' : 'Visual placeholder — vendor vibes coming soon.')}
                    </Text>
                  </Animated.View>
                )}
              </Animated.View>
            </Animated.View>
          )}

          {step === 4 && bizType === 'sp' && (
            <Animated.View style={{ opacity: fade, transform: [{ translateX: slide.interpolate({ inputRange:[-1,0,1], outputRange:[-24,0,24] }) }] , marginTop:0, marginBottom:24, backgroundColor:'#fff', borderRadius:16, padding:16, borderWidth:1, borderColor:'#E0E7FF' }}>
              <Text style={{ fontSize:20, fontWeight:'800', marginBottom:8 }}>Securely verify your details</Text>
              <Text style={{ color:'#4B5563', marginBottom:12 }}>Enter SSN and date of birth. We transmit directly to our payments provider without storing any sensitive data.</Text>
              <View style={{ marginBottom:8 }}>
                <Text style={{ fontWeight:'700', color:'#111827', marginBottom:6 }}>SSN</Text>
                <TextInput
                  value={(function(){
                    const d = String(ssn||'').replace(/\D/g,'').slice(0,9);
                    if (d.length <= 3) return d;
                    if (d.length <= 5) return `${d.slice(0,3)}-${d.slice(3)}`;
                    return `${d.slice(0,3)}-${d.slice(3,5)}-${d.slice(5)}`;
                  })()}
                  onChangeText={(t)=> {
                    const digits = String(t||'').replace(/\D/g,'').slice(0,9);
                    setSsn(digits);
                  }}
                  keyboardType="number-pad"
                  maxLength={11}
                  placeholder="123-45-6789"
                  placeholderTextColor="#9CA3AF"
                  style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:12, paddingVertical:10 }}
                />
              </View>
              <View style={{ marginBottom:8 }}>
                <Text style={{ fontWeight:'700', color:'#111827', marginBottom:6 }}>Date of birth (MM‑DD‑YYYY)</Text>
                <TextInput value={(function(){
                  const d = String(dobUs||'').replace(/\D/g,'').slice(0,8);
                  const mm = d.slice(0,2), dd = d.slice(2,4), yyyy = d.slice(4,8);
                  let out = '';
                  if (mm) out += mm;
                  if (dd) out += (out ? '-' : '') + dd;
                  if (yyyy) out += (out ? '-' : '') + yyyy;
                  return out;
                })()} onChangeText={(t)=>{
                  const d = String(t||'').replace(/\D/g,'').slice(0,8);
                  const mm = d.slice(0,2), dd = d.slice(2,4), yyyy = d.slice(4,8);
                  const out = [mm, dd, yyyy].filter(Boolean).join('-');
                  setDobUs(out);
                }} placeholder="01-31-1990" keyboardType="number-pad" maxLength={10} style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:12, paddingVertical:10 }} />
              </View>
              <Text style={{ color:'#6B7280', marginBottom:8 }}>You'll add your payout method on the next step.</Text>
              <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:16 }}>
                <TouchableOpacity onPress={()=>animateTo(3, -1)} style={{ width:'48%', backgroundColor:'#E5E7EB', borderRadius:12, paddingVertical:12, alignItems:'center' }}>
                  <Text style={{ color:'#111827', fontWeight:'700' }}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity disabled={isSubmitting || !moovAccountId} onPress={finalizeIndividual} style={{ width:'48%', backgroundColor: (isSubmitting || !moovAccountId) ? '#6EE7B7' : '#10B981', borderRadius:12, paddingVertical:12, alignItems:'center' }}>
                  {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={{ color:'#fff', fontWeight:'700' }}>{moovAccountId ? 'Submit & Verify' : 'Setting up...'}</Text>}
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection:'row', alignItems:'flex-start', marginTop:16 }}>
                <TouchableOpacity onPress={()=>setAgreed(!agreed)} style={{ marginRight:8 }}>
                  <View style={{ width:22, height:22, borderRadius:6, borderWidth:1, borderColor:'#c7cdd9', backgroundColor: agreed ? '#10B981' : '#fff', alignItems:'center', justifyContent:'center' }}>
                    {agreed && <Ionicons name="checkmark" size={16} color="#fff" />}
                  </View>
                </TouchableOpacity>
                <Text style={{ color:'#111827', flex:1 }}>
                  I agree to the pricing, Merchant Terms and Conditions, <Text style={{ color:'#2563EB' }} onPress={()=>Linking.openURL(POLICY_URL)}>Portal Terms of Use</Text>, and <Text style={{ color:'#2563EB' }} onPress={()=>Linking.openURL(PRIVACY_URL)}>Privacy Policy</Text>. I also confirm that the information provided is accurate and that I am authorized by my company to enter into this agreement.
                </Text>
              </View>
            </Animated.View>
          )}

          {step === 5 && bizType === 'sp' && (
            <Animated.View style={{ opacity: fade, transform: [{ translateX: slide.interpolate({ inputRange:[-1,0,1], outputRange:[-24,0,24] }) }] , marginTop:0, marginBottom:24, backgroundColor:'#fff', borderRadius:16, padding:16, borderWidth:1, borderColor:'#E0E7FF' }}>
              <Text style={{ fontSize:20, fontWeight:'800', marginBottom:8 }}>Add payout method</Text>
              <Text style={{ color:'#4B5563', marginBottom:12 }}>Link a bank account (micro-deposits) or add a card.</Text>
              <View style={{ borderRadius:12, overflow:'hidden', borderWidth:1, borderColor:'#E5E7EB' }}>
                <WebView
                  style={{ height: 520, backgroundColor:'#fff' }}
                  javaScriptEnabled={true}
                  domStorageEnabled={true}
                  startInLoadingState={true}
                  originWhitelist={['*']}
                  source={{
                    html: `<!doctype html><html><head>
                      <meta charset='utf-8'/>
                      <meta name='viewport' content='width=device-width, initial-scale=1'/>
                      <script src='https://js.moov.io/v1'></script>
                      <script src='https://cards.moov.io/drops/v2.js'></script>
                      <style>body{font-family:system-ui;margin:0;padding:16px;background:#fff;color:#111827} #mount{min-height:420px} moov-payment-methods{display:block;width:100%;min-height:420px}</style>
                      </head><body>
                        <h3 style='margin:0 0 6px;font-weight:800'>Choose a payment method</h3>
                        <div id='status' style='font:12px system-ui;color:#6B7280;margin:4px 0 8px'>Initializing…</div>
                        <div id='mount'></div>
                        <script>(async function(){
                          const statusEl = document.getElementById('status');
                          function setStatus(t){ try{ statusEl.textContent = String(t||''); }catch(_){}; try{ post('pm:status',{ text:String(t||'') }); }catch(_){} }
                          function post(type, data){ try{ if(window.ReactNativeWebView){ window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({type}, data||{}))); } }catch(e){} }
                          // Bridge console logs
                          ;['log','warn','error'].forEach(fn=>{ const orig=console[fn]; console[fn]=function(){ try{ post('pm:console',{ level:fn, msg:[...arguments].map(String).join(' ') }); }catch(_){}; try{ orig.apply(console,arguments);}catch(_){} } });
                          const ACCOUNT_ID = ${JSON.stringify(moovAccountId || '')};
                          const API_BASE = ${JSON.stringify(API_BASE_URL)};
                          try{
                            if(!ACCOUNT_ID){ post('pm:error',{ step:'init', message:'missing_account_id' }); setStatus('Missing account id'); return; }
                            setStatus('Fetching token…');
                            const r=await fetch(API_BASE + '/api/payments/moov/token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ accountId: ACCOUNT_ID })});
                            const j=await r.json();
                            if(!j.access_token){ post('pm:error',{ step:'token', status:r.status, body: JSON.stringify(j).slice(0,200) }); setStatus('Token error'); return; }
                            try{ post('pm:console',{ level:'debug', msg:'token_scope='+(j.scope||'') }); }catch(_){ }
                            setStatus('Mounting payment widget…');
                            // Ensure element registered
                            try{ await customElements.whenDefined('moov-payment-methods'); }catch(_){}
                            if(!customElements.get('moov-payment-methods')){ setStatus('custom element not registered'); post('pm:error',{step:'define',message:'custom element not registered'}); return; }
                            const el=document.createElement('moov-payment-methods');
                            // Required properties
                            el.token=j.access_token;
                            el.accountID=ACCOUNT_ID;
                            try{ el.setAttribute('account-id', ACCOUNT_ID); el.setAttribute('token', j.access_token); }catch(_){ }
                            // Options
                            el.paymentMethodTypes=['card','bankAccount'];
                            el.microDeposits=false;
                            el.showLogo=false;
                            el.style.display='block'; el.style.width='100%'; el.style.minHeight='420px';
                            // Callbacks
                            el.onSuccess=function(pm){
                              var method = (pm && (pm.paymentMethodType || pm.type)) || (pm && pm.card ? 'card' : (pm && pm.bankAccount ? 'bank' : 'unknown'));
                              var id = pm && (pm.paymentMethodID || pm.id) || null;
                              post('pm:success', { ok:true, method: method, id: id });
                            };
                            el.onError=function(err){ post('pm:error', { message: String(err?.message||err) }); };
                            const mount=document.getElementById('mount');
                            mount.appendChild(el);
                            try{ el.open = true; el.setAttribute('open','true'); }catch(_){}
                            try{ const rect=mount.getBoundingClientRect(); post('pm:console',{level:'debug', msg:'mounted_children='+mount.children.length+', mount_h='+rect.height}); }catch(_){}
                            setStatus('Ready');
                            post('pm:ready');
                          }catch(e){ post('pm:error',{ message:e.message }); }
                        })();</script>
                      </body></html>`,
                    baseUrl: 'https://vybelocal.com'
                  }}
                  onMessage={(e)=>{
                    try{
                      const msg = JSON.parse(e.nativeEvent.data);
                      if(msg.type==='pm:console'){ console.log('[PM console]', msg); }
                      if(msg.type==='pm:status'){ console.log('[PM status]', msg.text); }
                      if(msg.type==='pm:success' || msg.type==='pm:added'){
                        (async ()=>{
                          try{
                            const { data: { session } } = await supabase.auth.getSession();
                            const token = session?.access_token;
                            if (token) {
                              const method = (msg && (msg.method || (msg.type==='pm:added'?'card':'card'))) || 'card';
                              await fetch(API_BASE_URL + '/api/payments/profile/payouts', {
                                method: 'POST', headers: { 'Content-Type':'application/json','Authorization': `Bearer ${token}` },
                                body: JSON.stringify({ method })
                              });
                            }
                          }catch{}
                        })();
                        try { setPmLinked(true); } catch(_){ }
                        if ((msg && msg.method) === 'bank') {
                          Alert.alert('Bank linked','We\'ll verify micro-deposits within 1–2 days. You can verify from your dashboard.');
                        } else {
                          Alert.alert('Card saved','Card added successfully.');
                        }
                      }
                      if(msg.type==='pm:error'){ console.log('[PM error]', msg); }
                    }catch{}
                  }}
                />
              </View>
              <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:12 }}>
                <TouchableOpacity onPress={()=>animateTo(4, -1)} style={{ width:'48%', backgroundColor:'#E5E7EB', borderRadius:12, paddingVertical:12, alignItems:'center' }}>
                  <Text style={{ color:'#111827', fontWeight:'700' }}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={()=>{
                  Alert.alert('All set','You can return here anytime to add or verify methods.');
                }} style={{ width:'48%', backgroundColor:'#10B981', borderRadius:12, paddingVertical:12, alignItems:'center' }}>
                  <Text style={{ color:'#fff', fontWeight:'700' }}>Finish</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}

          {step === 7 && (bizType === 'llc' || bizType === '501c3') && (
            <Animated.View style={{ opacity: fade, transform: [{ translateX: slide.interpolate({ inputRange:[-1,0,1], outputRange:[-24,0,24] }) }] , marginTop:0, marginBottom:24, backgroundColor:'#fff', borderRadius:16, padding:16, borderWidth:1, borderColor:'#E0E7FF' }}>
              <Text style={{ fontSize:20, fontWeight:'800', marginBottom:8 }}>Add business representative</Text>
              {bizType === '501c3' ? (
                <Text style={{ color:'#4B5563', marginBottom:12 }}>We'll submit this person as the controller (0% ownership).</Text>
              ) : (
                <Text style={{ color:'#4B5563', marginBottom:12 }}>Add at least one owner/controller. Include anyone with ≥25% ownership.</Text>
              )}
              <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
                <View style={{ width:'48%' }}>
                  <Text style={{ fontWeight:'700', color:'#111827', marginBottom:6 }}>First name</Text>
                  <TextInput value={cpFirstName} onChangeText={setCpFirstName} placeholder="First name" autoCapitalize="words" style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:12, paddingVertical:10 }} />
                </View>
                <View style={{ width:'48%' }}>
                  <Text style={{ fontWeight:'700', color:'#111827', marginBottom:6 }}>Last name</Text>
                  <TextInput value={cpLastName} onChangeText={setCpLastName} placeholder="Last name" autoCapitalize="words" style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:12, paddingVertical:10 }} />
                </View>
              </View>
              {/* Role and ownership for business; fixed controller/0% for 501c3 */}
              {bizType === 'llc' && (
                <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
                  <View style={{ width:'48%' }}>
                    <Text style={{ fontWeight:'700', color:'#111827', marginBottom:6 }}>Role</Text>
                    <TouchableOpacity
                      onPress={()=> setSelectorOpen((v)=>!v)}
                      style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:12, paddingVertical:10, flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
                      <Text>{String(cpTitle).replace(/\b\w/g, c=>c.toUpperCase())}</Text>
                      <Ionicons name={selectorOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#6B7280" />
                    </TouchableOpacity>
                    {/* Overlay and absolute dropdown */}
                    {selectorOpen && (
                      <>
                        {/* Full-step overlay to block clicks behind */}
                        <Pressable onPress={()=> setSelectorOpen(false)} style={{ position:'absolute', top:-2000, bottom:-2000, left:-2000, right:-2000, zIndex:900 }} />
                        <View style={{ position:'absolute', top:44, left:0, right:0, zIndex:1000, elevation:1000, borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, backgroundColor:'#FFFFFF', overflow:'hidden', shadowColor:'#000', shadowOpacity:0.1, shadowRadius:8, shadowOffset:{ width:0, height:4 } }}>
                          {['owner','co-owner','manager','director'].map((opt, idx)=> (
                            <TouchableOpacity key={opt} onPress={()=>{ setCpTitle(opt); setSelectorOpen(false); }} style={{ paddingVertical:10, paddingHorizontal:12, backgroundColor: idx%2 ? '#F9FAFB' : '#FFFFFF' }}>
                              <Text style={{ color:'#111827' }}>{String(opt).replace(/\b\w/g, c=>c.toUpperCase())}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </>
                    )}
                  </View>
                  <View style={{ width:'48%' }}>
                    <Text style={{ fontWeight:'700', color:'#111827', marginBottom:6 }}>Ownership %</Text>
                    <TextInput value={String(cpOwnership)} onChangeText={(t)=>{ const v=String(t||'').replace(/[^0-9]/g,''); setCpOwnership(v.slice(0,3)); }} placeholder="0" keyboardType="number-pad" style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:12, paddingVertical:10 }} />
                  </View>
                </View>
              )}
              <View style={{ marginTop:8, marginBottom:8, position:'relative' }}>
                <Text style={{ fontWeight:'700', color:'#111827', marginBottom:6 }}>SSN</Text>
                <TextInput
                  value={ssn}
                  onChangeText={(t)=> setSsn(String(t||'').replace(/\D/g,'').slice(0,9))}
                  keyboardType="number-pad"
                  maxLength={9}
                  placeholder="***-**-6789"
                  placeholderTextColor="#9CA3AF"
                  style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:12, paddingVertical:10, color:'transparent' }}
                />
                <Text pointerEvents="none" style={{ position:'absolute', left:12, top:36, color:'#111827' }}>
                  {(function(){
                    const d = String(ssn||'').replace(/\D/g,'').slice(0,9);
                    const p1 = d.slice(0,3), p2 = d.slice(3,5), p3 = d.slice(5,9);
                    const m1 = '*'.repeat(p1.length);
                    const m2 = '*'.repeat(p2.length);
                    const segs = [];
                    if (p1) segs.push(m1);
                    if (p2) segs.push(m2);
                    if (p3) segs.push(p3);
                    return segs.join('-');
                  })()}
                </Text>
              </View>
              <View style={{ marginBottom:8 }}>
                <Text style={{ fontWeight:'700', color:'#111827', marginBottom:6 }}>Date of birth (MM‑DD‑YYYY)</Text>
                <TextInput value={(function(){
                  const d = String(dobUs||'').replace(/\D/g,'').slice(0,8);
                  const mm = d.slice(0,2), dd = d.slice(2,4), yyyy = d.slice(4,8);
                  let out = '';
                  if (mm) out += mm;
                  if (dd) out += (out ? '-' : '') + dd;
                  if (yyyy) out += (out ? '-' : '') + yyyy;
                  return out;
                })()} onChangeText={(t)=>{
                  const d = String(t||'').replace(/\D/g,'').slice(0,8);
                  const mm = d.slice(0,2), dd = d.slice(2,4), yyyy = d.slice(4,8);
                  const out = [mm, dd, yyyy].filter(Boolean).join('-');
                  setDobUs(out);
                }} placeholder="01-31-1990" keyboardType="number-pad" maxLength={10} style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:12, paddingVertical:10 }} />
              </View>
              <Text style={{ fontSize:16, fontWeight:'800', marginTop:8, marginBottom:8 }}>Residential address</Text>
              <View style={{ marginBottom:8 }}>
                <AddressAutocomplete
                  value={addr1}
                  onChangeText={setAddr1}
                  onSelect={({ line1, city, state, postal }) => { setAddr1(line1||''); setCity(city||''); setState(state||''); setPostal(postal||''); }}
                />
              </View>
              <TextInput value={addr2} onChangeText={setAddr2} placeholder="Address line 2 (optional)" style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:12, paddingVertical:10, marginBottom:8 }} />
              <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
                <TextInput value={city} onChangeText={setCity} placeholder="City" style={{ width:'48%', borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:12, paddingVertical:10 }} />
                <TextInput value={state} onChangeText={setState} placeholder="State" style={{ width:'48%', borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:12, paddingVertical:10 }} />
              </View>
              <TextInput value={postal} onChangeText={setPostal} placeholder="Postal code" keyboardType="number-pad" style={{ marginTop:8, borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:12, paddingVertical:10 }} />
              <View style={{ alignItems:'center', marginTop:12 }}>
                <TouchableOpacity onPress={()=>{
                  const ssnDigits = String(ssn||'').replace(/\D/g,'');
                  if (!cpFirstName.trim() || !cpLastName.trim()) { Alert.alert('Name required','Enter first and last name.'); return; }
                  if (ssnDigits.length !== 9) { Alert.alert('SSN required','Enter a 9‑digit SSN.'); return; }
                  if (!/^\d{2}-\d{2}-\d{4}$/.test(dobUs)) { Alert.alert('DOB format','Use MM‑DD‑YYYY.'); return; }
                  const entry = {
                    first: cpFirstName.trim(), last: cpLastName.trim(),
                    title: (bizType === '501c3') ? 'controller' : cpTitle,
                    ownership: (bizType === '501c3') ? 0 : Number(cpOwnership || 0),
                    ssn: ssnDigits, dob: (function(){ const d=dobUs.replace(/\D/g,''); return `${d.slice(4,8)}-${d.slice(0,2)}-${d.slice(2,4)}`; })(),
                    address: { line1: addr1, line2: addr2||null, city, state, postal_code: postal }
                  };
                  setPrincipals((prev)=> [...prev, entry]);
                  resetCpDraft();
                  Alert.alert('Added','Representative added. You can add another or continue.');
                }} style={{ width:'70%', backgroundColor:'#3B82F6', borderRadius:12, paddingVertical:12, alignItems:'center' }}>
                  <Text style={{ color:'#fff', fontWeight:'700' }}>Add Representative</Text>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:12 }}>
                <TouchableOpacity onPress={()=>animateTo(6, -1)} style={{ width:'48%', backgroundColor:'#E5E7EB', borderRadius:12, paddingVertical:12, alignItems:'center' }}>
                  <Text style={{ color:'#111827', fontWeight:'700' }}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={()=>{
                  // Require at least one representative
                  if (principals.length === 0) { Alert.alert('Add representative','Please add at least one representative.'); return; }
                  if (bizType !== '501c3') {
                    const high = principals.filter(p=> (p.ownership||0) >= 25);
                    if (high.length === 0) { Alert.alert('Ownership check','At least one owner with ≥25% must be listed.'); return; }
                  }
                  animateTo(8, 1);
                }} style={{ width:'48%', backgroundColor:'#10B981', borderRadius:12, paddingVertical:12, alignItems:'center' }}>
                  <Text style={{ color:'#fff', fontWeight:'700' }}>Continue</Text>
                </TouchableOpacity>
              </View>

              {principals.length > 0 && (
                <View style={{ marginTop:12, borderWidth:1, borderColor:'#E5E7EB', borderRadius:12, padding:12 }}>
                  <Text style={{ fontWeight:'800', marginBottom:8 }}>Added representatives</Text>
                  {principals.map((p, i)=>(
                    <View key={i} style={{ borderTopWidth: i?1:0, borderColor:'#F3F4F6', paddingTop: i?8:0, marginTop: i?8:0 }}>
                      <Text>{p.first} {p.last} — {String(p.title).replace(/\b\w/g, c=>c.toUpperCase())} — {p.ownership}%</Text>
                    </View>
                  ))}
                </View>
              )}
            </Animated.View>
          )}
          {step === 8 && (bizType === 'llc' || bizType === '501c3') && (
            <Animated.View style={{ opacity: fade, transform: [{ translateX: slide.interpolate({ inputRange:[-1,0,1], outputRange:[-24,0,24] }) }] , marginTop:0, marginBottom:24, backgroundColor:'#fff', borderRadius:16, padding:16, borderWidth:1, borderColor:'#E0E7FF' }}>
              <Text style={{ fontSize:20, fontWeight:'800', marginBottom:8 }}>Business bank information</Text>
              <Text style={{ color:'#4B5563', marginBottom:12 }}>We transmit directly to our provider with zero retention.</Text>
              <View style={{ marginBottom:8 }}>
                <Text style={{ fontWeight:'700', color:'#111827', marginBottom:6 }}>Account holder name</Text>
                <TextInput value={bankHolder} onChangeText={setBankHolder} placeholder="Legal business name" style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:12, paddingVertical:10 }} />
              </View>
              <View style={{ marginBottom:8 }}>
                <Text style={{ fontWeight:'700', color:'#111827', marginBottom:6 }}>Bank name</Text>
                <TextInput value={bankName} onChangeText={setBankName} placeholder="e.g., Chase Bank" style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:12, paddingVertical:10 }} />
              </View>
              <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
                <View style={{ width:'48%' }}>
                  <Text style={{ fontWeight:'700', color:'#111827', marginBottom:6 }}>Routing number</Text>
                  <TextInput value={bankRouting} onChangeText={(t)=>setBankRouting(t.replace(/\D/g,''))} placeholder="011000015" keyboardType="number-pad" maxLength={9} style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:12, paddingVertical:10 }} />
                </View>
                <View style={{ width:'48%' }}>
                  <Text style={{ fontWeight:'700', color:'#111827', marginBottom:6 }}>Account number</Text>
                  <TextInput value={bankAccount} onChangeText={(t)=>setBankAccount(t.replace(/\s/g,''))} placeholder="000123456789" keyboardType="number-pad" style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:12, paddingVertical:10 }} />
                </View>
              </View>
              <View style={{ flexDirection:'row', alignItems:'flex-start', marginTop:12 }}>
                <TouchableOpacity onPress={()=>setAgreed(!agreed)} style={{ marginRight:8 }}>
                  <View style={{ width:22, height:22, borderRadius:6, borderWidth:1, borderColor:'#c7cdd9', backgroundColor: agreed ? '#10B981' : '#fff', alignItems:'center', justifyContent:'center' }}>
                    {agreed && <Ionicons name="checkmark" size={16} color="#fff" />}
                  </View>
                </TouchableOpacity>
                <Text style={{ color:'#111827', flex:1 }}>
                  I agree to the pricing, Merchant Terms and Conditions, <Text style={{ color:'#2563EB' }} onPress={()=>Linking.openURL(POLICY_URL)}>Portal Terms of Use</Text>, and <Text style={{ color:'#2563EB' }} onPress={()=>Linking.openURL(PRIVACY_URL)}>Privacy Policy</Text>. I also confirm that the information provided is accurate and that I am authorized by my company to enter into this agreement.
                </Text>
              </View>
              <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:16 }}>
                <TouchableOpacity onPress={()=>animateTo(7, -1)} style={{ width:'48%', backgroundColor:'#E5E7EB', borderRadius:12, paddingVertical:12, alignItems:'center' }}>
                  <Text style={{ color:'#111827', fontWeight:'700' }}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity disabled={isSubmitting} onPress={async ()=>{
                  try {
                    setIsSubmitting(true);
                    const { data: { session } } = await supabase.auth.getSession();
                    const token = session?.access_token;
                    if (!token) { Alert.alert('Please sign in'); return; }
                    if (principals.length === 0) { Alert.alert('Missing representatives','Add at least one representative.'); return; }
                    if (!/^\d{9}$/.test(String(bankRouting||'').replace(/\D/g,''))) { Alert.alert('Routing number','Enter a 9‑digit routing number.'); return; }
                    if (!String(bankAccount||'').replace(/\s/g,'')) { Alert.alert('Account number','Enter a bank account number.'); return; }
                    if (!agreed) { Alert.alert('Agreement required','Please agree to the Terms before submitting.'); return; }
                    const body = {
                      business: {
                        type: bizType === '501c3' ? 'corporation' : 'llc',
                        legal_name: bizLegalName,
                        tax_id: String(bizEin||'').replace(/\D/g,''),
                        start_or_incorp_date: (function(){ const d=bizIncorpUs.replace(/\D/g,''); return `${d.slice(4,8)}-${d.slice(0,2)}-${d.slice(2,4)}`; })(),
                        address: { line1: addr1, line2: addr2||null, city, state, postal_code: postal },
                        website: normalizeUrl(bizWebsite),
                        support: { email: bizSupportEmail || user?.email, phone: toE164US(bizSupportPhone) },
                        mcc: bizMcc || '7922',
                        is_501c3: bizType === '501c3',
                      },
                      bank: { holder: bankHolder || bizLegalName, routing: String(bankRouting).replace(/\D/g,''), account: String(bankAccount).replace(/\s/g,''), bank_name: bankName || null },
                      control_person: { // send first principal as control person for now
                        first_name: principals[0].first,
                        last_name: principals[0].last,
                        address: principals[0].address,
                        dob: principals[0].dob,
                        ssn: principals[0].ssn,
                        title: principals[0].title,
                        ownership: principals[0].ownership,
                      },
                    };
                    if (__DEV__) {
                      try {
                        const masked = JSON.parse(JSON.stringify(body));
                        if (masked?.control_person?.ssn) masked.control_person.ssn = '***MASKED***';
                        if (masked?.bank?.account) masked.bank.account = '***MASKED***';
                        if (masked?.bank?.routing) masked.bank.routing = '***MASKED***';
                        console.log('[KYB][client][biz] submit body:', JSON.stringify(masked, null, 2));
                      } catch {}
                    }
                    const res = await fetch(`${API_BASE_URL}/api/payments/tilled/onboarding`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                        'x-idempotency-key': idemKey || `onboard_${user.id}_${Date.now()}`,
                      },
                      body: JSON.stringify(body)
                    });
                    const txt = await res.text();
                    let json; try { json = JSON.parse(txt); } catch { json = {}; }
                    if (__DEV__) {
                      try { console.log('[KYB][client][biz] response:', res.status, JSON.stringify(json, null, 2)); } catch {}
                    }
                    if (!res.ok) { Alert.alert('Error', json?.error || 'Onboarding failed'); return; }
                    Alert.alert('Submitted','Your business application was submitted.');
                  } catch (e) {
                    Alert.alert('Error', e?.message || 'Onboarding failed');
                  } finally { setIsSubmitting(false); }
                }} style={{ width:'48%', backgroundColor: isSubmitting ? '#6EE7B7' : '#10B981', borderRadius:12, paddingVertical:12, alignItems:'center' }}>
                  {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={{ color:'#fff', fontWeight:'700' }}>Submit & Verify</Text>}
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}

            </View>
          </View>
        </ScrollView>
        {(step===1 || step===2) && (
          <View style={{ position:'absolute', left:0, right:0, bottom:24, alignItems:'center' }}>
            <View style={{ width:'100%', maxWidth:420, flexDirection:'row', justifyContent:'space-between', paddingHorizontal:16 }}>
              <TouchableOpacity onPress={()=> (step===1 ? animateTo(0, -1) : animateTo(1, -1))} style={{ width:'48%', backgroundColor:'#E5E7EB', borderRadius:12, paddingVertical:12, alignItems:'center' }}>
                <Text style={{ color:'#111827', fontWeight:'700' }}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={()=> {
                  if (step===1) { animateTo(2, 1); return; }
                  // Step 2 guard: require MCC selection
                  if (step===2 && !mccSelected) {
                    Alert.alert('Select your vybe', 'Please choose an option before continuing.');
                    return;
                  }
                  if (step===2) {
                    // Charity skips subclass/details step and goes straight to business details
                    const next = bizType === '501c3' ? 4 : 3;
                    animateTo(next, 1);
                    return;
                  }
                  animateTo(3, 1);
                }}
                style={{ width:'48%', backgroundColor:(step===2 && !mccSelected) ? '#9CA3AF' : '#3B82F6', borderRadius:12, paddingVertical:12, alignItems:'center' }}
                disabled={step===2 && !mccSelected}
              >
                <Text style={{ color:'#fff', fontWeight:'700' }}>Next</Text>
              </TouchableOpacity>
            </View>
            </View>
          )}
      </SafeAreaView>
    </LinearGradient>
  );
}


