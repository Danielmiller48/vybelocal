// mobile/screens/RegisterScreen.js
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../auth/AuthProvider';
import colors from '../theme/colors';
// Base URL for backend API; adjust via env var if needed
import Constants from 'expo-constants';
const API_BASE = Constants.expoConfig?.extra?.apiBaseUrl || process.env?.EXPO_PUBLIC_WEB_URL || 'https://vybelocal.com';

export default function RegisterScreen() {
  const navigation = useNavigation();

  // step: 'form' | 'code'
  const [step, setStep] = useState('form');

  // form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /* helper format phone xxx-xxx-xxxx */
  const formatPhone = (v) => {
    const d = v.replace(/\D/g, '').slice(0, 10);
    if (d.length < 4) return d;
    if (d.length < 7) return `${d.slice(0,3)}-${d.slice(3)}`;
    return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`;
  };

  /* Step 1: send SMS */
  const handleStart = async () => {
    if (loading) return;
    if (password !== confirm) { setError('Passwords do not match'); return; }
    const fullName = `${firstName.trim()} ${lastName.trim()}`.replace(/\s+/g,' ');
    if (!firstName.trim() || !lastName.trim()) { setError('Please enter your name'); return; }
    if (!/^\S+@\S+\.\S+$/.test(email)) { setError('Enter a valid email'); return; }
    if (!/^\d{3}-\d{3}-\d{4}$/.test(phone)) { setError('Enter a valid phone e.g. 123-456-7890'); return; }
    if (password.length < 8) { setError('Password must be at least 8 chars'); return; }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/register/signup`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({
          name: fullName,
          email,
          phone: `+1${phone.replace(/\D/g,'')}`,
          password,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Signup error');
      }
      setStep('code');
    } catch (err) {
      const msg = err.response?.data || 'Signup error';
      setError(typeof msg === 'string' ? msg : 'Signup error');
    }
    setLoading(false);
  };

  /* Step 2: verify code */
  const handleVerify = async () => {
    if (loading) return;
    if (code.length !== 6) { setError('Enter 6-digit code'); return; }
    const fullName = `${firstName.trim()} ${lastName.trim()}`.replace(/\s+/g,' ');
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/register/verify`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({
          name: fullName,
          email,
          phone: `+1${phone.replace(/\D/g,'')}`,
          password,
          code,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Verify error');
      }
      Alert.alert('Success', 'Account created! Please log in.', [
        { text:'OK', onPress: () => navigation.navigate('Login') }
      ]);
    } catch (err) {
      const msg = err.response?.data || 'Verify error';
      setError(typeof msg === 'string' ? msg : 'Verify error');
    }
    setLoading(false);
  };

  return (
    <LinearGradient
      colors={[colors.primary, colors.secondary]}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <KeyboardAvoidingView
        style={{ flex:1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
          <Text style={styles.brand}>VybeLocal.</Text>
          <Text style={styles.tagline}>Where Real Beats Reel</Text>
          <Text style={styles.subtitle}>{step==='form' ? 'Create an account' : 'Verify number'}</Text>

          {error && <Text style={styles.error}>{error}</Text>}

          {step==='form' ? (
            <>
              <View style={{ flexDirection:'row', width:'100%' }}>
                <TextInput
                  style={[styles.input, { flex:1, marginRight:6 }]}
                  placeholder="First name"
                  placeholderTextColor="#ffffffaa"
                  value={firstName}
                  onChangeText={setFirstName}
                />
                <TextInput
                  style={[styles.input, { flex:1, marginLeft:6 }]}
                  placeholder="Last name"
                  placeholderTextColor="#ffffffaa"
                  value={lastName}
                  onChangeText={setLastName}
                />
              </View>
              <TextInput
                style={[styles.input, { marginTop: 12 }]}
                placeholder="Email"
                placeholderTextColor="#ffffffaa"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TextInput
                style={[styles.input, { marginTop: 12 }]}
                placeholder="123-456-7890"
                placeholderTextColor="#ffffffaa"
                value={phone}
                onChangeText={(v)=>setPhone(formatPhone(v))}
                keyboardType="number-pad"
              />
              <TextInput
                style={[styles.input, { marginTop: 12 }]}
                placeholder="Password"
                placeholderTextColor="#ffffffaa"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              <TextInput
                style={[styles.input, { marginTop: 12 }]}
                placeholder="Confirm Password"
                placeholderTextColor="#ffffffaa"
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry
              />
            </>
          ) : (
            <TextInput
              autoFocus
              style={[styles.input, { letterSpacing:4 } ]}
              placeholder="123456"
              placeholderTextColor="#ffffffaa"
              value={code}
              onChangeText={(v)=>setCode(v.replace(/\D/g,'').slice(0,6))}
              keyboardType="number-pad"
            />
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={ step==='form' ? handleStart : handleVerify }
            activeOpacity={0.8}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{ step==='form' ? 'Continue' : 'Verify & Create' }</Text>
            )}
          </TouchableOpacity>

          {step==='form' ? (
            <TouchableOpacity onPress={() => navigation.navigate('Login')} style={{ marginTop: 18 }}>
              <Text style={{ color:'#fff' }}>Already have an account? <Text style={{ fontWeight:'700' }}>Sign in</Text></Text>
            </TouchableOpacity>
          ) : null }
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  brand: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
    fontFamily: 'SpaceGrotesk',
  },
  tagline: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 20,
    marginTop: 4,
    fontWeight: '500',
  },
  subtitle: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 24,
  },
  input: {
    width: '100%',
    backgroundColor: '#ffffff22',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    color: '#fff',
  },
  button: {
    width: '100%',
    backgroundColor: '#ffffff33',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  error: { color: '#ffccd5', marginBottom: 12, textAlign: 'center' },
}); 