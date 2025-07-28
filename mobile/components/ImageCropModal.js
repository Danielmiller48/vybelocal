import React, { useState, useRef, useEffect } from 'react';
import { Modal, StyleSheet, Dimensions, TouchableOpacity, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import { PanGestureHandler, PinchGestureHandler } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedGestureHandler, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import { Image as RNImage } from 'react-native';
const AnimatedImage = Animated.createAnimatedComponent(RNImage);

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const SCREEN_HALF_W = SCREEN_W / 2;
const SCREEN_HALF_H = SCREEN_H / 2;
const CARD_H = 200;
const FRAME_TOP = SCREEN_HALF_H - CARD_H / 2;
const FRAME_BOTTOM = FRAME_TOP + CARD_H;

export default function ImageCropModal({ uri, visible, onClose, onCrop }){
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale      = useSharedValue(1);

  const [imgSize,setImgSize] = useState({ w:0,h:0 });
  const imgW = useSharedValue(0);
  const imgH = useSharedValue(0);

  useEffect(()=>{
    if(!uri) return;
    RNImage.getSize(uri,(w,h)=>{
      setImgSize({ w, h });
      imgW.value = w;
      imgH.value = h;
      const coverScale = Math.max(SCREEN_W / w, CARD_H / h);
      scale.value = coverScale < 1 ? 1 : coverScale; // never start smaller than 1:1
    });
  },[uri]);

  // clampPosition no longer used during gesture

  const clampWorklet = (tx, ty, scl)=>{
    'worklet';
    if(imgW.value===0) return { tx, ty };
    const renderW = imgW.value * scl;
    const renderH = imgH.value * scl;
    const halfW = renderW/2;
    const halfH = renderH/2;
    const minX = (SCREEN_W - halfW) - SCREEN_HALF_W; // right edge align
    const maxX = halfW - SCREEN_HALF_W;             // left edge align
    const minY = FRAME_BOTTOM - halfH - SCREEN_HALF_H;
    const maxY = FRAME_TOP + halfH - SCREEN_HALF_H;
    const clampedX = Math.min(Math.max(tx, minX), maxX);
    const clampedY = Math.min(Math.max(ty, minY), maxY);
    return { tx: clampedX, ty: clampedY };
  };

  const panHandler = useAnimatedGestureHandler({
    onStart: (_, ctx) => {
      ctx.startX = translateX.value;
      ctx.startY = translateY.value;
    },
    onActive: (e, ctx) => {
      translateX.value = ctx.startX + e.translationX;
      translateY.value = ctx.startY + e.translationY;
    },
    onEnd: () => {
      const res = clampWorklet(translateX.value, translateY.value, scale.value);
      translateX.value = withTiming(res.tx);
      translateY.value = withTiming(res.ty);
    }
  });

  const pinchHandler = useAnimatedGestureHandler({
    onStart: (_, ctx) => {
      ctx.startScale = scale.value;
    },
    onActive: (e, ctx) => {
      scale.value = Math.max(1, ctx.startScale * e.scale);
    },
    onEnd: () => {
      const r = clampWorklet(translateX.value, translateY.value, scale.value);
      translateX.value = withTiming(r.tx);
      translateY.value = withTiming(r.ty);
    }
  });

  const imgStyle = useAnimatedStyle(()=>({
    transform:[{ translateX: translateX.value },{ translateY: translateY.value },{ scale: scale.value }]
  }));

  async function handleCrop(){
    // convert frame to image space
    const renderW = imgW.value * scale.value;
    const renderH = imgH.value * scale.value;

    const offsetX = (SCREEN_HALF_W - translateX.value) - renderW/2;
    const offsetY = (SCREEN_HALF_H - translateY.value) - renderH/2;

    const originX = (-offsetX) * (imgW.value / renderW);
    const originY = (-offsetY) * (imgH.value / renderH);

    const cropW = SCREEN_W * (imgW.value / renderW);
    const cropH = CARD_H * (imgH.value / renderH);

    const rect = { originX, originY, width: cropW, height: cropH };

    const result = await ImageManipulator.manipulateAsync(uri,[{ crop: rect }],{ compress:0.8, format:ImageManipulator.SaveFormat.JPEG });
    onCrop(result.uri);
  }

  return (
    <Modal visible={visible} animationType="slide">
      <GestureHandlerRootView style={styles.container}>
        {/* top bar */}
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <PinchGestureHandler onGestureEvent={pinchHandler}>
          <Animated.View style={{ flex:1 }}>
            <PanGestureHandler onGestureEvent={panHandler}>
              <AnimatedImage source={{ uri }} style={[styles.image,imgStyle]} resizeMode="contain" />
            </PanGestureHandler>
            {/* dim outside */}
            <View style={styles.dim} pointerEvents="none" />
            <View style={styles.frameBorder} pointerEvents="none" />
          </Animated.View>
        </PinchGestureHandler>
        <TouchableOpacity style={styles.doneBtn} onPress={handleCrop}>
          <Text style={{ color:'#fff', fontSize:16, fontWeight:'600' }}>Done</Text>
        </TouchableOpacity>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container:{ flex:1, backgroundColor:'#000' },
  closeBtn:{ position:'absolute', top:40, right:20, zIndex:10 },
  doneBtn:{ position:'absolute', bottom:40, alignSelf:'center', backgroundColor:'#4caf50', paddingHorizontal:30, paddingVertical:12, borderRadius:30 },
  image:{ width:'100%', height:'100%' },
  dim:{ position:'absolute', top:0,left:0,right:0,bottom:0, backgroundColor:'rgba(0,0,0,0.5)' },
  frameBorder:{ position:'absolute', width:SCREEN_W, height:CARD_H, top: FRAME_TOP, borderWidth:2, borderColor:'#fff' },
}); 