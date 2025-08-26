import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../utils/supabase';

const LAVENDER = '#CBB4E3';
const MIDNIGHT = '#111827';

function digitsOnly(s) {
  return (s || '').replace(/\D+/g, '').slice(0, 10);
}
const toE164 = (digits) => (digits ? `+1${digits}` : '');
const formatPretty = (digits) =>
  digits && digits.length === 10
    ? `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
    : digits;

// API helper functions for backend endpoints
// Use production waitlist API (Vercel)
import Constants from 'expo-constants';
const API_BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl || process.env?.EXPO_PUBLIC_API_BASE_URL || 'https://vybelocal.com';

async function connectivityProbe() {
  try {
    const t0 = Date.now();
    const r1 = await fetch('https://vybelocal.com/api/debug', { method: 'GET' });
    console.log('[probe] vybelocal.com', { status: r1.status, ms: Date.now() - t0 });
  } catch (e) {
    console.log('[probe] vybelocal.com network_error', e?.message || e, e?.nativeStack || e?.stack || '');
  }
  try {
    const t1 = Date.now();
    const r2 = await fetch('https://vybelocal-waitlist.vercel.app/api/debug', { method: 'GET' });
    console.log('[probe] waitlist.vercel.app', { status: r2.status, ms: Date.now() - t1 });
  } catch (e) {
    console.log('[probe] waitlist.vercel.app network_error', e?.message || e, e?.nativeStack || e?.stack || '');
  }
}

async function postEmailUpdateWithFallback(next, token) {
  const urls = [
    `${API_BASE_URL}/api/profile/email`,
    `https://vybelocal-waitlist.vercel.app/api/profile/email`,
  ];
  let lastError = null;
  for (const url of urls) {
    console.log('[mobile][email-change] start', { url });
    try {
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ email: next }),
      });
      const text = await res.text();
      console.log('[mobile][email-change] response', { url, status: res.status, body: text?.slice(0,200) });
      let json = {};
      try { json = JSON.parse(text); } catch {}
      if (!res.ok) throw new Error(json?.error || text || `HTTP ${res.status}`);
      return json;
    } catch (e) {
      console.log('[mobile][email-change] network_or_server_error', { url, message: e?.message || e, stack: e?.nativeStack || e?.stack || '' });
      lastError = e;
      // Only fall back on network-level failures; if we got a response with a status, the code above threw with message and we still try fallback
      continue;
    }
  }
  throw lastError || new Error('Network request failed');
}

async function postVerifyCurrentWithFallback(code, token) {
  const urls = [
    `${API_BASE_URL}/api/profile/email/verify-current`,
    `https://vybelocal-waitlist.vercel.app/api/profile/email/verify-current`,
  ];
  let lastError = null;
  for (const url of urls) {
    console.log('[mobile][email-verify-current] start', { url });
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ code }),
      });
      const text = await res.text();
      console.log('[mobile][email-verify-current] response', { url, status: res.status, body: text?.slice(0,200) });
      let json = {};
      try { json = JSON.parse(text); } catch {}
      if (!res.ok) throw new Error(json?.error || text || `HTTP ${res.status}`);
      return json;
    } catch (e) {
      console.log('[mobile][email-verify-current] network_or_server_error', { url, message: e?.message || e, stack: e?.nativeStack || e?.stack || '' });
      lastError = e;
      continue;
    }
  }
  throw lastError || new Error('Network request failed');
}

async function postPhoneStartWithFallback(phoneDigits, token) {
  const urls = [
    `https://vybelocal-waitlist.vercel.app/api/profile/phone`,
    `${API_BASE_URL}/api/profile/phone`
  ];
  let lastError = null;
  for (const url of urls) {
    console.log('[mobile][phone-start] start', { url });
    try {
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ phone: phoneDigits })
      });
      const text = await res.text();
      console.log('[mobile][phone-start] response', { url, status: res.status, body: text?.slice(0,200) });
      if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
      return true;
    } catch (e) {
      console.log('[mobile][phone-start] network_or_server_error', { url, message: e?.message || e, stack: e?.nativeStack || e?.stack || '' });
      lastError = e;
      continue;
    }
  }
  throw lastError || new Error('Network request failed');
}

async function postPhoneVerifyNewWithFallback(phoneDigits, code, token) {
  const urls = [
    `https://vybelocal-waitlist.vercel.app/api/profile/phone/verify-new`,
    `${API_BASE_URL}/api/profile/phone/verify-new`
  ];
  let lastError = null;
  for (const url of urls) {
    console.log('[mobile][phone-verify-new] start', { url });
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ phone: phoneDigits, code })
      });
      const text = await res.text();
      console.log('[mobile][phone-verify-new] response', { url, status: res.status, body: text?.slice(0,200) });
      let json = {};
      try { json = JSON.parse(text); } catch {}
      if (!res.ok) throw new Error(json?.error || text || `HTTP ${res.status}`);
      return json;
    } catch (e) {
      console.log('[mobile][phone-verify-new] network_or_server_error', { url, message: e?.message || e, stack: e?.nativeStack || e?.stack || '' });
      lastError = e;
      continue;
    }
  }
  throw lastError || new Error('Network request failed');
}

async function callSecureAPI(endpoint, data, token) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/profile/${endpoint}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || `HTTP ${response.status}`);
    }
    
    return result;
  } catch (error) {
    throw error;
  }
}

async function uploadAvatar(imageUri, token) {
  try {
    // Create form data
    const formData = new FormData();
    formData.append('avatar', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'avatar.jpg',
    });

    const response = await fetch(`${API_BASE_URL}/api/profile/avatar`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        // Don't set Content-Type for FormData - let fetch set it automatically
      },
      body: formData,
    });

    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    let result;
    
    if (contentType && contentType.includes('application/json')) {
      result = await response.json();
    } else {
      // If not JSON, get text for debugging
      const text = await response.text();
      throw new Error(`Server returned non-JSON response: ${response.status}`);
    }
    
    if (!response.ok) {
      throw new Error(result.error || `HTTP ${response.status}`);
    }
    
    return result;
  } catch (error) {
    throw error;
  }
}

