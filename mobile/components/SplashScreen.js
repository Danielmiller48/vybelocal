// mobile/components/SplashScreen.js
import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet, ImageBackground } from 'react-native';
import colors from '../theme/colors';

export default function SplashScreen({ onFinish, duration = 1500 }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // fade out after slight delay
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 600, useNativeDriver: true }).start(() => onFinish?.());
    }, duration);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity }]}> 
      <ImageBackground source={require('../assets/splash-image.png')} style={styles.bg} resizeMode="contain">
      </ImageBackground>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container:{ position:'absolute', top:0, left:0, right:0, bottom:0, zIndex:9999 },
  bg:{ flex:1, width:'100%', height:'100%', backgroundColor:'#000', justifyContent:'center', alignItems:'center' },
}); 