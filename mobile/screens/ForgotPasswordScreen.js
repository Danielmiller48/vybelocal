import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import colors from '../theme/colors';
import { supabase } from '../utils/supabase';

export default function ForgotPasswordScreen(){
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const navigation = useNavigation();

  const handleSend = async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const redirectTo = 'https://vybelocal.com/reset';
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (error) throw new Error(error.message);
      setSent(true);
    } catch (e) {
      setError(e.message || 'Failed to send reset link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={[colors.primary, colors.secondary]} style={styles.container} start={{x:0,y:0}} end={{x:1,y:1}}>
      <KeyboardAvoidingView style={{ flex:1, padding:20, justifyContent:'center' }} behavior={Platform.OS==='ios'?'padding':'height'}>
        <View>
          <Text style={styles.title}>Reset Password</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ alignSelf:'center', marginBottom:12 }}>
            <Text style={{ color:'#fff' }}>Back to login</Text>
          </TouchableOpacity>
          {sent ? (
            <Text style={styles.info}>If that email exists, we sent a reset link.</Text>
          ) : (
            <>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <TextInput
                style={styles.input}
                placeholder="Your email"
                placeholderTextColor="#ffffffaa"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
              <TouchableOpacity style={[styles.button, (!email||loading)&&styles.buttonDisabled]} onPress={handleSend} disabled={!email||loading}>
                {loading ? <ActivityIndicator color="#fff"/> : <Text style={styles.buttonText}>Send reset link</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container:{ flex:1 },
  title:{ color:'#fff', fontSize:22, fontWeight:'800', textAlign:'center', marginBottom:16 },
  info:{ color:'#fff', textAlign:'center' },
  input:{ width:'100%', backgroundColor:'#ffffff22', borderRadius:12, paddingVertical:12, paddingHorizontal:16, color:'#fff' },
  button:{ width:'100%', backgroundColor:'#ffffff33', borderRadius:12, paddingVertical:14, alignItems:'center', marginTop:16 },
  buttonDisabled:{ opacity:0.6 },
  buttonText:{ color:'#fff', fontWeight:'700' },
  error:{ color:'#ffd6d6', textAlign:'center', marginBottom:10 },
});


