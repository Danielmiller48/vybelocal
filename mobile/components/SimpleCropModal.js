import React, { useState, useRef } from 'react';
import { 
  Modal, 
  View, 
  Image, 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  Dimensions, 
  ScrollView 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function SimpleCropModal({ visible, imageUri, onClose, onCrop }) {
  const scrollViewRef = useRef(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [cropRegion, setCropRegion] = useState({ x: 0, y: 0, zoom: 1 });

  // EventCard dimensions - 1:2 aspect ratio (width:height)
  const CROP_WIDTH = SCREEN_W * 0.8;
  const CROP_HEIGHT = CROP_WIDTH * 0.5; // 1:2 ratio means height is half of width

  const handleImageLoad = () => {
    if (imageUri) {
      Image.getSize(imageUri, (width, height) => {
        setImageSize({ width, height });
        
        // Calculate scale to fit image nicely in crop area (not too zoomed)
        const scaleToFitWidth = CROP_WIDTH / width;
        const scaleToFitHeight = CROP_HEIGHT / height;
        const scale = Math.min(scaleToFitWidth, scaleToFitHeight) * 1.2; // Scale to fit + 20% extra for cropping
        const scaledWidth = width * scale;
        const scaledHeight = height * scale;
        
        setImageSize({ width: scaledWidth, height: scaledHeight });
        
        // Center the image after a brief delay
        setTimeout(() => {
          if (scrollViewRef.current) {
            scrollViewRef.current.scrollTo({
              x: Math.max(0, (scaledWidth - CROP_WIDTH) / 2),
              y: Math.max(0, (scaledHeight - CROP_HEIGHT) / 2),
              animated: false
            });
          }
        }, 100);
      });
    }
  };

  const handleCrop = async () => {
    if (!imageUri || !imageSize.width) return;

    try {
      Image.getSize(imageUri, async (originalWidth, originalHeight) => {
        try {
          const scaleX = originalWidth / imageSize.width;
          const scaleY = originalHeight / imageSize.height;
          
          const cropX = cropRegion.x * scaleX;
          const cropY = cropRegion.y * scaleY;
          const cropWidth = CROP_WIDTH * scaleX;
          const cropHeight = CROP_HEIGHT * scaleY;

          // Ensure crop doesn't exceed image bounds
          const finalCropX = Math.max(0, Math.min(cropX, originalWidth - cropWidth));
          const finalCropY = Math.max(0, Math.min(cropY, originalHeight - cropHeight));
          const finalCropWidth = Math.min(cropWidth, originalWidth - finalCropX);
          const finalCropHeight = Math.min(cropHeight, originalHeight - finalCropY);

          const result = await ImageManipulator.manipulateAsync(
            imageUri,
            [{ 
              crop: { 
                originX: finalCropX, 
                originY: finalCropY, 
                width: finalCropWidth, 
                height: finalCropHeight 
              } 
            }],
            { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
          );

          onCrop(result.uri);
        } catch (error) {
          console.warn('Crop error:', error);
          onClose();
        }
      });
    } catch (error) {
      console.warn('Image size error:', error);
      onClose();
    }
  };

  if (!visible || !imageUri) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Crop Image</Text>
          <TouchableOpacity onPress={handleCrop} style={styles.headerBtn}>
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Crop Area */}
        <View style={styles.cropContainer}>
          {/* Crop Frame Overlay */}
          <View style={styles.cropFrame} pointerEvents="none">
            <View style={[styles.cropRect, { width: CROP_WIDTH, height: CROP_HEIGHT }]} />
          </View>

          {/* Scrollable Image */}
          <ScrollView
            ref={scrollViewRef}
            style={[styles.scrollView, { width: CROP_WIDTH, height: CROP_HEIGHT }]}
            contentContainerStyle={{
              width: Math.max(CROP_WIDTH, imageSize.width),
              height: Math.max(CROP_HEIGHT, imageSize.height),
            }}
            minimumZoomScale={0.5}
            maximumZoomScale={2}
            zoomScale={1}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            bounces={false}
            alwaysBounceVertical={false}
            alwaysBounceHorizontal={false}
            onScroll={(event) => {
              setCropRegion({
                x: event.nativeEvent.contentOffset.x,
                y: event.nativeEvent.contentOffset.y,
                zoom: 1
              });
            }}
            scrollEventThrottle={16}
          >
            <Image
              source={{ uri: imageUri }}
              style={{
                width: imageSize.width,
                height: imageSize.height,
              }}
              onLoad={handleImageLoad}
              resizeMode="cover"
            />
          </ScrollView>
        </View>

        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={styles.instructionText}>
            Drag to position your image within the crop frame
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerBtn: {
    minWidth: 60,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  doneText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cropContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cropFrame: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  cropRect: {
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 8,
  },
  scrollView: {
    backgroundColor: 'transparent',
  },
  instructions: {
    padding: 20,
    alignItems: 'center',
  },
  instructionText: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
  },
}); 