import React, { useRef, useState } from 'react';
import { Animated, Dimensions, TouchableOpacity, StyleSheet, ScrollView, View, Share } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import colors from '../theme/colors';

export default function HomeDrawerOverlay() {
  const sheetH = Dimensions.get('window').height * 0.6;
  const peek = 28; // visible portion when closed
  const sheetY = useRef(new Animated.Value(sheetH - peek)).current;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigation = useNavigation();

  const openPos = sheetH * 0.35 - 100; // open 100px higher for more content space
  const openSheet = () => {
    Animated.timing(sheetY, { toValue: openPos, duration: 300, useNativeDriver: true }).start();
    setDrawerOpen(true);
  };
  const closeSheet = () => {
    Animated.timing(sheetY, { toValue: sheetH - peek, duration: 300, useNativeDriver: true }).start();
    setDrawerOpen(false);
  };
  const toggleSheet = () => {
    drawerOpen ? closeSheet() : openSheet();
  };

  return (
    <Animated.View style={[styles.container, { height: sheetH, transform: [{ translateY: sheetY }] }]}>
      {/* Handle */}
      <TouchableOpacity
        onPress={toggleSheet}
        style={styles.handleTouch}
        hitSlop={{ top: 16, bottom: 16, left: 20, right: 20 }}
      >
        <View style={styles.handleCircle}>
          <Ionicons
            name="chevron-up-sharp"
            size={28}
            color="#fff"
            style={{ transform: [{ rotate: drawerOpen ? '180deg' : '0deg' }] }}
          />
        </View>
      </TouchableOpacity>

      {/* Inner shell */}
      <View style={styles.drawerInner}>
        {/* White to peach gradient background */}
        <LinearGradient
          colors={['#FFFFFF', '#FFE5D9']}
          start={{x:0,y:0}} 
          end={{x:0,y:1}}
          style={[StyleSheet.absoluteFill, { borderTopLeftRadius: 16, borderTopRightRadius: 16 }]}
          pointerEvents="none"
        />
        
        {/* Border overlay - transparent center with curved border */}
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          borderWidth: 2,
          borderColor: '#BAA4EB',
          backgroundColor: 'transparent',
          pointerEvents: 'none',
          zIndex: 100
        }} />
        
        {/* Grab handle */}
        <View style={{ position:'absolute', top:8, alignSelf:'center', width:56, height:6, borderRadius:3, backgroundColor:'rgba(255,255,255,0.45)', zIndex:10 }} />
        
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 40, paddingBottom: 66 }}>
          <View style={{ marginTop: 24 }}>
            {[
              {
                key: 'upcoming',
                label: 'Upcoming Vybes',
                icon: 'sparkles-outline',
                action: () => {
                  closeSheet();
                  navigation.navigate('HomeMain');
                },
              },
              {
                key: 'calendar',
                label: 'View Full Calendar',
                icon: 'calendar-outline',
                action: () => {
                  closeSheet();
                  navigation.navigate('Calendar');
                },
              },
              {
                key: 'tracked-hosts',
                label: 'Tracked Hosts',
                icon: 'people-outline',
                action: () => {
                  closeSheet();
                  // TODO: Navigate to tracked hosts screen
                },
              },
              {
                key: 'past',
                label: 'See Past Vybes',
                icon: 'time-outline',
                action: () => {
                  closeSheet();
                  // TODO: Past vybes implementation
                },
              },
              {
                key: 'invite',
                label: 'Invite to VybeLocal',
                icon: 'share-social-outline',
                action: async () => {
                  closeSheet();
                  await Share.share({ message: 'Join me on VybeLocal! https://vybelocal.com/app' });
                },
              },
              {
                key: 'guidelines',
                label: 'Community Guidelines',
                icon: 'document-text-outline',
                action: () => {
                  closeSheet();
                  navigation.navigate('Guidelines');
                },
              },
            ].map((row) => (
              <TouchableOpacity key={row.key} style={styles.actionRow} onPress={row.action}>
                <Ionicons
                  name={row.icon}
                  size={24}
                  color="#3C3450"
                  style={{
                    marginRight: 14,
                  }}
                />
                <View>
                  <Animated.Text style={styles.rowText}>{row.label}</Animated.Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'visible',
    zIndex: 20,
    elevation: 20,
  },
  handleTouch: {
    position: 'absolute',
    top: -28,
    alignSelf: 'center',
    zIndex: 1000,
    elevation: 1000,
  },
  handleCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#BAA4EB',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#BAA4EB',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
  },
  drawerInner: {
    flex: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
    borderWidth: 0,
    shadowColor: '#BAA4EB',
    shadowOpacity: 0.8,
    shadowRadius: 50,
    shadowOffset: { width: 0, height: -20 },
    elevation: 50,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: 'rgba(240,235,250,0.9)',
    borderRadius: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: 'rgba(180,168,209,0.8)',
    shadowColor: '#BAA4EB',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  rowText: {
    color: '#3C3450',
    fontSize: 18,
    fontWeight: '600',
  },
}); 