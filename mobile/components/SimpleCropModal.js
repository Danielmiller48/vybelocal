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

export default function SimpleCropModal({ visible, imageUri, onClose, onCrop, aspectRatio = [4, 3] }) {
  const scrollViewRef = useRef(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [cropRegion, setCropRegion] = useState({ x: 0, y: 0, zoom: 1 });
  const [modalKey, setModalKey] = useState(0);

  // Reset modal completely when it becomes visible
  React.useEffect(() => {
    if (visible) {
      setModalKey(prev => prev + 1); // Force remount of ScrollView
      setImageSize({ width: 0, height: 0 }); // Reset image size
      setCropRegion({ x: 0, y: 0, zoom: 1 }); // Reset crop region
    }
  }, [visible]);

  // Helper function to constrain scroll position based on zoom
  const constrainScrollPosition = (x, y, zoom) => {
    if (!imageSize.width || !imageSize.height) return { x, y };
    
    // Calculate the actual displayed size of the zoomed image
    const zoomedWidth = imageSize.width * zoom;
    const zoomedHeight = imageSize.height * zoom;
    
    // Only constrain if image is larger than crop frame
    // When zoomed out smaller than crop frame, center it instead
    if (zoomedWidth <= CROP_WIDTH && zoomedHeight <= CROP_HEIGHT) {
      // Image is smaller than crop frame - center it
      return {
        x: Math.max(0, (zoomedWidth - CROP_WIDTH) / 2),
        y: Math.max(0, (zoomedHeight - CROP_HEIGHT) / 2)
      };
    }
    
    // Image is larger than crop frame - constrain to prevent black bars
    const maxX = Math.max(0, zoomedWidth - CROP_WIDTH);
    const maxY = Math.max(0, zoomedHeight - CROP_HEIGHT);
    
    return {
      x: Math.max(0, Math.min(x, maxX)),
      y: Math.max(0, Math.min(y, maxY))
    };
  };

  // EventCard dimensions - dynamic aspect ratio
  const CROP_WIDTH = SCREEN_W * 0.9;
  const CROP_HEIGHT = CROP_WIDTH * (aspectRatio[1] / aspectRatio[0]); // Use provided aspect ratio

  const handleImageLoad = () => {
    if (imageUri) {
      Image.getSize(imageUri, (width, height) => {
        setImageSize({ width, height });
        
        // Scale image so it's larger than crop area in BOTH dimensions for scrolling
        const scaleToFitWidth = CROP_WIDTH / width;
        const scaleToFitHeight = CROP_HEIGHT / height;
        // Use the smaller scale but ensure minimum size for scrolling
        const baseScale = Math.min(scaleToFitWidth, scaleToFitHeight);
        const scale = Math.max(baseScale * 1.5, 1); // Ensure image is 50% larger for scrolling room
        const scaledWidth = width * scale;
        const scaledHeight = height * scale;
        
        setImageSize({ width: scaledWidth, height: scaledHeight });
        
        // Calculate minimum zoom to ensure image always covers crop rectangle
        const minZoomToFillWidth = CROP_WIDTH / scaledWidth;
        const minZoomToFillHeight = CROP_HEIGHT / scaledHeight;
        const calculatedMinZoom = Math.max(minZoomToFillWidth, minZoomToFillHeight, 0.1);
        
        // Reset zoom and center the image after a brief delay
        setTimeout(() => {
          if (scrollViewRef.current) {
            // Set the calculated minimum zoom
            scrollViewRef.current.setNativeProps({ 
              minimumZoomScale: calculatedMinZoom,
              zoomScale: 1 
            });
            
            // Then center the image
            const centerX = Math.max(0, (scaledWidth - CROP_WIDTH) / 2);
            const centerY = Math.max(0, (scaledHeight - CROP_HEIGHT) / 2);
            
            scrollViewRef.current.scrollTo({
              x: centerX,
              y: centerY,
              animated: false
            });
            
            // Reset the crop region state to match
            setCropRegion({
              x: centerX,
              y: centerY,
              zoom: 1
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
          // Calculate the scale factor from displayed image to original image
          const scaleToOriginal = originalWidth / imageSize.width;
          
          // Account for zoom scale - when zoomed in, we need to adjust our calculations
          const zoomScale = cropRegion.zoom || 1;
          
          // Get the crop rectangle coordinates in the original image
          const cropX = (cropRegion.x / zoomScale) * scaleToOriginal;
          const cropY = (cropRegion.y / zoomScale) * scaleToOriginal;
          const cropWidth = (CROP_WIDTH / zoomScale) * scaleToOriginal;
          const cropHeight = (CROP_HEIGHT / zoomScale) * scaleToOriginal;

          // Ensure crop coordinates are valid
          const finalCropX = Math.max(0, Math.min(cropX, originalWidth - 1));
          const finalCropY = Math.max(0, Math.min(cropY, originalHeight - 1));
          const finalCropWidth = Math.min(cropWidth, originalWidth - finalCropX);
          const finalCropHeight = Math.min(cropHeight, originalHeight - finalCropY);

          // Ensure minimum crop size
          const minCropWidth = Math.max(finalCropWidth, 100);
          const minCropHeight = Math.max(finalCropHeight, 50);

          const result = await ImageManipulator.manipulateAsync(
            imageUri,
            [{ 
              crop: { 
                originX: Math.round(finalCropX), 
                originY: Math.round(finalCropY), 
                width: Math.round(minCropWidth), 
                height: Math.round(minCropHeight) 
              } 
            }],
            { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
          );
          
          onCrop(result.uri);
        } catch (error) {
          onClose();
        }
      });
    } catch (error) {
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
          {/* Scrollable Image */}
          <View style={styles.scrollContainer}>
            <ScrollView
            key={modalKey} // Force remount when modal opens
            ref={scrollViewRef}
            style={[styles.scrollView, { width: CROP_WIDTH, height: CROP_HEIGHT }]}
            contentContainerStyle={{
              width: imageSize.width,
              height: imageSize.height,
            }}
            minimumZoomScale={0.1}
            maximumZoomScale={3}
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
                zoom: event.nativeEvent.zoomScale || 1
              });
            }}
            onScrollEndDrag={(event) => {
              const { contentOffset, zoomScale } = event.nativeEvent;
              const zoom = zoomScale || 1;
              const zoomedWidth = imageSize.width * zoom;
              const zoomedHeight = imageSize.height * zoom;
              
              // Only snap back if there's a massive black bar (more than 50% of crop frame)
              const blackBarThreshold = 0.5;
              const maxOffsetX = zoomedWidth - CROP_WIDTH * (1 - blackBarThreshold);
              const maxOffsetY = zoomedHeight - CROP_HEIGHT * (1 - blackBarThreshold);
              const minOffsetX = -CROP_WIDTH * blackBarThreshold;
              const minOffsetY = -CROP_HEIGHT * blackBarThreshold;
              
              let newX = contentOffset.x;
              let newY = contentOffset.y;
              let needsAdjustment = false;
              
              // Only constrain if we're way out of bounds
              if (contentOffset.x > maxOffsetX) {
                newX = maxOffsetX;
                needsAdjustment = true;
              } else if (contentOffset.x < minOffsetX) {
                newX = minOffsetX;
                needsAdjustment = true;
              }
              
              if (contentOffset.y > maxOffsetY) {
                newY = maxOffsetY;
                needsAdjustment = true;
              } else if (contentOffset.y < minOffsetY) {
                newY = minOffsetY;
                needsAdjustment = true;
              }
              
              if (needsAdjustment) {
                scrollViewRef.current?.scrollTo({
                  x: newX,
                  y: newY,
                  animated: true
                });
              }
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
            
            {/* Crop Frame Overlay - positioned over the ScrollView */}
            <View style={styles.cropFrame} pointerEvents="none">
              <View style={[styles.cropRect, { width: CROP_WIDTH, height: CROP_HEIGHT }]} />
            </View>
          </View>
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
  scrollContainer: {
    position: 'relative',
  },
  cropFrame: {
    position: 'absolute',
    top: 0,
    left: 0,
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