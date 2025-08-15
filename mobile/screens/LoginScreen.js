// mobile/screens/LoginScreen.js
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import colors from '../theme/colors';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const navigation = useNavigation();

  const handleSignIn = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    const { error } = await signIn(email.trim(), password);
    if (error) {
      setError(error.message);
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
        <ScrollView
          contentContainerStyle={styles.inner}
          keyboardShouldPersistTaps="handled"
         >
        <Text style={styles.brand}>VybeLocal.</Text>
        <Text style={styles.tagline}>Where Real Beats Reel</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>

        {error && <Text style={styles.error}>{error}</Text>}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#ffffffaa"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={[styles.input, { marginTop: 12 }]}
          placeholder="Password"
          placeholderTextColor="#ffffffaa"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.button, (!email || !password || loading) && styles.buttonDisabled]}
          onPress={handleSignIn}
          activeOpacity={0.8}
          disabled={!email || !password || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign in</Text>
          )}
        </TouchableOpacity>



        {/* Link to Register */}
        <TouchableOpacity onPress={() => navigation.navigate('Register')} style={{ marginTop: 18 }}>
          <Text style={{ color:'#fff' }}>Don't have an account? <Text style={{ fontWeight:'700' }}>Register</Text></Text>
        </TouchableOpacity>
        </ScrollView>
       </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
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
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  oauthButton: {
    width: '100%',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  error: {
    color: '#ffccd5',
    marginBottom: 12,
    textAlign: 'center',
  },
}); 