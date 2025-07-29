import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import colors from '../theme/colors';

const FILTERS = [
  { key: 'week', label: 'This Week' },
  { key: 'weekend', label: 'This Weekend' },
  { key: 'all', label: 'All Events' },
];

export default function DateFilterBar({ active = 'all', onChange }) {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {FILTERS.map(f => {
          const isActive = active === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.pill, isActive && styles.activePill]}
              onPress={() => onChange?.(f.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.pillText, isActive && styles.activeText]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      
      {/* Fade overlay that extends into event space */}
      <LinearGradient
        colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0)']}
        locations={[0, 1]}
        style={styles.fadeOverlay}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 0, paddingBottom: 4 },
  scrollContent: { paddingHorizontal: 12, alignItems: 'center', justifyContent:'center', flexGrow:1 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    marginRight: 8,
  },
  activePill: { backgroundColor: colors.secondary, shadowColor: colors.secondary, shadowOpacity:0.7, shadowRadius:4, shadowOffset:{ width:0, height:0 }, elevation:4 },
  pillText: { fontSize: 12, color: '#fff' },
  activeText: { color: '#fff', fontWeight: '600' },
  fadeOverlay: {
    position: 'absolute',
    bottom: -20,
    left: 0,
    right: 0,
    height: 20,
    zIndex: 5,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
}); 