export default function ProfileSettingsScreen() {
  const { user, session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Security: Rate limiting state
  const [lastUpdateTimes, setLastUpdateTimes] = useState({
    email: 0,
    phone: 0,
    pronouns: 0,
    bio: 0
  });
  const [updateCounts, setUpdateCounts] = useState({
    email: 0,
    phone: 0, 
    pronouns: 0,
    bio: 0
  });

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [pronouns, setPronouns] = useState('');
  const [isTrusted, setIsTrusted] = useState(false);
  const [trustedSince, setTrustedSince] = useState(null);
  const [lastActiveAt, setLastActiveAt] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [avatarPath, setAvatarPath] = useState(null);

  // deletion timer state
  const [deletionScheduled, setDeletionScheduled] = useState(null); // { scheduledFor: timestamp, deletionId: string }
  const [timeRemaining, setTimeRemaining] = useState(null);

  // phone verify flow
  const [requestedPhone, setRequestedPhone] = useState('');
  const [code, setCode] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [phoneStage, setPhoneStage] = useState(null); // 'current' | 'new'

  // email verify flow
  const [pendingEmail, setPendingEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [emailVerifying, setEmailVerifying] = useState(false);
  const [emailStage, setEmailStage] = useState(null); // 'current' | 'new'

  // unified verification modal state
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [verifyKind, setVerifyKind] = useState(null); // 'email' | 'phone'

  // password change state
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);
  const [showPwd, setShowPwd] = useState({ current:false, next:false, confirm:false });

  // drawers
  const [openEmail, setOpenEmail] = useState(false);
  const [openPhone, setOpenPhone] = useState(false);
  const [openPronouns, setOpenPronouns] = useState(false);
  const [openBio, setOpenBio] = useState(false);

  // (removed modal state — using drawers)

  // sections and scroll helpers
  const scrollRef = useRef(null);
  const sectionYs = useRef({});
  const setSectionY = (key, y) => { sectionYs.current[key] = y; };
  const scrollToKey = (key) => {
    const y = sectionYs.current[key];
    if (scrollRef.current && typeof y === 'number') {
      scrollRef.current.scrollTo({ y: Math.max(0, y - 12), animated: true });
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!user?.id) return;
      
      // Load profile data
      const { data, error } = await supabase
        .from('profiles')
        .select('name, email, phone, avatar_url, avatar_path, bio, pronouns, is_trusted, trusted_since, last_active_at')
        .eq('id', user.id)
        .maybeSingle();
      
      // Check for pending deletion request
      const checkDeletionStatus = async () => {
        try {
          // Temporary: simulate checking deletion status
          // In real implementation, this would call the API
          const savedDeletion = null; // await fetch('/api/account/delete?action=status&userId=' + user.id)
          
          if (savedDeletion) {
            setDeletionScheduled({
              scheduledFor: savedDeletion.scheduledFor,
              deletionId: savedDeletion.deletionId
            });
          }
        } catch (error) {
        }
      };
      
      if (mounted) {
        if (!error && data) {
          setName(data.name || '');
          setEmail(data.email || '');
          setPhone(digitsOnly(data.phone) || '');
          setBio(data.bio || '');
          setPronouns(data.pronouns || '');
          setIsTrusted(!!data.is_trusted);
          setTrustedSince(data.trusted_since || null);
          setLastActiveAt(data.last_active_at || null);
          setAvatarPath(data.avatar_path || null);
          // Resolve avatar URL from either avatar_url (may be http or storage key) or avatar_path
          const avatarField = data.avatar_url || data.avatar_path || '';
          if (avatarField && /^https?:/i.test(avatarField)) {
            setAvatarUrl(avatarField);
          } else if (avatarField) {
            try {
              const { data: urlData } = await supabase.storage
                .from('profile-images')
                .createSignedUrl(avatarField, 3600);
              setAvatarUrl(urlData?.signedUrl ?? null);
            } catch {
              setAvatarUrl(null);
            }
          } else {
            setAvatarUrl(null);
          }
        }
        
        await checkDeletionStatus();
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  // Security: Rate limiting and validation functions
  const checkRateLimit = useCallback((field, maxPerHour = 5, cooldownMinutes = 2) => {
    const now = Date.now();
    const lastUpdate = lastUpdateTimes[field];
    const count = updateCounts[field];
    
    // Check cooldown period (prevent rapid-fire updates)
    if (now - lastUpdate < cooldownMinutes * 60 * 1000) {
      const remainingTime = Math.ceil((cooldownMinutes * 60 * 1000 - (now - lastUpdate)) / 1000);
      throw new Error(`Please wait ${remainingTime} seconds before updating ${field} again.`);
    }
    
    // Check hourly limit
    const oneHourAgo = now - (60 * 60 * 1000);
    if (lastUpdate > oneHourAgo && count >= maxPerHour) {
      throw new Error(`You've reached the maximum ${maxPerHour} ${field} updates per hour. Please try again later.`);
    }
    
    return true;
  }, [lastUpdateTimes, updateCounts]);

  const updateRateLimit = useCallback((field) => {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    setLastUpdateTimes(prev => ({ ...prev, [field]: now }));
    setUpdateCounts(prev => ({
      ...prev,
      [field]: prev[field] > oneHourAgo ? prev[field] + 1 : 1
    }));
  }, []);

  const validateInput = useCallback((field, value) => {
    switch (field) {
      case 'email':
        if (!value || value.length < 5 || value.length > 254) {
          throw new Error('Email must be between 5 and 254 characters.');
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          throw new Error('Please enter a valid email address.');
        }
        // Check for suspicious patterns
        if (/(.)\1{4,}/.test(value)) { // 5+ repeated characters
          throw new Error('Email contains suspicious patterns.');
        }
        break;
        
      case 'phone':
        const digits = digitsOnly(value);
        if (digits.length !== 10) {
          throw new Error('Phone number must be exactly 10 digits.');
        }
        // Check for obviously fake numbers
        if (/^(\d)\1{9}$/.test(digits)) { // All same digit
          throw new Error('Please enter a valid phone number.');
        }
        break;
        
      case 'bio':
        if (value && value.length > 55) {
          throw new Error('Bio cannot exceed 55 characters.');
        }
        // Check for spam patterns
        if (value && /https?:\/\//.test(value)) {
          throw new Error('URLs are not allowed in bio.');
        }
        if (value && /(.)\1{10,}/.test(value)) { // 10+ repeated characters
          throw new Error('Bio contains suspicious patterns.');
        }
        break;
        
      case 'pronouns':
        if (value && value.length > 50) {
          throw new Error('Pronouns cannot exceed 50 characters.');
        }
        // Only allow common pronoun patterns
        if (value && !/^[a-zA-Z\/\s,.-]+$/.test(value)) {
          throw new Error('Pronouns can only contain letters, spaces, and common punctuation.');
        }
        break;
    }
    return true;
  }, []);

  // Name is uneditable per product decision

  const handleChangeEmail = useCallback(async () => {
    const next = (email || '').trim();
    
    try {
      // Security checks
      checkRateLimit('email', 3, 5); // Max 3 per hour, 5 min cooldown
      validateInput('email', next);
      
      setSaving(true);
      
      // Get user token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Authentication required');
      
      // Connectivity probe and fallback POST
      await connectivityProbe();
      const result = await postEmailUpdateWithFallback(next, session.access_token);
      
      // Update rate limiting
      updateRateLimit('email');
      
      setPendingEmail(next);
      setEmailCode('');
      setEmailStage('current');
      setVerifyKind('email');
      setVerifyModalOpen(true);
    } catch (e) {
      Alert.alert('Error', e.message || 'Unable to update email.');
    } finally {
      setSaving(false);
    }
  }, [email, checkRateLimit, validateInput, updateRateLimit]);

  const verifyEmailCode = useCallback(async () => {
    const codeToVerify = (emailCode || '').trim();
    if (!pendingEmail || codeToVerify.length !== 6) {
      Alert.alert('Missing info', 'Enter the 6-digit code.');
      return;
    }

    try {
      setEmailVerifying(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Authentication required');

      if (emailStage === 'current') {
        // Verify current factor (SMS to current phone), advance
        await connectivityProbe();
        await postVerifyCurrentWithFallback(codeToVerify, session.access_token);
        setEmailStage('new');
        setEmailCode('');
        // For link flow, close modal and instruct user to click link
        setVerifyModalOpen(false);
        Alert.alert('Check your new email', 'We sent a verification link to your new email. Click it to finish.');
        return;
      }
      // emailStage === 'new' no longer requires code entry (link-based)
      Alert.alert('Check your new email', 'Please use the verification link we sent to complete the change.');
    } catch (e) {
      Alert.alert('Error', e.message || 'Unable to verify email.');
    } finally {
      setEmailVerifying(false);
    }
  }, [pendingEmail, emailCode, emailStage]);

  const handleImagePicker = useCallback(async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow access to your photo library to upload a profile picture.');
        return;
      }

      // Show action sheet
      Alert.alert(
        'Update Profile Picture',
        'Choose an option',
        [
          { text: 'Camera', onPress: () => openCamera() },
          { text: 'Photo Library', onPress: () => openImagePicker() },
          { text: 'Remove Photo', onPress: () => removeAvatar(), style: 'destructive' },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Unable to access image picker');
    }
  }, []);

  const openCamera = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow camera access to take a profile picture.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Unable to open camera');
    }
  }, []);

  const openImagePicker = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Unable to open image picker');
    }
  }, []);

  const uploadProfileImage = useCallback(async (imageUri) => {
    try {
      setSaving(true);
      // prevent double taps while network in-flight
      if (saving) return;
      
      // Get user token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Authentication required');
      }
      
      // Upload image
      const result = await uploadAvatar(imageUri, session.access_token);
      
      // Update local state
      setAvatarUrl(result.avatar_url);
      setAvatarPath(result.avatar_path);
      
      Alert.alert('Success', 'Profile picture updated successfully!');
    } catch (error) {
      Alert.alert('Upload Failed', error.message || 'Unable to upload image. Please try again.');
    } finally {
      setSaving(false);
    }
  }, []);

  // simple password checks
  const validatePassword = useCallback((pwd) => {
    if (!pwd || pwd.length < 8) throw new Error('Password must be at least 8 characters.');
    if (!/[A-Za-z]/.test(pwd) || !/\d/.test(pwd)) throw new Error('Use letters and numbers.');
    if (/\s/.test(pwd)) throw new Error('No spaces allowed in password.');
    return true;
  }, []);

  const handleChangePassword = useCallback(async () => {
    try {
      if (pwdSaving) return;
      setPwdSaving(true);
      if (!currentPwd) throw new Error('Enter your current password.');
      validatePassword(newPwd);
      if (newPwd !== confirmPwd) throw new Error('Passwords do not match.');

      // Re-authenticate to prove current password
      const loginEmail = (email || user?.email || '').trim();
      if (!loginEmail) throw new Error('Email not available for re-auth. Try again.');
      const reauth = await supabase.auth.signInWithPassword({ email: loginEmail, password: currentPwd });
      if (reauth?.error) throw new Error('Current password is incorrect.');

      const upd = await supabase.auth.updateUser({ password: newPwd });
      if (upd?.error) throw new Error(upd.error.message || 'Failed to update password.');

      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
      Alert.alert('Success', 'Your password has been updated.');
    } catch (e) {
      Alert.alert('Error', e.message || 'Unable to update password.');
    } finally {
      setPwdSaving(false);
    }
  }, [pwdSaving, currentPwd, newPwd, confirmPwd, email, user?.email, validatePassword]);

  const removeAvatar = useCallback(async () => {
    try {
      setSaving(true);
      
      // Get user token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Authentication required');
      }
      
      // Delete avatar
      const response = await fetch(`${API_BASE_URL}/api/profile/avatar`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to remove avatar');
      }
      
      // Update local state
      setAvatarUrl(null);
      setAvatarPath(null);
      
      Alert.alert('Success', 'Profile picture removed successfully!');
    } catch (error) {
      Alert.alert('Error', error.message || 'Unable to remove profile picture.');
    } finally {
      setSaving(false);
    }
  }, []);

  const requestPhoneCode = useCallback(async () => {
    const digits = digitsOnly(phone);
    
    try {
      // Security checks
      checkRateLimit('phone', 3, 10); // Max 3 per hour, 10 min cooldown (higher for SMS)
      validateInput('phone', digits);
      
      setRequesting(true);
      if (!session?.access_token) throw new Error('Not authenticated');
      await connectivityProbe();
      await postPhoneStartWithFallback(digits, session.access_token);
      
      // Update rate limiting
      updateRateLimit('phone');
      
      setRequestedPhone(digits);
      setCooldown(30);
      setPhoneStage('current');
      setVerifyKind('phone');
      setVerifyModalOpen(true);
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not request code.');
    } finally {
      setRequesting(false);
    }
  }, [phone, checkRateLimit, validateInput, updateRateLimit, session?.access_token]);

  const verifyPhoneCode = useCallback(async () => {
    const digits = requestedPhone;
    if (digits.length !== 10 || !code.trim()) {
      Alert.alert('Missing info', 'Enter the 6-digit code.');
      return;
    }
    setVerifying(true);
    try {
      if (phoneStage === 'current') {
        // Verify current email code; backend returns next step and pending new_phone
        const res = await fetch(`${API_BASE_URL}/api/profile/phone/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify({ code: code.trim() })
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Verification failed.');
        setPhoneStage('new');
        setCode('');
        // Send Twilio Verify OTP to the new phone now
        try {
          await fetch(`${API_BASE_URL}/api/phone/request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
            body: JSON.stringify({ phone: digits })
          });
        } catch {}
        return;
      }

      // phoneStage === 'new' → verify OTP sent to the new phone and apply
      await connectivityProbe();
      await postPhoneVerifyNewWithFallback(digits, code.trim(), session.access_token);

      setPhone(digits);
      setRequestedPhone('');
      setCode('');
      setPhoneStage(null);
      Alert.alert('Verified', 'Your phone has been updated.');
    } catch (e) {
      Alert.alert('Error', e.message || 'Unable to verify phone.');
    } finally {
      setVerifying(false);
    }
  }, [requestedPhone, code, session?.access_token, phoneStage]);

  const handleDeleteAccount = useCallback(async () => {
    Alert.alert(
      'Delete Account',
      'This permanently removes your account and RSVP history. You\'ll have 1 hour to cancel this request.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: async () => {
            try {
              setSaving(true);
              
              // Temporary: simulate API response for testing
              await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
              const result = { success: true, deletion_id: 'test-123', scheduled_for: new Date(Date.now() + 3600000).toISOString() };
              
              // Real API call (uncomment when backend is ready):
              /*
              const response = await fetch(`${API_BASE_URL}/api/account/delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  action: 'request',
                  userId: user.id 
                })
              });
              
              
              
              if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
              }
              
              const result = await response.json();
              */
              
              if (result.success) {
                // Set deletion state to show countdown timer
                setDeletionScheduled({
                  scheduledFor: result.scheduled_for || new Date(Date.now() + 3600000).toISOString(),
                  deletionId: result.deletion_id || 'test-123'
                });
                
                Alert.alert(
                  'Deletion Scheduled',
                  `Your account will be deleted in 1 hour. You can cancel this request anytime using the timer below.`,
                  [{ text: 'OK' }]
                );
              } else {
                Alert.alert('Error', result.error || 'Failed to schedule account deletion');
              }
            } catch (error) {
              Alert.alert('Error', `Network error: ${error.message}`);
            } finally {
              setSaving(false);
            }
          }
        }
      ]
    );
  }, [user?.id]);

  const handleUndoDeletion = useCallback(async () => {
    if (!deletionScheduled) return;
    
    try {
      setSaving(true);
      
      // Temporary: simulate cancellation
      await new Promise(resolve => setTimeout(resolve, 500));
      const result = { success: true };
      
      // Real API call (uncomment when backend is ready):
      /*
      const response = await fetch(`${API_BASE_URL}/api/account/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'cancel',
          userId: user.id 
        })
      });
      
      const result = await response.json();
      */
      
      if (result.success) {
        setDeletionScheduled(null);
        setTimeRemaining(null);
        Alert.alert('Deletion Cancelled', 'Your account deletion has been cancelled.');
      } else {
        Alert.alert('Error', result.error || 'Failed to cancel deletion');
      }
    } catch (error) {
      Alert.alert('Error', `Network error: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }, [deletionScheduled, user?.id]);

  // resend cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  // deletion countdown timer
  useEffect(() => {
    if (!deletionScheduled) {
      setTimeRemaining(null);
      return;
    }

    const updateTimer = () => {
      const now = new Date().getTime();
      const scheduledTime = new Date(deletionScheduled.scheduledFor).getTime();
      const remaining = Math.max(0, scheduledTime - now);
      
      if (remaining <= 0) {
        // Deletion time has passed
        setDeletionScheduled(null);
        setTimeRemaining(null);
        Alert.alert('Account Deleted', 'Your account has been permanently deleted.');
        return;
      }
      
      setTimeRemaining(remaining);
    };

    updateTimer(); // Initial update
    const timer = setInterval(updateTimer, 1000);
    
    return () => clearInterval(timer);
  }, [deletionScheduled]);

  if (loading) {
    return (
      <LinearGradient colors={[ '#FFFFFF', '#FFE5D9' ]} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <AppHeader />
          <View style={{ flex:1, justifyContent:'center', alignItems:'center' }}>
            <ActivityIndicator color={LAVENDER} size="large" />
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['rgba(203,180,227,0.2)', 'rgba(255,200,162,0.4)']} style={{ flex: 1 }} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top', 'left', 'right']}>
        <AppHeader onAvatarPress={() => {}} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView ref={scrollRef} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={{ padding: 16, paddingBottom: 8 }}>
              <Text style={{ 
                fontSize: 28, 
                fontWeight: 'bold', 
                color: '#1f2937',
                marginBottom: 4
              }}>
                Profile & Settings
              </Text>
              <Text style={{ fontSize: 16, color: '#6b7280' }}>
                Minimal on purpose. We keep profiles light so the energy stays on the event—not clout.
              </Text>
            </View>

            {/* Public Profile Preview */}
            <View style={styles.profileSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Public Profile</Text>
                <Text style={styles.sectionSubtitle}>How others see you</Text>
                <Text style={[styles.sectionSubtitle, { marginTop: 4, fontStyle: 'italic' }]}>
                  Basics only. Name, face, couple lines. That's it.
                </Text>
              </View>
              
              <View style={styles.publicProfileCard}>
                <View style={{ flexDirection:'row', alignItems:'flex-start' }}>
                  <View style={{ marginRight: 16 }}>
                    {avatarUrl ? (
                      <Image source={{ uri: avatarUrl }} style={styles.publicAvatar} />
                    ) : (
                      <View style={[styles.publicAvatar,{ justifyContent:'center', alignItems:'center', backgroundColor:'rgba(186, 164, 235, 0.15)' }]}>
                        <Ionicons name="person" size={28} color="#6b7280" />
                      </View>
                    )}
                    <TouchableOpacity 
                      style={styles.editAvatarBtn} 
                      onPress={handleImagePicker}
                      disabled={saving}
                    >
                      <Ionicons name="camera" size={12} color="#fff" />
                    </TouchableOpacity>
                  </View>
                  <View style={{ flex:1 }}>
                    <Text style={styles.publicName}>{name}</Text>
                    {!!pronouns && <Text style={styles.publicPronouns}>{pronouns}</Text>}
                    {isTrusted && (
                      <View style={{ flexDirection:'row', alignItems:'center', marginTop: 6 }}>
                        <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
                        <Text style={styles.publicTrusted}>Verified Host{trustedSince ? ` • since ${new Date(trustedSince).toLocaleDateString('en-US',{ month:'short', year:'numeric' })}` : ''}</Text>
                      </View>
                    )}
                    {!!bio && (
                      <Text numberOfLines={2} style={styles.publicBio}>"{bio}"</Text>
                    )}
                  </View>
                </View>
              </View>
              
              {/* Profile Picture Nudge */}
              {!avatarUrl && (
                <View style={styles.profileNudge}>
                  <Ionicons name="camera-outline" size={16} color="#f59e0b" style={{ marginRight: 8 }} />
                  <Text style={styles.profileNudgeText}>
                    Add a profile photo so people recognize you at events
                  </Text>
                </View>
              )}
            </View>
            <View style={{ height: 8 }} />

            {/* Account Settings */}
            <HostSection title="Account Settings" icon="settings" anchorKey="email" setSectionY={setSectionY}>
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Email Address</Text>
                <TextInput
                  style={styles.hostInput}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="you@example.com"
                  placeholderTextColor="#9ca3af"
                  value={email}
                  onChangeText={setEmail}
                />
                <Text style={styles.settingHint}>Private. Used for RSVPs, receipts, and account help. Never for spam.</Text>
                {(!user?.email_confirmed_at || pendingEmail || emailStage) ? (
                  <Text style={[styles.settingHint, { color: '#f59e0b', marginTop: 8 }]}>Pending verification — follow the steps to finish.</Text>
                ) : (
                  <Text style={[styles.settingHint, { color: '#22c55e', marginTop: 8 }]}>All set — you're verified.</Text>
                )}
                <TouchableOpacity style={styles.hostBtn} onPress={handleChangeEmail} disabled={saving}>
                  <Text style={styles.hostBtnText}>{saving ? 'Sending…' : 'Update Email'}</Text>
                </TouchableOpacity>
                {/* Code entry handled in verification modal */}
              </View>

              <View style={[styles.settingItem, { marginTop: 24 }]}>
                <Text style={styles.settingLabel}>Phone Number</Text>
                <TextInput
                  style={styles.hostInput}
                  keyboardType="phone-pad"
                  placeholder="5551234567"
                  placeholderTextColor="#9ca3af"
                  value={phone}
                  onChangeText={(v)=> setPhone(digitsOnly(v))}
                  maxLength={10}
                />
                <Text style={styles.settingHint}>Private. Helps hosts reach you if something changes. No spam, ever.</Text>
                {(!phone || phone.length !== 10 || requestedPhone || phoneStage) ? (
                  <Text style={[styles.settingHint, { color: '#f59e0b', marginTop: 8 }]}>Pending verification — follow the steps to finish.</Text>
                ) : (
                  <Text style={[styles.settingHint, { color: '#22c55e', marginTop: 8 }]}>Verified — you're good to go.</Text>
                )}
                {requestedPhone ? (
                  <></>
                ) : (
                  <TouchableOpacity style={[styles.hostBtn, { backgroundColor: '#CBB4E3', marginTop: 8 }]} onPress={requestPhoneCode} disabled={requesting}>
                    <Text style={[styles.hostBtnText, { color: '#fff' }]}>{requesting ? 'Sending…' : 'Send Code'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </HostSection>

            {/* Profile Information */}
            <HostSection title="Profile Information" icon="person" anchorKey="pronouns" setSectionY={setSectionY}>
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Pronouns</Text>
                <TextInput
                  style={styles.hostInput}
                  placeholder="they/them, she/her, he/him"
                  placeholderTextColor="#9ca3af"
                  value={pronouns}
                  onChangeText={setPronouns}
                />
                <TouchableOpacity
                  style={styles.hostBtn}
                  onPress={async ()=>{ 
                    try { 
                      // Security checks
                      checkRateLimit('pronouns', 5, 1); // Max 5 per hour, 1 min cooldown
                      validateInput('pronouns', pronouns?.trim());
                      
                      setSaving(true);
                      
                      // Get user token
                      const { data: { session } } = await supabase.auth.getSession();
                      if (!session?.access_token) {
                        throw new Error('Authentication required');
                      }
                      
                      // Call secure backend endpoint
                      const result = await callSecureAPI('pronouns', { pronouns: pronouns?.trim() || null }, session.access_token);
                      
                      // Update rate limiting
                      updateRateLimit('pronouns');
                      
                      Alert.alert('Save success', result.message || 'Profile updated.'); 
                    } catch(e){ 
                      Alert.alert('Error', e.message||'Failed to save.'); 
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  <Text style={styles.hostBtnText}>Save Pronouns</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.settingItem, { marginTop: 24 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={styles.settingLabel}>Bio</Text>
                  <Text style={[styles.settingHint, { marginTop: 0, fontSize: 12, color: '#9ca3af' }]}>
                    {bio?.length || 0}/55
                  </Text>
                </View>
                <TextInput
                  style={[styles.hostInput,{ minHeight: 100, textAlignVertical:'top' }]}
                  placeholder="Tell people what you're about…"
                  placeholderTextColor="#9ca3af"
                  value={bio}
                  onChangeText={setBio}
                  multiline
                  maxLength={55}
                />
                <Text style={styles.settingHint}>Couple lines about you. Keep it human.</Text>
                <TouchableOpacity
                  style={styles.hostBtn}
                  onPress={async ()=>{ 
                    try{ 
                      // Security checks
                      checkRateLimit('bio', 10, 1); // Max 10 per hour, 1 min cooldown
                      validateInput('bio', bio?.trim());
                      
                      setSaving(true);
                      
                      // Get user token
                      const { data: { session } } = await supabase.auth.getSession();
                      if (!session?.access_token) {
                        throw new Error('Authentication required');
                      }
                      
                      // Call secure backend endpoint
                      const result = await callSecureAPI('bio', { bio: bio?.trim() || null }, session.access_token);
                      
                      // Update rate limiting
                      updateRateLimit('bio');
                      
                      Alert.alert('Save success', result.message || 'Profile updated.'); 
                    } catch(e){ 
                      Alert.alert('Error', e.message||'Failed to save.'); 
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  <Text style={styles.hostBtnText}>Save Bio</Text>
                </TouchableOpacity>
              </View>
            </HostSection>

            {/* Security */}
            <HostSection title="Security" icon="lock-closed" defaultOpen={false}>
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Change Password</Text>
                <TextInput
                  style={styles.hostInput}
                  secureTextEntry={!showPwd.current}
                  placeholder="Current password"
                  placeholderTextColor="#9ca3af"
                  value={currentPwd}
                  onChangeText={setCurrentPwd}
                />
                <TextInput
                  style={[styles.hostInput, { marginTop: 8 }]}
                  secureTextEntry={!showPwd.next}
                  placeholder="New password (min 8, letters & numbers)"
                  placeholderTextColor="#9ca3af"
                  value={newPwd}
                  onChangeText={setNewPwd}
                />
                <TextInput
                  style={[styles.hostInput, { marginTop: 8 }]}
                  secureTextEntry={!showPwd.confirm}
                  placeholder="Confirm new password"
                  placeholderTextColor="#9ca3af"
                  value={confirmPwd}
                  onChangeText={setConfirmPwd}
                />
                <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop: 8 }}>
                  <TouchableOpacity onPress={()=> setShowPwd(p=>({ ...p, current: !p.current }))}>
                    <Text style={styles.settingHint}>{showPwd.current ? 'Hide current' : 'Show current'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={()=> setShowPwd(p=>({ ...p, next: !p.next }))}>
                    <Text style={styles.settingHint}>{showPwd.next ? 'Hide new' : 'Show new'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={()=> setShowPwd(p=>({ ...p, confirm: !p.confirm }))}>
                    <Text style={styles.settingHint}>{showPwd.confirm ? 'Hide confirm' : 'Show confirm'}</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={[styles.hostBtn, { backgroundColor: '#CBB4E3', marginTop: 12 }]} onPress={handleChangePassword} disabled={pwdSaving}>
                  <Text style={[styles.hostBtnText, { color:'#fff' }]}>{pwdSaving ? 'Updating…' : 'Update Password'}</Text>
                </TouchableOpacity>
              </View>
            </HostSection>

            {/* Account Actions */}
            <HostSection title="Account Actions" icon="settings-outline" defaultOpen={false}>
              <TouchableOpacity 
                style={styles.accountAction} 
                onPress={() => handleDeleteAccount()}
              >
                <Text style={[styles.accountActionText, { color: '#dc2626' }]}>Delete account</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.accountAction} onPress={() => Alert.alert('Sign Out', 'Coming soon')}>
                <Text style={styles.accountActionText}>Sign out</Text>
              </TouchableOpacity>
            </HostSection>

            <View style={{ height: 24 }} />
            
            {/* Verification Nudge */}
            {(!user?.email_confirmed_at || !phone || phone.length !== 10) && (
              <View style={styles.verificationNudge}>
                <Text style={styles.verificationNudgeText}>
                  Verify your contact info to get RSVP updates.
                </Text>
              </View>
            )}

            {/* Support & Legal */}
            <View style={styles.footerSection}>
              <Text style={styles.footerSectionTitle}>Support & Legal</Text>
              <View style={styles.linksRow}>
                <TouchableOpacity style={styles.footerLink} onPress={() => Alert.alert('Community Guidelines', 'Coming soon')}>
                  <Text style={styles.footerLinkText}>Community Guidelines</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.footerLink} onPress={() => Alert.alert('Safety Center', 'Coming soon')}>
                  <Text style={styles.footerLinkText}>Safety Center</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.footerLink} onPress={() => Alert.alert('Privacy', 'Coming soon')}>
                  <Text style={styles.footerLinkText}>Privacy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.footerLink} onPress={() => Alert.alert('Terms', 'Coming soon')}>
                  <Text style={styles.footerLinkText}>Terms</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* System Info */}
            <View style={styles.systemInfo}>
              <View style={styles.hairline} />
              <Text style={styles.systemInfoText}>
                VybeLocal v1.0.0 (dev)
              </Text>
              <Text style={styles.systemInfoText}>
                Made with care in El Paso.
              </Text>
            </View>
            
            <View style={{ height: 32 }} />
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Verification Modal */}
        {verifyModalOpen && (
          <ModalCard 
            visible={verifyModalOpen}
            onClose={() => { setVerifyModalOpen(false); setVerifyKind(null); }}
            title={verifyKind === 'email' ? (emailStage === 'current' ? 'Verify via SMS' : 'Verify new email') : (phoneStage === 'current' ? 'Verify via Email' : 'Verify new phone')}
          >
            <View>
              <Text style={styles.settingHint}>
                {verifyKind === 'email'
                  ? (emailStage === 'current'
                      ? `Enter the 6-digit code sent to your current phone to continue changing to ${pendingEmail}.`
                      : `Enter the 6-digit code sent to ${pendingEmail} to finish.`)
                  : (phoneStage === 'current'
                      ? `Enter the 6-digit code sent to your email to continue changing your phone.`
                      : `Enter the code sent to +1 ${requestedPhone} to finish.`)
                }
              </Text>
              {/* Removed blocking alert; rely on modal only */}
              <TextInput
                style={[styles.hostInput,{ marginTop: 12 }]}
                keyboardType="number-pad"
                placeholder="123456"
                placeholderTextColor="#9ca3af"
                value={verifyKind === 'email' ? emailCode : code}
                onChangeText={verifyKind === 'email' ? setEmailCode : setCode}
                maxLength={6}
              />
              <TouchableOpacity 
                style={[styles.hostBtn, { backgroundColor: '#CBB4E3', marginTop: 10 }]}
                onPress={verifyKind === 'email' ? verifyEmailCode : verifyPhoneCode}
                disabled={verifyKind === 'email' ? emailVerifying : verifying}
              >
                <Text style={[styles.hostBtnText, { color: '#fff' }]}>Verify</Text>
              </TouchableOpacity>
              {verifyKind === 'phone' && (
                <Text style={[styles.settingHint,{ textAlign:'center', marginTop:12 }]}>
                  {cooldown>0 ? `Didn't get it? Resend in ${cooldown}s.` : ''}
                </Text>
              )}
              {verifyKind === 'phone' && cooldown===0 && (
                <TouchableOpacity style={[styles.hostBtn,{ marginTop:8 }]} onPress={requestPhoneCode}>
                  <Text style={styles.hostBtnText}>Resend Code</Text>
                </TouchableOpacity>
              )}
            </View>
          </ModalCard>
        )}

        {/* Deletion Countdown Timer */}
        {deletionScheduled && timeRemaining && (
          <DeletionCountdownBanner 
            timeRemaining={timeRemaining}
            onUndo={handleUndoDeletion}
            saving={saving}
          />
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

function formatTimeRemaining(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

function DeletionCountdownBanner({ timeRemaining, onUndo, saving }) {
  const { bottom } = useSafeAreaInsets();
  
  return (
    <View style={[styles.deletionBanner, { paddingBottom: Math.max(bottom, 16) }]}>
      <View style={styles.deletionBannerContent}>
        <View style={{ flex: 1 }}>
          <Text style={styles.deletionBannerTitle}>Account Deletion Scheduled</Text>
          <Text style={styles.deletionBannerTimer}>
            Deleting in {formatTimeRemaining(timeRemaining)}
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.undoButton} 
          onPress={onUndo}
          disabled={saving}
        >
          <Text style={styles.undoButtonText}>
            {saving ? 'Cancelling...' : 'Undo'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Chip({ icon, label, onPress }){
  return (
    <TouchableOpacity onPress={onPress} style={{ flexDirection:'row', alignItems:'center', paddingVertical:8, paddingHorizontal:12, backgroundColor:'rgba(240,235,250,0.9)', borderRadius:999, borderWidth:1, borderColor:'#BAA4EB' }}>
      <Ionicons name={icon} size={16} color={MIDNIGHT} style={{ marginRight:6 }} />
      <Text style={{ color: MIDNIGHT, fontWeight:'700', fontSize:12 }}>{label}</Text>
    </TouchableOpacity>
  );
}

function HostSection({ title, children, defaultOpen = false, icon, anchorKey, setSectionY }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <View style={styles.hostSection} onLayout={(e)=> setSectionY && setSectionY(anchorKey, e.nativeEvent.layout.y)}>
      <TouchableOpacity 
        onPress={() => setIsOpen(!isOpen)} 
        style={styles.hostSectionHeader}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {icon && <Ionicons name={icon} size={20} color="#1f2937" style={{ marginRight: 12 }} />}
          <Text style={styles.hostSectionTitle}>{title}</Text>
        </View>
        <Ionicons 
          name={isOpen ? 'chevron-up' : 'chevron-down'} 
          size={20} 
          color="#6b7280" 
        />
      </TouchableOpacity>
      
      {isOpen && (
        <View style={styles.hostSectionContent}>
          {children}
        </View>
      )}
    </View>
  );
}

function Accordion({ title, open, onToggle, children, anchorKey, setSectionY }){
  return (
    <View onLayout={(e)=> setSectionY && setSectionY(anchorKey, e.nativeEvent.layout.y)}>
      <TouchableOpacity onPress={onToggle} style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical:12 }}>
        <Text style={{ color: MIDNIGHT, fontWeight:'800' }}>{title}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={MIDNIGHT} />
      </TouchableOpacity>
      {open && (
        <View style={{ paddingBottom: 4 }}>
          {children}
        </View>
      )}
    </View>
  );
}

function ModalCard({ visible, onClose, title, children }){
  if (!visible) return null;
  return (
    <View style={{ position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'rgba(0,0,0,0.6)', justifyContent:'center', alignItems:'center', padding:16 }}>
      <View style={{ backgroundColor:'#fff', borderRadius:16, padding:16, width:'92%', maxWidth:420 }}>
        <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <Text style={{ color: MIDNIGHT, fontWeight:'800', fontSize:16 }}>{title}</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={20} color={MIDNIGHT} />
          </TouchableOpacity>
        </View>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24,
  },
  // Profile Section Styles
  profileSection: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  publicProfileCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  publicAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  editAvatarBtn: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#6b7280',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  publicName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 2,
  },
  publicPronouns: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: 2,
  },
  publicTrusted: {
    fontSize: 12,
    color: '#22c55e',
    fontWeight: '600',
    marginLeft: 6,
  },
  publicBio: {
    fontSize: 14,
    color: '#374151',
    marginTop: 8,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  // Host Section Styles
  hostSection: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  hostSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  hostSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  hostSectionContent: {
    padding: 16,
  },
  settingItem: {
    marginBottom: 8,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  settingHint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 6,
    lineHeight: 16,
  },
  hostInput: {
    backgroundColor: '#f9fafb',
    color: '#1f2937',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    fontSize: 14,
  },
  hostBtn: {
    marginTop: 12,
    backgroundColor: 'white',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  hostBtnText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 14,
  },
  // Legacy styles (keeping for compatibility)
  previewCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BAA4EB',
    padding: 14,
    shadowColor: '#BAA4EB',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    marginBottom: 12,
  },
  previewAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#BAA4EB',
  },
  previewName: { color: MIDNIGHT, fontWeight: '800', fontSize: 16 },
  previewPronouns: { color: '#6b7280', fontWeight: '600', fontSize: 12, marginTop: 2 },
  previewTrusted: { color: '#22c55e', fontWeight: '600', fontSize: 12, marginLeft: 6 },
  previewBio: { color: MIDNIGHT, marginTop: 10, fontStyle:'italic' },
  quickRow: { flexDirection:'row', flexWrap:'wrap', gap: 8, marginTop: 12 },
  helperTiny: { color:'#4b5563', fontSize: 11, marginTop: 8 },
  header: {
    color: MIDNIGHT,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 12,
    marginBottom: 12,
  },
  subHeader: {
    backgroundColor: 'rgba(203, 180, 227, 0.15)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(186, 164, 235, 0.4)',
    marginBottom: 12,
  },
  subHeaderTitle: {
    color: MIDNIGHT,
    fontWeight: '800',
    fontSize: 14,
  },
  subHeaderTag: {
    color: MIDNIGHT,
    fontWeight: '700',
    fontSize: 12,
    marginTop: 2,
  },
  subHeaderCopy: {
    color: '#4b5563',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  label: {
    color: MIDNIGHT,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: 'rgba(240,235,250,0.9)',
    color: MIDNIGHT,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(180,168,209,0.8)',
  },
  hint: {
    color: '#4b5563',
    fontSize: 12,
    marginTop: 6,
  },
  primaryBtn: {
    marginTop: 12,
    backgroundColor: LAVENDER,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: LAVENDER,
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(186,164,235,0.6)',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '800',
  },
  secondaryBtn: {
    marginTop: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: LAVENDER,
  },
  secondaryBtnText: {
    color: MIDNIGHT,
    fontWeight: '800',
  },
  sectionDivider: {
    height: 1,
    backgroundColor: 'rgba(186, 164, 235, 0.3)',
    marginVertical: 16,
  },
  editImageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(240,235,250,0.9)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#BAA4EB',
  },
  editImageBtnText: {
    color: MIDNIGHT,
    fontWeight: '700',
    fontSize: 14,
  },
  // Profile Nudge Styles
  profileNudge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.2)',
  },
  profileNudgeText: {
    fontSize: 12,
    color: '#92400e',
    fontWeight: '500',
    flex: 1,
  },
  // Footer Styles
  verificationNudge: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.2)',
  },
  verificationNudgeText: {
    fontSize: 12,
    color: '#92400e',
    textAlign: 'center',
    fontWeight: '500',
  },
  footerSection: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  footerSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  linksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  footerLink: {
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  footerLinkText: {
    fontSize: 14,
    color: '#6b7280',
    textDecorationLine: 'underline',
  },
  accountAction: {
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  accountActionText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  systemInfo: {
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  hairline: {
    height: 1,
    backgroundColor: '#e5e7eb',
    width: '100%',
    marginBottom: 12,
  },
  systemInfoText: {
    fontSize: 10,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 14,
  },
  // Deletion Banner Styles
  deletionBanner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#dc2626',
    paddingTop: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  deletionBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deletionBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  deletionBannerTimer: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  undoButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minWidth: 80,
    alignItems: 'center',
  },
  undoButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#dc2626',
  },
});


