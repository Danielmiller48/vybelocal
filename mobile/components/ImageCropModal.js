import React, { useState, useRef, useEffect } from 'react';
import { Modal, StyleSheet, Dimensions, TouchableOpacity, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import { PanGestureHandler, PinchGestureHandler } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedGestureHandler, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import { Image as RNImage } from 'react-native';
const AnimatedImage = Animated.createAnimatedComponent(RNImage);

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_H = 200;

export default function ImageCropModal({ uri, visible, onClose, onCrop }){
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale      = useSharedValue(1);

  const [imgSize,setImgSize] = useState({ w:0,h:0 });

  useEffect(()=>{
    if(!uri) return;
    RNImage.getSize(uri,(w,h)=>{
      setImgSize({ w, h });
      const baseScale = SCREEN_W / w;
      scale.value = baseScale;
    });
  },[uri]);

  // clampPosition no longer used during gesture

  const clampJS = (tx, ty, scl)=>{
    if(!imgSize.w) return { tx, ty };
    const renderW = imgSize.w * scl;
    const renderH = imgSize.h * scl;
    const frameTop = (Dimensions.get('window').height/2)-CARD_H/2;
    const frameLeft = 0;
    const frameRight = SCREEN_W;
    const frameBottom = frameTop + CARD_H;
    const halfW = renderW/2;
    const halfH = renderH/2;
    const minX = frameRight - halfW - SCREEN_W/2;
    const maxX = frameLeft + halfW - SCREEN_W/2;
    const minY = frameBottom - halfH - Dimensions.get('window').height/2;
    const maxY = frameTop + halfH - Dimensions.get('window').height/2;
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
      runOnJS(()=>{
        const result = clampJS(translateX.value, translateY.value, scale.value);
        translateX.value = result.tx;
        translateY.value = result.ty;
      })();
    }
  });

  const pinchHandler = useAnimatedGestureHandler({
    onStart: (_, ctx) => {
      ctx.startScale = scale.value;
    },
    onActive: (e, ctx) => {
      scale.value = Math.max(SCREEN_W/imgSize.w, ctx.startScale * e.scale);
    },
    onEnd: () => {
      runOnJS(()=>{
        const result = clampJS(translateX.value, translateY.value, scale.value);
        translateX.value = result.tx;
        translateY.value = result.ty;
      })();
    }
  });

  const imgStyle = useAnimatedStyle(()=>({
    transform:[{ translateX: translateX.value },{ translateY: translateY.value },{ scale: scale.value }]
  }));

  async function handleCrop(){
    // convert frame to image space
    const renderW = imgSize.w * scale.value;
    const renderH = imgSize.h * scale.value;

    const offsetX = (SCREEN_W/2 - translateX.value) - renderW/2;
    const offsetY = (Dimensions.get('window').height/2 - translateY.value) - renderH/2;

    const originX = (-offsetX) * (imgSize.w / renderW);
    const originY = (-offsetY) * (imgSize.h / renderH);

    const cropW = SCREEN_W * (imgSize.w / renderW);
    const cropH = CARD_H * (imgSize.h / renderH);

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
  frameBorder:{ position:'absolute', left:0, width:SCREEN_W, height:CARD_H, top:(Dimensions.get('window').height/2)-CARD_H/2, borderColor:'#fff', borderWidth:2 },
}); 