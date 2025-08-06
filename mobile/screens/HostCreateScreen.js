import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Animated, Modal, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import colors from '../theme/colors';
import AppHeader from '../components/AppHeader';
import { SafeAreaView } from 'react-native-safe-area-context';
import HostDrawerOverlay from '../components/HostDrawerOverlay';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../utils/supabase';
import Svg, { Polyline, Circle } from 'react-native-svg';

// Collapsible Section Component
function HostSection({ title, children, defaultOpen = false, icon, headerRight=null }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <View style={{
      backgroundColor: 'white',
      marginHorizontal: 16,
      marginVertical: 8,
      borderRadius: 12,
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    }}>
      {/* Header */}
      <TouchableOpacity
        onPress={() => setIsOpen(!isOpen)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 16,
          backgroundColor: '#f8f9fa',
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          borderBottomLeftRadius: isOpen ? 0 : 12,
          borderBottomRightRadius: isOpen ? 0 : 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {icon && (
            <Ionicons name={icon} size={20} color={colors.primary} style={{ marginRight: 12 }} />
          )}
          <Text style={{
            fontSize: 18, 
            fontWeight: '600', 
            color: '#1f2937' 
          }}>
            {title}
          </Text>
        </View>
        
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {headerRight}
          <View style={{
            padding: 4,
            borderRadius: 4,
            borderWidth: 1,
            borderColor: '#d1d5db',
            transform: [{ rotate: isOpen ? '180deg' : '0deg' }]
          }}>
            <Ionicons name="chevron-down" size={16} color="#6b7280" />
          </View>
        </View>
      </TouchableOpacity>

      {/* Content */}
      {isOpen && (
        <View style={{ 
          padding: 16, 
          borderBottomLeftRadius: 12,
          borderBottomRightRadius: 12,
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb'
        }}>
          {children}
        </View>
      )}
    </View>
  );
}

// Enhanced Event Card Component
function EventCard({ event, isPast = false }) {
  const progress = event.capacity > 0 ? (event.rsvp_count / event.capacity) : 0;
  const progressAnim = new Animated.Value(0);

  React.useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const getStatusBadge = (status) => {
    const badges = {
      'approved': { text: 'Published', color: '#10b981', bg: '#d1fae5' },
      'pending': { text: 'Scheduled', color: '#f59e0b', bg: '#fef3c7' },
      'cancelled': { text: 'Canceled', color: '#ef4444', bg: '#fee2e2' },
    };
    return badges[status] || badges.pending;
  };

  const badge = getStatusBadge(event.status);
  const eventDate = new Date(event.starts_at);
  const isToday = eventDate.toDateString() === new Date().toDateString();

  return (
    <View style={{
      backgroundColor: 'white',
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
      borderLeftWidth: 4,
      borderLeftColor: badge.color,
    }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#1f2937', marginBottom: 4 }}>
            {event.title}
          </Text>
          <Text style={{ fontSize: 12, color: '#6b7280' }}>
            {eventDate.toLocaleDateString()} • {event.vibe}
            {isToday && ' • TODAY'}
          </Text>
        </View>
        
        {/* Status Badge */}
        <View style={{
          backgroundColor: badge.bg,
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 6,
        }}>
          <Text style={{ fontSize: 10, fontWeight: '600', color: badge.color }}>
            {badge.text}
          </Text>
        </View>
      </View>

      {/* RSVP Progress Bar - Only show if capacity is set */}
      {event.rsvp_capacity && event.rsvp_capacity > 0 ? (
        <View style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text style={{ fontSize: 12, color: '#6b7280' }}>
              RSVPs: {event.rsvp_count} / {event.capacity}
            </Text>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>
              {Math.round(progress * 100)}%
            </Text>
          </View>
          
          {/* Progress Bar */}
          <View style={{
            height: 6,
            backgroundColor: '#e5e7eb',
            borderRadius: 3,
            overflow: 'hidden',
          }}>
            <Animated.View style={{
              height: '100%',
              backgroundColor: progress > 0.8 ? '#10b981' : progress > 0.5 ? '#f59e0b' : colors.primary,
              borderRadius: 3,
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            }} />
          </View>
        </View>
      ) : (
        /* Show just RSVP count without capacity/progress */
        <View style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: '#6b7280' }}>
              RSVPs: {event.rsvp_count}
            </Text>
            <Text style={{ fontSize: 10, color: '#9ca3af', fontStyle: 'italic' }}>
              No capacity limit
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

// View Toggle Component
function ViewToggle({ viewMode, onToggle }) {
  return (
    <View style={{
      flexDirection: 'row',
      backgroundColor: '#f3f4f6',
      borderRadius: 8,
      padding: 2,
      marginBottom: 16,
    }}>
      <TouchableOpacity
        onPress={() => onToggle('list')}
        style={{
          flex: 1,
          paddingVertical: 8,
          paddingHorizontal: 16,
          borderRadius: 6,
          backgroundColor: viewMode === 'list' ? 'white' : 'transparent',
          shadowColor: viewMode === 'list' ? '#000' : 'transparent',
          shadowOpacity: 0.1,
          shadowRadius: 2,
          elevation: viewMode === 'list' ? 2 : 0,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="list" size={16} color={viewMode === 'list' ? colors.primary : '#6b7280'} />
          <Text style={{
            marginLeft: 6,
            fontSize: 14,
            fontWeight: '500',
            color: viewMode === 'list' ? colors.primary : '#6b7280',
          }}>
            List
          </Text>
        </View>
      </TouchableOpacity>
      
      <TouchableOpacity
        onPress={() => onToggle('calendar')}
        style={{
          flex: 1,
          paddingVertical: 8,
          paddingHorizontal: 16,
          borderRadius: 6,
          backgroundColor: viewMode === 'calendar' ? 'white' : 'transparent',
          shadowColor: viewMode === 'calendar' ? '#000' : 'transparent',
          shadowOpacity: 0.1,
          shadowRadius: 2,
          elevation: viewMode === 'calendar' ? 2 : 0,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="calendar" size={16} color={viewMode === 'calendar' ? colors.primary : '#6b7280'} />
          <Text style={{
            marginLeft: 6,
            fontSize: 14,
            fontWeight: '500',
            color: viewMode === 'calendar' ? colors.primary : '#6b7280',
          }}>
            Calendar
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

// Event Time Toggle Component
function EventTimeToggle({ showPast, onToggle, upcomingCount, pastCount }) {
  return (
    <View style={{
      flexDirection: 'row',
      backgroundColor: '#f3f4f6',
      borderRadius: 8,
      padding: 2,
      marginBottom: 16,
    }}>
      <TouchableOpacity
        onPress={() => onToggle(false)}
        style={{
          flex: 1,
          paddingVertical: 8,
          paddingHorizontal: 16,
          borderRadius: 6,
          backgroundColor: !showPast ? 'white' : 'transparent',
          shadowColor: !showPast ? '#000' : 'transparent',
          shadowOpacity: 0.1,
          shadowRadius: 2,
          elevation: !showPast ? 2 : 0,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="calendar" size={16} color={!showPast ? colors.primary : '#6b7280'} />
          <Text style={{
            marginLeft: 6,
            fontSize: 14,
            fontWeight: '500',
            color: !showPast ? colors.primary : '#6b7280',
          }}>
            Current ({upcomingCount})
          </Text>
        </View>
      </TouchableOpacity>
      
      <TouchableOpacity
        onPress={() => onToggle(true)}
        style={{
          flex: 1,
          paddingVertical: 8,
          paddingHorizontal: 16,
          borderRadius: 6,
          backgroundColor: showPast ? 'white' : 'transparent',
          shadowColor: showPast ? '#000' : 'transparent',
          shadowOpacity: 0.1,
          shadowRadius: 2,
          elevation: showPast ? 2 : 0,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="checkmark-circle" size={16} color={showPast ? colors.primary : '#6b7280'} />
          <Text style={{
            marginLeft: 6,
            fontSize: 14,
            fontWeight: '500',
            color: showPast ? colors.primary : '#6b7280',
          }}>
            Past ({pastCount})
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

// Sort Toggle Component
function SortToggle({ sortBy, onToggle }) {
  return (
    <View style={{
      flexDirection: 'row',
      backgroundColor: '#f3f4f6',
      borderRadius: 8,
      padding: 2,
      marginBottom: 12,
    }}>
      <TouchableOpacity
        onPress={() => onToggle('date')}
        style={{
          flex: 1,
          paddingVertical: 6,
          paddingHorizontal: 12,
          borderRadius: 6,
          backgroundColor: sortBy === 'date' ? 'white' : 'transparent',
        }}
      >
        <Text style={{
          textAlign: 'center',
          fontSize: 12,
          fontWeight: '500',
          color: sortBy === 'date' ? colors.primary : '#6b7280',
        }}>
          By Date
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        onPress={() => onToggle('rsvps')}
        style={{
          flex: 1,
          paddingVertical: 6,
          paddingHorizontal: 12,
          borderRadius: 6,
          backgroundColor: sortBy === 'rsvps' ? 'white' : 'transparent',
        }}
      >
        <Text style={{
          textAlign: 'center',
          fontSize: 12,
          fontWeight: '500',
          color: sortBy === 'rsvps' ? colors.primary : '#6b7280',
        }}>
          By RSVPs
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// Placeholder Content Component
function PlaceholderContent({ icon, title, description }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 32 }}>
      <View style={{ 
        backgroundColor: '#f3f4f6', 
        padding: 16, 
        borderRadius: 50, 
        marginBottom: 16 
      }}>
        <Ionicons name={icon} size={32} color="#9ca3af" />
      </View>
      <Text style={{ 
        fontSize: 18, 
        fontWeight: '600', 
        color: '#1f2937', 
        marginBottom: 8,
        textAlign: 'center'
      }}>
        {title}
      </Text>
      <Text style={{ 
        fontSize: 14, 
        color: '#6b7280', 
        textAlign: 'center',
        marginBottom: 16,
        paddingHorizontal: 20,
        lineHeight: 20
      }}>
        {description}
      </Text>
      <Text style={{ 
        fontSize: 12, 
        color: '#9ca3af',
        fontStyle: 'italic'
      }}>
        Coming soon...
      </Text>
    </View>
  );
}

// Analytics Content Component

function AnalyticsContent({ events, paidOnly=false, setPaidOnly, joinDate }) {
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [timePeriod, setTimePeriod] = useState('ytd'); // 'all', 'ytd', '6months', 'month'
  
  const last30Days = new Date();
  last30Days.setDate(last30Days.getDate() - 30);
  
  // Initialize pastEvents if not available
  const pastEvents = [];

  // Calculate advanced analytics metrics
  const calculateAnalytics = () => {
    const relevantEvents = paidOnly ? (events || []).filter(e=>e.price_in_cents>0) : (events || []);
    const now = new Date();
    const pastEvents = relevantEvents.filter(e => new Date(e.starts_at) < now);
    const upcomingEvents = relevantEvents.filter(e => new Date(e.starts_at) >= now);
    const paidEvents = relevantEvents.filter(e => e.price_in_cents > 0);
    const eventsWithCapacity = relevantEvents.filter(e => e.rsvp_capacity && e.rsvp_capacity > 0);
    
    // Get stored analytics data
    const advancedData = global.hostAnalyticsData || {
      rsvpTimestamps: {},
      userRsvpHistory: {},
      paymentData: []
    };
    
    const analytics = {
      // Basic metrics
      totalEvents: relevantEvents.length,
      pastEvents: pastEvents.length,
      upcomingEvents: upcomingEvents.length,
      last30DayEvents: relevantEvents.filter(e => new Date(e.starts_at) >= last30Days).length,
      
      // RSVP metrics
      totalRsvps: relevantEvents.reduce((sum, event) => sum + (event.rsvp_count || 0), 0),
      last30DayRsvps: relevantEvents.filter(e => new Date(e.starts_at) >= last30Days)
        .reduce((sum, event) => sum + (event.rsvp_count || 0), 0),
      
      // Revenue metrics
      totalRevenue: relevantEvents.reduce((sum, event) => sum + ((event.price_in_cents || 0) * (event.rsvp_count || 0) / 100), 0),
      netRevenue: 0,
      
      // Performance metrics
      avgTicketPrice: 0,
      capacityFillRate: 0,
      sellOutSpeed: 0,
      revenuePerAttendee: 0,
      
      // Advanced behavioral metrics
      refundRate: 0,
      repeatGuestRate: 0,
      firstTimerRate: 0,
      
      // Timing insights
      rsvpSurgeWindow: {},
      avgRsvpsPerDay: 0,
      peakRsvpDay: 'Unknown',
      avgSellOutSpeed: 0,
    };

    // Calculate average ticket price
    if (paidEvents.length > 0) {
      analytics.avgTicketPrice = paidEvents.reduce((sum, event) => 
        sum + (event.price_in_cents || 0), 0) / (paidEvents.length * 100);
    }

    // Calculate capacity fill rate
    if (eventsWithCapacity.length > 0) {
      analytics.capacityFillRate = eventsWithCapacity.reduce((sum, event) => 
        sum + ((event.rsvp_count || 0) / event.rsvp_capacity), 0) / eventsWithCapacity.length;
    }

    // Calculate revenue per attendee
    if (analytics.totalRsvps > 0) {
      analytics.revenuePerAttendee = analytics.totalRevenue / analytics.totalRsvps;
    }

    // Identify sell-out events and calculate speed
    const sellOutEvents = eventsWithCapacity.filter(e => e.rsvp_count >= e.rsvp_capacity);
    analytics.sellOutCount = sellOutEvents.length;
    analytics.sellOutRate = eventsWithCapacity.length > 0 ? 
      (sellOutEvents.length / eventsWithCapacity.length) : 0;

    // Calculate sell-out speed for events that sold out
    let sellOutSpeeds = [];
    sellOutEvents.forEach(event => {
      const eventRsvps = advancedData.rsvpTimestamps[event.id] || [];
      if (eventRsvps.length >= event.rsvp_capacity) {
        const eventStart = new Date(event.starts_at);
        const sellOutTime = new Date(eventRsvps[event.rsvp_capacity - 1]?.created_at);
        if (sellOutTime && eventStart) {
          const hoursToSellOut = (sellOutTime - eventStart) / (1000 * 60 * 60);
          if (hoursToSellOut < 0) { // Sold out before event
            sellOutSpeeds.push(Math.abs(hoursToSellOut));
          }
        }
      }
    });
    analytics.avgSellOutSpeed = sellOutSpeeds.length > 0 ? 
      sellOutSpeeds.reduce((sum, speed) => sum + speed, 0) / sellOutSpeeds.length : 0;

    // Calculate repeat guest rate
    const allUsers = Object.keys(advancedData.userRsvpHistory);
    const repeatGuests = allUsers.filter(userId => 
      advancedData.userRsvpHistory[userId].length > 1
    );
    analytics.repeatGuestRate = allUsers.length > 0 ? 
      (repeatGuests.length / allUsers.length) : 0;
    analytics.firstTimerRate = 1 - analytics.repeatGuestRate;

    // Calculate refund rate from payment data
    const refundedPayments = advancedData.paymentData.filter(p => p.refunded);
    analytics.refundRate = advancedData.paymentData.length > 0 ?
      (refundedPayments.length / advancedData.paymentData.length) : 0;

    // RSVP surge analysis (day-by-day pattern)
    const surgeAnalysis = {};
    Object.entries(advancedData.rsvpTimestamps).forEach(([eventId, rsvps]) => {
      const event = events.find(e => e.id === eventId);
      if (!event) return;
      
      const eventStart = new Date(event.starts_at);
      const dailyRsvps = {};
      
      rsvps.forEach(rsvp => {
        const rsvpDate = new Date(rsvp.created_at);
        const daysBeforeEvent = Math.ceil((eventStart - rsvpDate) / (1000 * 60 * 60 * 24));
        
        if (daysBeforeEvent >= 0) {
          dailyRsvps[daysBeforeEvent] = (dailyRsvps[daysBeforeEvent] || 0) + 1;
        }
      });
      
      surgeAnalysis[eventId] = dailyRsvps;
    });
    analytics.rsvpSurgeWindow = surgeAnalysis;

    // Find peak RSVP day across all events
    const allDayCounts = {};
    Object.values(surgeAnalysis).forEach(eventSurge => {
      Object.entries(eventSurge).forEach(([day, count]) => {
        allDayCounts[day] = (allDayCounts[day] || 0) + count;
      });
    });
    
    if (Object.keys(allDayCounts).length > 0) {
      const peakDay = Object.entries(allDayCounts).reduce((max, [day, count]) =>
        count > max.count ? { day: parseInt(day), count } : max,
        { day: 0, count: 0 }
      );
      analytics.peakRsvpDay = peakDay.day === 0 ? 'Event day' : 
        peakDay.day === 1 ? '1 day before' : `${peakDay.day} days before`;
    }

    // Net revenue is the same as total revenue for hosts (fees charged to users)
    analytics.netRevenue = analytics.totalRevenue;

    return analytics;
  };

  const analytics = calculateAnalytics();

  // Generate chart data based on metric and time period
  const generateChartData = (metricType, period, paidOnly=false, joinDateParam=null, pastEventsParam=null) => {
    const now = new Date();
    let startDate;
    
    switch(period) {
      case 'month':
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case '6months':
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 6);
        break;
      case 'ytd':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default: // 'all'
        startDate = new Date(2020, 0, 1);
    }
    // Adjust start date to not precede host join date (but don't use future dates)
    if(joinDateParam && startDate < joinDateParam && joinDateParam <= now) {
      startDate = joinDateParam;
    }

    const allEvents = [...(events || []), ...(pastEventsParam || pastEvents || [])]; // Combine upcoming and past events
    const baseEvents = paidOnly ? allEvents.filter(e => e.price_in_cents > 0) : allEvents;
    const filteredEvents = baseEvents.filter(e => new Date(e.starts_at) >= startDate);
    
    switch(metricType) {
      case 'rsvps':
        const rsvpChart = generateRSVPLineChart(filteredEvents, period);
        rsvpChart.totalRsvps = analytics.totalRsvps;
        rsvpChart.last30DayRsvps = analytics.last30DayRsvps;
        return rsvpChart;
      case 'capacity':
        // For capacity chart, use ALL events regardless of time period for now
        const allEventsForCapacity = [...(events || []), ...(pastEventsParam || pastEvents || [])];
        const capacityEvents = paidOnly ? allEventsForCapacity.filter(e => e.price_in_cents > 0) : allEventsForCapacity;
        const chart = generateCapacityBarChart(capacityEvents);
        // Calculate fill rate for filtered period only
        const eventsWithCapacity = capacityEvents.filter(e => e.rsvp_capacity && e.rsvp_capacity > 0);
        if (eventsWithCapacity.length > 0) {
          chart.avg = eventsWithCapacity.reduce((sum, event) => 
            sum + ((event.rsvp_count || 0) / event.rsvp_capacity), 0) / eventsWithCapacity.length;
        } else {
          chart.avg = 0;
        }
        return chart;
      case 'revenueTimeline':
        const revEvents = paidOnly ? filteredEvents.filter(e=>e.price_in_cents>0) : filteredEvents;
        return generateRevenueTimelineChart(revEvents,startDate,period);
      case 'topEarning':
        const topEvents = paidOnly ? filteredEvents.filter(e=>e.price_in_cents>0) : filteredEvents;
        return generateRevenueChart(topEvents);
      case 'sellout':
        return generateSellOutChart(filteredEvents);
      case 'repeat':
        return generateRepeatGuestChart(filteredEvents);
      case 'peak':
        return generatePeakTimingChart(filteredEvents);
      case 'refund':
        return generateRefundChart(filteredEvents);
      default:
        return { data: [], type: 'line' };
    }
  };

  const generateRSVPLineChart = (events, period) => {
    const advancedData = global.hostAnalyticsData || { rsvpTimestamps: {} };
    
    // Get all RSVP timestamps across all events
    const allRsvps = [];
    Object.entries(advancedData.rsvpTimestamps).forEach(([eventId, rsvps]) => {
      rsvps.forEach(rsvp => {
        if (rsvp.status === 'attending') {
          allRsvps.push({
            date: new Date(rsvp.created_at),
            eventId
          });
        }
      });
    });
    
    // Sort by date
    allRsvps.sort((a, b) => a.date - b.date);
    
    if (allRsvps.length === 0) {
      return { data: [], type: 'line', title: 'RSVP Growth Over Time' };
    }
    
    const dataPoints = [];
    let cumulativeCount = 0;
    
    if (period === 'month') {
      // Daily cumulative for past month
      const now = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const dailyData = {};
      
      // Initialize with 0s for each day
      for (let i = 30; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dayKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        dailyData[dayKey] = 0;
      }
      
      // Count cumulative RSVPs by day
      allRsvps.forEach(rsvp => {
        if (rsvp.date >= thirtyDaysAgo) {
          const dayKey = rsvp.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          if (dailyData.hasOwnProperty(dayKey)) {
            cumulativeCount++;
            dailyData[dayKey] = cumulativeCount;
          }
        }
      });
      
      // Fill forward cumulative values
      let lastValue = 0;
      Object.keys(dailyData).forEach(day => {
        if (dailyData[day] === 0) {
          dailyData[day] = lastValue;
        } else {
          lastValue = dailyData[day];
        }
      });
      
      Object.entries(dailyData).forEach(([day, count]) => {
        dataPoints.push({ label: day, value: count });
      });
      
    } else {
      // Monthly cumulative for longer periods (6 months, YTD, all)
      const now = new Date();
      let startDate = new Date();
      if (period === '6months') {
        startDate.setMonth(startDate.getMonth() - 5); // include current month as 6th
      } else if (period === 'ytd') {
        startDate = new Date(now.getFullYear(), 0, 1);
      } else {
        startDate = new Date(now.getFullYear() - 5, 0, 1); // 5 years back for 'all'
      }
      startDate.setDate(1); // first of month

      // Generate list of month keys between startDate and now
      const monthKeys = [];
      let iter = new Date(startDate);
      while (iter <= now) {
        monthKeys.push(iter.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }));
        iter.setMonth(iter.getMonth() + 1);
      }

      // Map RSVP counts by month
      const monthlyCounts = {};
      cumulativeCount = 0;
      allRsvps.forEach(rsvp => {
        const monthKey = rsvp.date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        if (!monthlyCounts[monthKey]) monthlyCounts[monthKey] = 0;
        monthlyCounts[monthKey]++;
      });

      // Build cumulative dataPoints across months
      monthKeys.forEach(monthKey => {
        if (monthlyCounts[monthKey]) {
          cumulativeCount += monthlyCounts[monthKey];
        }
        dataPoints.push({ label: monthKey, value: cumulativeCount });
      });
    }
    
    // Ensure at least two points so the Polyline has a valid path
    if (dataPoints.length === 1) {
      const single = dataPoints[0];
      dataPoints.unshift({ label: single.label, value: 0 });
    }
    return { data: dataPoints, type: 'line', title: 'RSVP Growth Over Time' };
  };

  const generateCapacityBarChart = (events) => {
    // Fill-rate buckets: how full your events get
    const fillRanges = {
      '0-25%': 0,
      '26-50%': 0,
      '51-75%': 0,
      '76-99%': 0,
      '100%': 0,
      'No Capacity': 0,
    };
    
    events.forEach((event) => {
      const capacity = event.rsvp_capacity;
      const rsvps = event.rsvp_count || 0;

      // Events without capacity go in separate bucket
      if (!capacity || capacity === 0) {
        fillRanges['No Capacity']++;
        return;
      }

      const rate = rsvps / capacity;

      if (rate >= 1) {
        fillRanges['100%']++;
      } else if (rate >= 0.76) {
        fillRanges['76-99%']++;
      } else if (rate >= 0.51) {
        fillRanges['51-75%']++;
      } else if (rate >= 0.26) {
        fillRanges['26-50%']++;
      } else {
        fillRanges['0-25%']++;
      }
    });

    // Show ALL buckets, including zeros
    const data = Object.entries(fillRanges).map(([range, count]) => ({
      label: range,
      value: count,
    }));

    return { data, type: 'bar', title: 'Event Fill Rate Distribution' };
  };

  // Generate cumulative revenue timeline with milestones
  const generateRevenueTimelineChart = (events, startDate, period='all') => {
    // Sort events by date ascending
    const sorted = [...events].sort((a,b)=> new Date(a.starts_at)-new Date(b.starts_at));
    // insert baseline point at period start
    const data = [];
    if(startDate){
      data.push({ label: startDate.toLocaleDateString('en-US', period==='month'? { month:'short', day:'numeric'}:{month:'short',year:'2-digit'}), value:0 });
    }
    let cumulative = 0;
    sorted.forEach(ev=>{
      cumulative += ((ev.price_in_cents||0)*(ev.rsvp_count||0))/100;
      data.push({ label: new Date(ev.starts_at).toLocaleDateString('en-US', period==='month'? { month:'short', day:'numeric'}:{month:'short',year:'2-digit'}), value: cumulative });
    });

    const milestones = [100,250,500,750,1000,2500,5000,7500,10000,15000];
    const milestoneData = milestones.filter(m=> cumulative>=m).map(th=>({threshold:th}))
    return { data, type:'line', title:'Total Revenue Timeline', totalRevenue:cumulative, milestones: milestoneData };
  };

  const generateRevenueChart = (events) => {
    // Top earning events (limit 10)
    const revenueByEvent = events.map(e => ({
      label: e.title.length > 20 ? e.title.slice(0,20)+'…' : e.title,
      value: (e.price_in_cents || 0) / 100,
      fullTitle: e.title,
    }));

    revenueByEvent.sort((a,b)=> b.value - a.value);
    const top = revenueByEvent.slice(0,10);

    const totalRevenue = top.reduce((sum,r)=>sum+r.value,0);

    return { data: top, type: 'bar', title: 'Top-Earning Events', totalRevenue };
  };

  const generateSellOutChart = (events) => {
    const sellOutData = [
      { label: 'Sold Out', value: events.filter(e => e.rsvp_count >= (e.rsvp_capacity || Infinity)).length },
      { label: 'Available', value: events.filter(e => e.rsvp_count < (e.rsvp_capacity || Infinity) && e.rsvp_capacity).length },
      { label: 'No Limit', value: events.filter(e => !e.rsvp_capacity).length }
    ];
    
    return { data: sellOutData, type: 'pie', title: 'Event Fill Status' };
  };

  const generateRepeatGuestChart = (events) => {
    const advancedData = global.hostAnalyticsData || { userRsvpHistory: {} };
    const userCounts = Object.values(advancedData.userRsvpHistory).map(events => events.length);
    
    const buckets = { '1 Event': 0, '2-3 Events': 0, '4-5 Events': 0, '6+ Events': 0 };
    userCounts.forEach(count => {
      if (count === 1) buckets['1 Event']++;
      else if (count <= 3) buckets['2-3 Events']++;
      else if (count <= 5) buckets['4-5 Events']++;
      else buckets['6+ Events']++;
    });
    
    const data = Object.entries(buckets).map(([bucket, count]) => ({ label: bucket, value: count }));
    return { data, type: 'doughnut', title: 'Guest Attendance Frequency' };
  };

  const generatePeakTimingChart = (events) => {
    const advancedData = global.hostAnalyticsData || { rsvpTimestamps: {} };
    const dayData = { 'Same Day': 0, '1 Day Before': 0, '2-3 Days': 0, '4-7 Days': 0, '1+ Weeks': 0 };
    
    // Process real RSVP timestamp data
    Object.entries(advancedData.rsvpTimestamps).forEach(([eventId, rsvps]) => {
      const event = events.find(e => e.id === eventId);
      if (!event) return;
      
      const eventStart = new Date(event.starts_at);
      
      rsvps.forEach(rsvp => {
        const rsvpDate = new Date(rsvp.created_at);
        const hoursBeforeEvent = (eventStart - rsvpDate) / (1000 * 60 * 60);
        
        if (hoursBeforeEvent < 0) {
          // RSVP after event started (shouldn't happen but handle it)
          return;
        } else if (hoursBeforeEvent <= 24) {
          dayData['Same Day']++;
        } else if (hoursBeforeEvent <= 48) {
          dayData['1 Day Before']++;
        } else if (hoursBeforeEvent <= 72) {
          dayData['2-3 Days']++;
        } else if (hoursBeforeEvent <= 168) {
          dayData['4-7 Days']++;
        } else {
          dayData['1+ Weeks']++;
        }
      });
    });
    
    const data = Object.entries(dayData).map(([day, count]) => ({ 
      label: day, 
      value: count 
    }));
    
    return { data, type: 'bar', title: 'When People Book Events' };
  };

  const generateRefundChart = (events) => {
    const advancedData = global.hostAnalyticsData || { paymentData: [] };
    const refunded = advancedData.paymentData.filter(p => p.refunded).length;
    const completed = advancedData.paymentData.length - refunded;
    
    const data = [
      { label: 'Completed', value: completed },
      { label: 'Refunded', value: refunded }
    ];
    
    return { data, type: 'pie', title: 'Payment Status' };
  };

  const MetricCard = ({ title, value, subtitle, icon, color = '#3b82f6', metricType }) => (
    <TouchableOpacity 
      style={{
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: color,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      }}
      onPress={() => {
        setSelectedMetric({ title, metricType, color });
        setModalVisible(true);
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <Ionicons name={icon} size={20} color={color} style={{ marginRight: 8 }} />
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#1f2937', flex: 1 }}>
          {title}
        </Text>
        <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
      </View>
      <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#1f2937', marginBottom: 4 }}>
        {value}
      </Text>
      {subtitle && (
        <Text style={{ fontSize: 12, color: '#6b7280' }}>
          {subtitle}
        </Text>
      )}
    </TouchableOpacity>
  );

  const InsightCard = ({ insight, recommendation, type = 'info' }) => {
    const getColor = () => {
      switch(type) {
        case 'success': return '#10b981';
        case 'warning': return '#f59e0b';
        case 'danger': return '#ef4444';
        default: return '#3b82f6';
      }
    };

    const getIcon = () => {
      switch(type) {
        case 'success': return 'checkmark-circle';
        case 'warning': return 'warning';
        case 'danger': return 'alert-circle';
        default: return 'bulb';
      }
    };

    return (
      <View style={{
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: getColor(),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <Ionicons 
            name={getIcon()} 
            size={20} 
            color={getColor()} 
            style={{ marginRight: 12, marginTop: 2 }} 
          />
          <View style={{ flex: 1 }}>
            <Text style={{ 
              fontSize: 14, 
              color: '#1f2937', 
              marginBottom: 8,
              lineHeight: 20 
            }}>
              {insight}
            </Text>
            <Text style={{ 
              fontSize: 13, 
              color: getColor(), 
              fontWeight: '500',
              lineHeight: 18 
            }}>
              💡 {recommendation}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (events.length === 0) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 32 }}>
        <Ionicons name="analytics-outline" size={48} color="#9ca3af" style={{ marginBottom: 16 }} />
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#1f2937', marginBottom: 8 }}>
          No Analytics Yet
        </Text>
        <Text style={{ fontSize: 14, color: '#6b7280', textAlign: 'center' }}>
          Create your first event to start seeing performance insights
        </Text>
      </View>
    );
  }

  return (
    <View>
      {/* Key Metrics */}
      <Text style={{ fontSize: 16, fontWeight: '600', color: '#1f2937', marginBottom: 16 }}>
        Key Metrics
      </Text>
      
      <MetricCard
        title="Total RSVPs (30 days)"
        value={analytics.last30DayRsvps.toString()}
        subtitle={`${analytics.totalRsvps} total across ${paidOnly ? 'paid' : 'all'} events`}
        icon="people"
        color="#3b82f6"
        metricType="rsvps"
      />

      <MetricCard
        title="Capacity Fill Rate"
        value={`${(analytics.capacityFillRate * 100).toFixed(1)}%`}
        subtitle={`${analytics.sellOutCount} ${paidOnly ? 'paid ' : ''}events sold out`}
        icon="speedometer"
        color="#10b981"
        metricType="capacity"
      />

      <MetricCard
        title="Avg Revenue per Event"
        value={`$${(analytics.totalRevenue / Math.max(analytics.totalEvents,1)).toFixed(2)}`}
        subtitle={`Across ${analytics.totalEvents} ${paidOnly ? 'paid ' : ''}events`}
        icon="cash"
        color="#f59e0b"
        metricType="topEarning"
      />

      <MetricCard
        title="Total Revenue Timeline"
        value={`$${analytics.totalRevenue.toFixed(2)}`}
        subtitle={`From ${paidOnly ? 'paid events only' : 'all events'}`}
        icon="trending-up"
        color="#8b5cf6"
        metricType="revenueTimeline"
      />



      <MetricCard
        title="Repeat Guest Rate"
        value={`${(analytics.repeatGuestRate * 100).toFixed(1)}%`}
        subtitle={`${(analytics.firstTimerRate * 100).toFixed(1)}% first-timers`}
        icon="people-circle"
        color="#6366f1"
        metricType="repeat"
      />

      <MetricCard
        title="Peak RSVP Window"
        value={analytics.peakRsvpDay}
        subtitle="When most people book"
        icon="time"
        color="#10b981"
        metricType="peak"
      />

      <MetricCard
        title="Refund Rate"
        value={`${(analytics.refundRate * 100).toFixed(1)}%`}
        subtitle="Payment cancellations"
        icon="card-outline"
        color="#f59e0b"
        metricType="refund"
      />

      {/* AI Insights Section */}
      <Text style={{ 
        fontSize: 16, 
        fontWeight: '600', 
        color: '#1f2937', 
        marginTop: 24,
        marginBottom: 16 
      }}>
        AI Insights & Recommendations
      </Text>

      {/* Advanced AI insights based on real data */}
      {analytics.avgSellOutSpeed > 0 && analytics.avgSellOutSpeed < 24 && (
        <InsightCard
          insight={`Your events sell out in an average of ${analytics.avgSellOutSpeed.toFixed(1)} hours. This shows strong demand!`}
          recommendation="Consider raising prices by $2-3 or booking larger venues to capture more revenue."
          type="success"
        />
      )}

      {analytics.avgSellOutSpeed > 168 && (
        <InsightCard
          insight={`Your events take ${(analytics.avgSellOutSpeed / 24).toFixed(1)} days to sell out on average.`}
          recommendation="Try promoting earlier or adjusting your marketing strategy to create more urgency."
          type="info"
        />
      )}

      {analytics.repeatGuestRate > 0.3 && (
        <InsightCard
          insight={`${(analytics.repeatGuestRate * 100).toFixed(1)}% of your guests are repeat attendees - you're building a community!`}
          recommendation="Consider launching a loyalty program or member perks to reward your regulars."
          type="success"
        />
      )}

      {analytics.repeatGuestRate < 0.15 && analytics.totalEvents > 3 && (
        <InsightCard
          insight={`Only ${(analytics.repeatGuestRate * 100).toFixed(1)}% repeat guests - mostly first-timers attending.`}
          recommendation="Focus on post-event follow-up and building relationships to encourage return visits."
          type="warning"
        />
      )}

      {analytics.refundRate > 0.15 && (
        <InsightCard
          insight={`${(analytics.refundRate * 100).toFixed(1)}% refund rate is high - this might indicate booking issues.`}
          recommendation="Consider tightening your refund window to 24-48 hours or improving event descriptions."
          type="warning"
        />
      )}

      {analytics.peakRsvpDay.includes('day before') && (
        <InsightCard
          insight={`Most RSVPs happen ${analytics.peakRsvpDay} - people are booking last-minute!`}
          recommendation="Post promotional content 2-3 days earlier to capture bookings during peak interest."
          type="info"
        />
      )}

      {analytics.revenuePerAttendee < 10 && analytics.revenuePerAttendee > 0 && (
        <InsightCard
          insight={`Revenue per attendee is $${analytics.revenuePerAttendee.toFixed(2)} - room for growth.`}
          recommendation="Consider adding merchandise, upgrades, or premium tiers to increase per-person value."
          type="info"
        />
      )}

      {analytics.capacityFillRate < 0.4 && analytics.capacityFillRate > 0 && (
        <InsightCard
          insight="Your capacity fill rate is below 40% - you might be booking spaces that are too large."
          recommendation="Try smaller, more intimate venues to create better atmosphere and reduce costs."
          type="warning"
        />
      )}

      {analytics.totalEvents < 3 && (
        <InsightCard
          insight="You're just getting started! More events will unlock deeper insights."
          recommendation="Host 2-3 more events to see meaningful performance trends and patterns."
          type="info"
        />
      )}



      {/* Chart Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9fa' }}>
          {/* Header */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: '#e5e7eb',
            backgroundColor: 'white'
          }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1f2937' }}>
                {selectedMetric?.title}
              </Text>
              <Text style={{ fontSize: 14, color: '#6b7280' }}>
                Detailed Analytics
              </Text>
            </View>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {/* Time Period Selector */}
          <View style={{ padding: 16, backgroundColor: 'white', marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 12, color: '#1f2937' }}>
              Time Period
            </Text>
            <View style={{ flexDirection: 'row', backgroundColor: '#f3f4f6', borderRadius: 8, padding: 4 }}>
              {[
                { key: 'month', label: 'Past Month' },
                { key: '6months', label: '6 Months' },
                { key: 'ytd', label: 'YTD' },
                { key: 'all', label: 'All Time' }
              ].map(period => (
                <TouchableOpacity
                  key={period.key}
                  onPress={() => setTimePeriod(period.key)}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 6,
                    backgroundColor: timePeriod === period.key ? 'white' : 'transparent',
                  }}
                >
                  <Text style={{
                    textAlign: 'center',
                    fontSize: 12,
                    fontWeight: '500',
                    color: timePeriod === period.key ? selectedMetric?.color : '#6b7280',
                  }}>
                    {period.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>




          {/* Chart Container */}
          <ScrollView style={{ flex: 1, padding: 16 }}>
            <ChartContainer 
              chartData={selectedMetric ? generateChartData(selectedMetric.metricType, timePeriod, paidOnly, joinDate, pastEvents) : null}
              color={selectedMetric?.color}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

// Simple Chart Container Component
const ChartContainer = ({ chartData, color }) => {
  if (!chartData || !chartData.data || chartData.data.length === 0) {
    return (
      <View style={{ 
        backgroundColor: 'white', 
        borderRadius: 12, 
        padding: 32, 
        alignItems: 'center' 
      }}>
        <Ionicons name="bar-chart-outline" size={48} color="#d1d5db" style={{ marginBottom: 16 }} />
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#1f2937', marginBottom: 8 }}>
          No Data Available
        </Text>
        <Text style={{ fontSize: 14, color: '#6b7280', textAlign: 'center' }}>
          More data will be available as you host more events
        </Text>
      </View>
    );
  }

  const maxValue = Math.max(...chartData.data.map(d => d.value));
  
  return (
    <View style={{ backgroundColor: 'white', borderRadius: 12, padding: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: '600', color: '#1f2937', marginBottom: 8 }}>
        {chartData.title}
      </Text>
      
      {/* Chart Explanations */}
      {chartData.type === 'bar' && chartData.title.includes('Fill Rate') && (
        <Text style={{ 
          fontSize: 13, 
          color: '#6b7280', 
          marginBottom: 16,
          lineHeight: 18 
        }}>
          This shows how full your events get based on VybeLocal RSVPs vs. your set capacity. Each bar represents how many events fall into that fill rate range. Note: If you advertise events outside VybeLocal, your actual attendance may be higher.
        </Text>
      )}
      
      {chartData.type === 'line' && chartData.title.includes('RSVP Growth') && (
        <Text style={{ 
          fontSize: 13, 
          color: '#6b7280', 
          marginBottom: 16,
          lineHeight: 18 
        }}>
          This shows your cumulative VybeLocal RSVP growth over time. The line tracks how your total RSVPs have grown across all events during the selected period.
        </Text>
      )}

      {chartData.type === 'bar' && chartData.title.includes('Top-Earning') && (
        <Text style={{ 
          fontSize: 13, 
          color: '#6b7280', 
          marginBottom: 16,
          lineHeight: 18 
        }}>
          This shows the events that generated the most VybeLocal revenue in the selected period. Each bar represents total ticket revenue for that event.
        </Text>
      )}
      

      
      {chartData.type === 'bar' && (
        <BarChart data={chartData.data} maxValue={maxValue} color={color} />
      )}
      
      {chartData.type === 'line' && (
        <LineChart data={chartData.data} color={color} />
      )}
      
      {(chartData.type === 'pie' || chartData.type === 'doughnut') && (
        <PieChart data={chartData.data} color={color} isDoughnut={chartData.type === 'doughnut'} />
      )}
      
      

      {/* Average summary for charts that include 'avg' */}
      {chartData.avg !== undefined && (
        <View style={{ marginTop: 12, alignItems: 'center' }}>
          <Text style={{ fontSize: 13, color: '#6b7280' }}>
            Average Fill Rate: <Text style={{ fontWeight: '600', color: '#1f2937' }}>{(chartData.avg * 100).toFixed(1)}%</Text>
          </Text>
        </View>
      )}

      {/* AI Insights */}
      {chartData.type === 'bar' && chartData.title.includes('Fill Rate') && chartData.avg !== undefined && (
        <View style={{
          backgroundColor: 'white',
          borderRadius: 12,
          padding: 16,
          marginTop: 16,
          borderLeftWidth: 4,
          borderLeftColor: chartData.avg > 0.7 ? '#10b981' : chartData.avg > 0.4 ? '#f59e0b' : '#3b82f6',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <Ionicons 
              name={chartData.avg > 0.7 ? 'checkmark-circle' : chartData.avg > 0.4 ? 'bulb' : 'trending-up'} 
              size={20} 
              color={chartData.avg > 0.7 ? '#10b981' : chartData.avg > 0.4 ? '#f59e0b' : '#3b82f6'} 
              style={{ marginRight: 12, marginTop: 2 }} 
            />
            <View style={{ flex: 1 }}>
              <Text style={{ 
                fontSize: 14, 
                color: '#1f2937', 
                marginBottom: 8,
                lineHeight: 20 
              }}>
                {chartData.avg > 0.8 ? 
                  `Your VybeLocal RSVPs fill ${(chartData.avg * 100).toFixed(0)}% of capacity on average - strong performance on the platform!` :
                  chartData.avg > 0.6 ?
                  `Your VybeLocal RSVPs average ${(chartData.avg * 100).toFixed(0)}% of capacity - solid platform engagement.` :
                  chartData.avg > 0.3 ?
                  `VybeLocal RSVPs average ${(chartData.avg * 100).toFixed(0)}% of capacity - there's room to grow your audience here.` :
                  `VybeLocal RSVPs average ${(chartData.avg * 100).toFixed(0)}% of capacity - focus on building your platform presence.`
                }
              </Text>
              <Text style={{ 
                fontSize: 13, 
                color: chartData.avg > 0.7 ? '#10b981' : chartData.avg > 0.4 ? '#f59e0b' : '#3b82f6', 
                fontWeight: '500',
                lineHeight: 18 
              }}>
                💡 {chartData.avg > 0.8 ? 
                  'Great VybeLocal engagement! Consider featuring more events on the platform or adjusting capacity sizing.' :
                  chartData.avg > 0.6 ?
                  'Try promoting events earlier on VybeLocal or creating more compelling event descriptions.' :
                  chartData.avg > 0.3 ?
                  'Focus on building your VybeLocal following through consistent posting and community engagement.' :
                  'Start with smaller capacity events to build momentum and grow your VybeLocal audience organically.'
                }
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* AI Insight for Top Revenue Chart */}
      {chartData.type === 'bar' && chartData.title.includes('Top-Earning') && chartData.totalRevenue !== undefined && (
        <View style={{
          backgroundColor: 'white',
          borderRadius: 12,
          padding: 16,
          marginTop: 16,
          borderLeftWidth: 4,
          borderLeftColor: chartData.totalRevenue > 1000 ? '#10b981' : chartData.totalRevenue > 200 ? '#f59e0b' : '#3b82f6',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <Ionicons 
              name={chartData.totalRevenue > 1000 ? 'trending-up' : chartData.totalRevenue > 200 ? 'bulb' : 'cash'} 
              size={20} 
              color={chartData.totalRevenue > 1000 ? '#10b981' : chartData.totalRevenue > 200 ? '#f59e0b' : '#3b82f6'} 
              style={{ marginRight: 12, marginTop: 2 }} 
            />
            <View style={{ flex: 1 }}>
              <Text style={{ 
                fontSize: 14, 
                color: '#1f2937', 
                marginBottom: 8,
                lineHeight: 20 
              }}>
                {chartData.totalRevenue > 1000 ? 
                  `You've earned $${chartData.totalRevenue.toFixed(0)} from VybeLocal RSVPs!` :
                  chartData.totalRevenue > 200 ?
                  `You've made $${chartData.totalRevenue.toFixed(0)} on VybeLocal so far.` :
                  chartData.totalRevenue > 0 ?
                  `You've started earning on VybeLocal with $${chartData.totalRevenue.toFixed(0)} in revenue.` :
                  `You haven't earned on VybeLocal yet.`
                }
              </Text>
              <Text style={{ 
                fontSize: 13, 
                color: chartData.totalRevenue > 1000 ? '#10b981' : chartData.totalRevenue > 200 ? '#f59e0b' : '#3b82f6', 
                fontWeight: '500',
                lineHeight: 18 
              }}>
                💡 {chartData.totalRevenue > 1000 ? 
                  'Consider premium event tiers or merchandise to further increase revenue.' :
                  chartData.totalRevenue > 200 ?
                  'Keep experimenting with ticket pricing and promotion to boost earnings.' :
                  chartData.totalRevenue > 0 ?
                  'Post more events and promote them to grow your VybeLocal revenue.' :
                  'Host your first paid event to start earning on VybeLocal.'
                }
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* AI Insight for RSVP Growth Chart */}
      {chartData.type === 'line' && chartData.title.includes('RSVP Growth') && chartData.totalRsvps !== undefined && (
        <View style={{
          backgroundColor: 'white',
          borderRadius: 12,
          padding: 16,
          marginTop: 16,
          borderLeftWidth: 4,
          borderLeftColor: chartData.totalRsvps > 100 ? '#10b981' : chartData.totalRsvps > 50 ? '#f59e0b' : '#3b82f6',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <Ionicons 
              name={chartData.totalRsvps > 100 ? 'trending-up' : chartData.totalRsvps > 50 ? 'bulb' : 'rocket'} 
              size={20} 
              color={chartData.totalRsvps > 100 ? '#10b981' : chartData.totalRsvps > 50 ? '#f59e0b' : '#3b82f6'} 
              style={{ marginRight: 12, marginTop: 2 }} 
            />
            <View style={{ flex: 1 }}>
              <Text style={{ 
                fontSize: 14, 
                color: '#1f2937', 
                marginBottom: 8,
                lineHeight: 20 
              }}>
                {chartData.totalRsvps > 100 ? 
                  `You've built a strong VybeLocal community with ${chartData.totalRsvps} total RSVPs!` :
                  chartData.totalRsvps > 50 ?
                  `You're growing your VybeLocal presence with ${chartData.totalRsvps} RSVPs so far.` :
                  chartData.totalRsvps > 10 ?
                  `You're getting started on VybeLocal with ${chartData.totalRsvps} RSVPs - good momentum!` :
                  `You're just beginning your VybeLocal journey with ${chartData.totalRsvps} RSVPs.`
                }
              </Text>
              <Text style={{ 
                fontSize: 13, 
                color: chartData.totalRsvps > 100 ? '#10b981' : chartData.totalRsvps > 50 ? '#f59e0b' : '#3b82f6', 
                fontWeight: '500',
                lineHeight: 18 
              }}>
                💡 {chartData.totalRsvps > 100 ? 
                  'Keep the momentum going! Consider hosting premium events or expanding to new event types.' :
                  chartData.totalRsvps > 50 ?
                  'Post consistently and engage with your RSVPs to build a loyal community on the platform.' :
                  chartData.totalRsvps > 10 ?
                  'Focus on creating compelling event descriptions and posting regularly to accelerate growth.' :
                  'Host 2-3 more events to establish your presence and start building a VybeLocal following.'
                }
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

// Enhanced Bar Chart Component
const BarChart = ({ data, maxValue, color }) => (
  <View style={{ height: 280, paddingTop: 16 }}>
    {/* Chart Grid */}
    <View style={{ position: 'absolute', top: 16, bottom: 40, left: 80, right: 16 }}>
      {[0, 25, 50, 75, 100].map(percent => (
        <View key={percent} style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: `${100 - percent}%`,
          borderTopWidth: 1,
          borderTopColor: percent === 0 ? '#d1d5db' : '#f3f4f6'
        }} />
      ))}
    </View>
    
    {/* Y-Axis Labels */}
    <View style={{ position: 'absolute', top: 16, bottom: 40, left: 0, width: 70 }}>
      {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => (
        <View key={index} style={{
          position: 'absolute',
          top: `${(1 - ratio) * 100}%`,
          right: 8,
          transform: [{ translateY: -8 }]
        }}>
          <Text style={{ fontSize: 10, color: '#6b7280', textAlign: 'right' }}>
            {Math.round(maxValue * ratio)}
          </Text>
        </View>
      ))}
    </View>
    
    {/* Bars */}
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', paddingLeft: 80, paddingRight: 16, paddingBottom: 40 }}>
      {data.map((item, index) => {
        const barHeight = Math.max((item.value / maxValue) * 160, 4);
        return (
          <View key={index} style={{ flex: 1, alignItems: 'center', marginHorizontal: 2 }}>
            <View style={{
              width: '80%',
              height: barHeight,
              backgroundColor: color || '#3b82f6',
              borderRadius: 4,
              justifyContent: 'flex-end',
              alignItems: 'center',
              paddingBottom: 4,
              shadowColor: color || '#3b82f6',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 3,
            }}>
              <Text style={{ 
                fontSize: 10, 
                fontWeight: '600', 
                color: 'white',
                textAlign: 'center'
              }}>
                {item.value}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
    
    {/* X-Axis Labels */}
    <View style={{ 
      flexDirection: 'row', 
      paddingLeft: 80, 
      paddingRight: 16,
      paddingTop: 8 
    }}>
      {data.map((item, index) => (
        <View key={index} style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ 
            fontSize: 10, 
            color: '#6b7280',
            textAlign: 'center',
            transform: [{ rotate: '-45deg' }],
            marginTop: 4
          }}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  </View>
);

// Beautiful SVG Line Chart
const LineChart = ({ data, color }) => {
  if (!data || data.length === 0) return null;
  
  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));
  const range = maxValue - minValue || 1;
  
  const chartWidth = 280;
  const chartHeight = 120;
  const padding = 20;
  
  // Calculate points for the line
  const points = data.map((item, index) => {
    const x = padding + (index / (data.length - 1)) * (chartWidth - 2 * padding);
    const y = chartHeight - padding - ((item.value - minValue) / range) * (chartHeight - 2 * padding);
    return `${x},${y}`;
  }).join(' ');
  
  // Find peak point for label
  const peakIndex = data.findIndex(item => item.value === maxValue);
  const peakX = padding + (peakIndex / (data.length - 1)) * (chartWidth - 2 * padding);
  const peakY = chartHeight - padding - ((maxValue - minValue) / range) * (chartHeight - 2 * padding);
  
  return (
    <View style={{ height: 250, padding: 20 }}>
      {/* Chart Container */}
      <View style={{
        flex: 1,
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e5e7eb'
      }}>
        
        {/* SVG Line Chart */}
        <View style={{ height: chartHeight, justifyContent: 'center', alignItems: 'center' }}>
          {/* Chart background with grid */}
          <View style={{
            width: chartWidth,
            height: chartHeight,
            backgroundColor: '#f9fafb',
            borderRadius: 8,
            position: 'relative',
            borderWidth: 1,
            borderColor: '#e5e7eb'
          }}>
            {/* Grid lines */}
            {[0, 25, 50, 75, 100].map(percent => (
              <View key={percent} style={{
                position: 'absolute',
                left: padding,
                right: padding,
                top: `${percent}%`,
                borderTopWidth: 1,
                borderTopColor: '#f3f4f6'
              }} />
            ))}
            
            {/* Beautiful SVG line */}
            <Svg width={chartWidth} height={chartHeight} style={{ position: 'absolute', top: 0, left: 0 }}>
              <Polyline
                points={points}
                fill="none"
                stroke={color || '#3b82f6'}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
          
          {/* Peak Value Label */}
          <View style={{
            position: 'absolute',
            left: peakX - 20,
            top: peakY - 35,
            backgroundColor: color || '#3b82f6',
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 6,
          }}>
            <Text style={{ 
              fontSize: 12, 
              color: 'white', 
              fontWeight: '600'
            }}>
              {maxValue}
            </Text>
          </View>
        </View>
        
        {/* Time Range */}
        <View style={{ 
          flexDirection: 'row', 
          justifyContent: 'space-between',
          paddingTop: 8,
          borderTopWidth: 1,
          borderTopColor: '#f3f4f6'
        }}>
          <Text style={{ fontSize: 12, color: '#6b7280' }}>
            {data[0]?.label}
          </Text>
          <Text style={{ fontSize: 12, color: '#6b7280' }}>
            {data[data.length - 1]?.label}
          </Text>
        </View>
      </View>
      
      {/* Summary */}
      <View style={{
        flexDirection: 'row',
        justifyContent: 'center',
        paddingTop: 12
      }}>
        <Text style={{ fontSize: 13, color: '#6b7280' }}>
          Total Growth: <Text style={{ fontWeight: '600', color: '#1f2937' }}>{maxValue}</Text> RSVPs
        </Text>
      </View>
    </View>
  );
};

// Enhanced Pie Chart Component
const PieChart = ({ data, color, isDoughnut }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const colors = [
    color || '#3b82f6',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#8b5cf6',
    '#6b7280'
  ];
  
  return (
    <View style={{ height: 320, paddingTop: 16 }}>
      {/* Summary Stats */}
      <View style={{
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 20,
        paddingHorizontal: 16
      }}>
        <View style={{
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: '#e5e7eb'
        }}>
          <Text style={{ fontSize: 12, color: '#6b7280', textAlign: 'center' }}>
            Total Items
          </Text>
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1f2937', textAlign: 'center' }}>
            {total}
          </Text>
        </View>
      </View>
      
      {/* Data Items */}
      <View style={{ paddingHorizontal: 16 }}>
        {data.map((item, index) => {
          const percentage = total > 0 ? (item.value / total) * 100 : 0;
          const itemColor = colors[index % colors.length];
          
          return (
            <View key={index} style={{ 
              marginBottom: 12,
              backgroundColor: 'white',
              borderRadius: 12,
              padding: 16,
              borderLeftWidth: 4,
              borderLeftColor: itemColor,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 2,
            }}>
              {/* Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <View style={{
                  width: 12,
                  height: 12,
                  borderRadius: isDoughnut ? 6 : 3,
                  backgroundColor: itemColor,
                  marginRight: 12
                }} />
                <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: '#1f2937' }}>
                  {item.label}
                </Text>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1f2937' }}>
                  {item.value}
                </Text>
              </View>
              
              {/* Percentage Bar */}
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{
                  flex: 1,
                  height: 6,
                  backgroundColor: '#f3f4f6',
                  borderRadius: 3,
                  marginRight: 12
                }}>
                  <View style={{
                    width: `${percentage}%`,
                    height: '100%',
                    backgroundColor: itemColor,
                    borderRadius: 3,
                  }} />
                </View>
                <Text style={{ fontSize: 12, color: '#6b7280', minWidth: 45, textAlign: 'right' }}>
                  {percentage.toFixed(1)}%
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

// Enhanced Area Chart for Revenue
const AreaChart = ({ data, color }) => {
  if (!data || data.length === 0) return null;
  
  const maxValue = Math.max(...data.map(d => d.value));
  const totalRevenue = data.reduce((sum, d) => sum + d.value, 0);
  
  return (
    <View style={{ height: 320, paddingTop: 16 }}>
      {/* Revenue Summary */}
      <View style={{
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 20,
        paddingHorizontal: 16
      }}>
        <View style={{
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 8,
          alignItems: 'center',
          flex: 1,
          marginRight: 8
        }}>
          <Text style={{ fontSize: 11, color: '#6b7280' }}>Total Revenue</Text>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#8b5cf6' }}>
            ${totalRevenue.toFixed(2)}
          </Text>
        </View>
        <View style={{
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 8,
          alignItems: 'center',
          flex: 1,
          marginLeft: 8
        }}>
          <Text style={{ fontSize: 11, color: '#6b7280' }}>Peak Month</Text>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#10b981' }}>
            ${maxValue.toFixed(2)}
          </Text>
        </View>
      </View>
      
      {/* Chart Grid */}
      <View style={{ position: 'absolute', top: 90, bottom: 60, left: 60, right: 16 }}>
        {[0, 25, 50, 75, 100].map(percent => (
          <View key={percent} style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: `${100 - percent}%`,
            borderTopWidth: 1,
            borderTopColor: percent === 0 ? '#d1d5db' : '#f3f4f6'
          }} />
        ))}
      </View>
      
      {/* Y-Axis Labels */}
      <View style={{ position: 'absolute', top: 90, bottom: 60, left: 0, width: 55 }}>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => (
          <View key={index} style={{
            position: 'absolute',
            top: `${(1 - ratio) * 100}%`,
            right: 8,
            transform: [{ translateY: -8 }]
          }}>
            <Text style={{ fontSize: 9, color: '#6b7280', textAlign: 'right' }}>
              ${Math.round(maxValue * ratio)}
            </Text>
          </View>
        ))}
      </View>
      
      {/* Area Chart */}
      <View style={{ 
        position: 'absolute', 
        top: 90, 
        bottom: 60, 
        left: 60, 
        right: 16,
        flexDirection: 'row',
        alignItems: 'end'
      }}>
        {data.map((item, index) => {
          const height = Math.max((item.value / maxValue) * 140, 2);
          
          return (
            <View key={index} style={{ flex: 1, alignItems: 'center', height: 140 }}>
              {/* Area Fill */}
              <View style={{
                position: 'absolute',
                bottom: 0,
                width: '90%',
                height: height,
                backgroundColor: `${color || '#8b5cf6'}40`,
                borderTopLeftRadius: 2,
                borderTopRightRadius: 2,
              }} />
              
              {/* Top Border Line */}
              <View style={{
                position: 'absolute',
                bottom: height - 2,
                width: '90%',
                height: 2,
                backgroundColor: color || '#8b5cf6',
                borderRadius: 1,
              }} />
              
              {/* Value Point */}
              <View style={{ 
                position: 'absolute', 
                bottom: height - 3,
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: color || '#8b5cf6',
                borderWidth: 2,
                borderColor: 'white',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.3,
                shadowRadius: 2,
                elevation: 3,
              }} />
              
              {/* Hover Value */}
              {item.value > maxValue * 0.7 && (
                <View style={{
                  position: 'absolute',
                  bottom: height + 8,
                  backgroundColor: 'rgba(0,0,0,0.8)',
                  paddingHorizontal: 4,
                  paddingVertical: 2,
                  borderRadius: 3,
                }}>
                  <Text style={{ 
                    fontSize: 9, 
                    color: 'white', 
                    fontWeight: '600'
                  }}>
                    ${item.value.toFixed(0)}
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
      
      {/* X-Axis Labels */}
      <View style={{ 
        position: 'absolute',
        bottom: 0,
        left: 60,
        right: 16,
        height: 60,
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 8
      }}>
        {data.map((item, index) => (
          <View key={index} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ 
              fontSize: 9, 
              color: '#6b7280',
              textAlign: 'center',
              transform: [{ rotate: '-45deg' }],
            }}>
              {item.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

export default function HostCreateScreen() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [pastEvents, setPastEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'calendar'
  const [showPastEvents, setShowPastEvents] = useState(false); // toggle between current and past
  const [pastSortBy, setPastSortBy] = useState('date'); // 'date' or 'rsvps'
  const [showTooltip, setShowTooltip] = useState(false);
  const [paidOnly, setPaidOnly] = useState(true);
  const [joinDate, setJoinDate] = useState(null);
  const [metrics, setMetrics] = useState({
    totalRsvps: 0,
    rsvpsToday: 0,
    monthlyRevenue: 0
  });

  useEffect(() => {
    if (user) {
      loadHostData();
      fetchJoinDate();
    }
  }, [user]);

  const fetchJoinDate = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('created_at')
        .eq('id', user.id)
        .single();
      const jd = profile?.created_at ? new Date(profile.created_at) : new Date();
      setJoinDate(jd);
    } catch(e){ console.log('join date fetch error',e);}  };

  const loadHostData = async () => {
    try {
      setLoading(true);
      const now = new Date().toISOString();
      
      // Fetch upcoming events
      const { data: upcomingData, error: upcomingError } = await supabase
        .from('events')
        .select('id, host_id, title, status, starts_at, ends_at, vibe, price_in_cents, rsvp_capacity')
        .eq('host_id', user.id)
        .gte('starts_at', now)
        .order('starts_at', { ascending: true });

      if (upcomingError) throw upcomingError;

      // Fetch past events
      const { data: pastData, error: pastError } = await supabase
        .from('events')
        .select('id, host_id, title, status, starts_at, ends_at, vibe, price_in_cents, rsvp_capacity')
        .eq('host_id', user.id)
        .lt('starts_at', now)
        .order('starts_at', { ascending: false });

      if (pastError) throw pastError;

      // Get advanced RSVP data for analytics
      const allEventIds = [...(upcomingData || []), ...(pastData || [])].map(e => e.id);
      let rsvpCounts = {};
      let rsvpTimestamps = {};
      let userRsvpHistory = {};
      
      if (allEventIds.length > 0) {
        // Fetch RSVPs with timestamps for advanced analytics
        const { data: rsvpData } = await supabase
          .from('rsvps')
          .select('event_id, status, user_id, created_at, paid')
          .in('event_id', allEventIds)
          .neq('user_id', user.id) // Exclude host's own RSVP
          .eq('status', 'attending') // Only count attending RSVPs
          .order('created_at');

        // Fetch payment/refund data
        const { data: paymentData } = await supabase
          .from('payments')
          .select(`
            rsvp_id,
            paid_at,
            refunded,
            refund_reason,
            amount_paid,
            rsvps!inner(event_id, user_id)
          `)
          .in('rsvps.event_id', allEventIds);

        // Process RSVP data for basic counts and advanced analytics
        rsvpData?.forEach(rsvp => {
          const eventId = rsvp.event_id;
          
          // Basic counts (all are attending since we filtered)
          if (!rsvpCounts[eventId]) {
            rsvpCounts[eventId] = { attending: 0, total: 0 };
          }
          rsvpCounts[eventId].attending++;
          rsvpCounts[eventId].total++;

          // Timestamp tracking for sell-out speed and surge analysis
          if (!rsvpTimestamps[eventId]) {
            rsvpTimestamps[eventId] = [];
          }
          rsvpTimestamps[eventId].push({
            created_at: rsvp.created_at,
            status: rsvp.status,
            user_id: rsvp.user_id
          });

          // User history for repeat guest tracking
          if (!userRsvpHistory[rsvp.user_id]) {
            userRsvpHistory[rsvp.user_id] = [];
          }
          userRsvpHistory[rsvp.user_id].push(eventId);
        });

        // Store analytics data for later use
        global.hostAnalyticsData = {
          rsvpTimestamps,
          userRsvpHistory,
          paymentData: paymentData || []
        };
      }

      // Update events with RSVP counts
      const updateEventsWithRsvps = (eventList) => {
        return eventList.map(event => ({
          ...event,
          rsvp_count: rsvpCounts[event.id]?.attending || 0
        }));
      };

      // Add RSVP data to events
      const enrichEvents = (events) => events?.map(event => ({
        ...event,
        rsvp_count: rsvpCounts[event.id]?.attending || 0,
        total_rsvps: rsvpCounts[event.id]?.total || 0,
        capacity: event.rsvp_capacity, // Use actual capacity from DB (null/0 = no limit)
      })) || [];

      const enrichedUpcoming = enrichEvents(upcomingData);
      const enrichedPast = enrichEvents(pastData);
      
      setEvents(enrichedUpcoming);
      setPastEvents(enrichedPast);
      
      // Show tooltip for first-time users (no events at all)
      const hasNoEvents = enrichedUpcoming.length === 0 && enrichedPast.length === 0;
      if (hasNoEvents) {
        setTimeout(() => setShowTooltip(true), 1000); // Show after 1 second
      }
      
      // Calculate metrics
      const totalRsvps = Object.values(rsvpCounts).reduce((sum, count) => sum + count.attending, 0);
      
      // Calculate RSVPs today (need to access from global analytics data)
      const today = new Date().toDateString();
      const allRsvpTimestamps = Object.values(rsvpTimestamps).flat();
      const rsvpsToday = allRsvpTimestamps.filter(rsvp => 
        new Date(rsvp.created_at).toDateString() === today
      ).length || 0;
      
      // Calculate monthly revenue
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();
      const monthlyRevenue = [...enrichedUpcoming, ...enrichedPast]
        .filter(event => {
          const eventDate = new Date(event.starts_at);
          return eventDate.getMonth() === currentMonth && eventDate.getFullYear() === currentYear;
        })
        .reduce((sum, event) => sum + ((event.price_in_cents || 0) * (event.rsvp_count || 0) / 100), 0);
      
      setMetrics({
        totalEvents: enrichedUpcoming.length + enrichedPast.length,
        totalRsvps,
        rsvpsToday,
        monthlyRevenue
      });

    } catch (error) {
      console.error('Error loading host data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['rgba(203,180,227,0.2)', 'rgba(255,200,162,0.4)']} style={{ flex: 1 }} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top', 'left', 'right']}>
      <AppHeader />
      
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ padding: 16, paddingBottom: 8 }}>
          <Text style={{ 
            fontSize: 28, 
            fontWeight: 'bold', 
            color: '#1f2937',
            marginBottom: 4
          }}>
            Host Dashboard
          </Text>
          <Text style={{ fontSize: 16, color: '#6b7280' }}>
            Manage your events and track performance
          </Text>
      </View>

        {/* Events Overview - Default Open */}
        <HostSection title="Events Overview" defaultOpen={true} icon="calendar">
          {loading ? (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={{ marginTop: 16, color: '#6b7280' }}>Loading your events...</Text>
            </View>
          ) : (
            <View>
              {/* Quick Stats */}
              <View style={{ 
                flexDirection: 'row', 
                marginBottom: 24,
                backgroundColor: '#f8f9fa',
                padding: 16,
                borderRadius: 8
              }}>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.primary }}>
                    {metrics.totalEvents}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                    Total Events
                  </Text>
                </View>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.primary }}>
                    {metrics.totalRsvps}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                    Total RSVPs
                  </Text>
                </View>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.primary }}>
                    ${metrics.monthlyRevenue}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                    This Month
                  </Text>
                </View>
              </View>

              {/* Time Toggle */}
              <EventTimeToggle 
                showPast={showPastEvents} 
                onToggle={setShowPastEvents}
                upcomingCount={events.length}
                pastCount={pastEvents.length}
              />

              {/* View Toggle */}
              <ViewToggle viewMode={viewMode} onToggle={setViewMode} />

              {/* Current/Upcoming Events */}
              {!showPastEvents && (
                <>
                  {events.length > 0 ? (
                    <View style={{ marginBottom: 24 }}>
                      <Text style={{ 
                        fontSize: 16, 
                        fontWeight: '600', 
                        marginBottom: 12,
                        color: '#1f2937'
                      }}>
                        📆 Current & Upcoming Events
                      </Text>
                      {viewMode === 'list' ? (
                        events.slice(0, 10).map(event => (
                          <EventCard key={event.id} event={event} />
                        ))
                      ) : (
                        <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                          <Ionicons name="calendar-outline" size={48} color="#d1d5db" />
                          <Text style={{ color: '#6b7280', marginTop: 12 }}>Calendar view coming soon...</Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                      <Ionicons name="calendar-outline" size={48} color="#d1d5db" />
                      <Text style={{ 
                        fontSize: 16, 
                        color: '#6b7280', 
                        marginTop: 12,
                        textAlign: 'center'
                      }}>
                        No upcoming events. Create your first event to get started!
                      </Text>
                    </View>
                  )}
                </>
              )}

              {/* Past Events */}
              {showPastEvents && (
                <>
                  {pastEvents.length > 0 ? (
                    <View>
                      <Text style={{ 
                        fontSize: 16, 
                        fontWeight: '600',
                        color: '#1f2937',
                        marginBottom: 12
                      }}>
                        ✅ Past Events ({pastEvents.length})
                      </Text>
                      
                      <SortToggle sortBy={pastSortBy} onToggle={setPastSortBy} />
                      
                      {(() => {
                        const sortedPast = [...pastEvents].sort((a, b) => {
                          if (pastSortBy === 'rsvps') {
                            return b.rsvp_count - a.rsvp_count;
                          }
                          return new Date(b.starts_at) - new Date(a.starts_at);
                        });
                        
                        return sortedPast.map(event => (
                          <EventCard key={event.id} event={event} isPast={true} />
                        ));
                      })()}
                    </View>
                  ) : (
                    <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                      <Ionicons name="checkmark-circle-outline" size={48} color="#d1d5db" />
                      <Text style={{ 
                        fontSize: 16, 
                        color: '#6b7280', 
                        marginTop: 12,
                        textAlign: 'center'
                      }}>
                        No past events yet.
                      </Text>
                    </View>
                  )}
                </>
              )}

              {/* Overall Empty State */}
              {events.length === 0 && pastEvents.length === 0 && (
                <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                  <Ionicons name="calendar-outline" size={48} color="#d1d5db" />
                  <Text style={{ 
                    fontSize: 16, 
                    color: '#6b7280', 
                    marginTop: 12,
                    textAlign: 'center'
                  }}>
                    No events yet. Create your first event to get started!
                  </Text>
                </View>
              )}
            </View>
          )}
        </HostSection>

        {/* First-Timer Tooltip */}
        {showTooltip && (
          <View style={{
            position: 'absolute',
            top: 100,
            right: 20,
            backgroundColor: 'rgba(59, 130, 246, 0.95)',
            borderRadius: 12,
            padding: 16,
            maxWidth: 250,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 10,
            zIndex: 1000,
          }}>
            <View style={{
              position: 'absolute',
              top: -8,
              right: 40,
              width: 0,
              height: 0,
              borderLeftWidth: 8,
              borderRightWidth: 8,
              borderBottomWidth: 8,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderBottomColor: 'rgba(59, 130, 246, 0.95)',
            }} />
            <Text style={{
              color: 'white',
              fontSize: 14,
              fontWeight: '600',
              marginBottom: 8,
            }}>
              Create Your First Event! 🎉
            </Text>
            <Text style={{
              color: 'white',
              fontSize: 12,
              lineHeight: 16,
              marginBottom: 12,
            }}>
              Tap the green + button to host your first event and start building your community.
            </Text>
            <TouchableOpacity
              onPress={() => setShowTooltip(false)}
              style={{
                alignSelf: 'flex-end',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 6,
              }}
            >
              <Text style={{ color: 'white', fontSize: 12, fontWeight: '500' }}>
                Got it!
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* RSVP Management */}
        <HostSection title="RSVP Management" icon="people">
          <PlaceholderContent 
            icon="people-outline"
            title="RSVP Management"
            description="Manage attendee lists, send messages, and handle cancellations"
          />
        </HostSection>

        {/* Payouts & Earnings */}
        <HostSection title="Payouts & Earnings" icon="card">
          <PlaceholderContent 
            icon="card-outline"
            title="Payouts & Earnings"
            description="Track your earnings, manage payouts, and view transaction history"
          />
        </HostSection>

        {/* Analytics */}
        <HostSection title="Analytics" icon="bar-chart" headerRight={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 12, color: '#6b7280' }}>Paid Only</Text>
            <Switch 
              value={paidOnly} 
              onValueChange={setPaidOnly}
              trackColor={{ false: '#d1d5db', true: '#10b981' }}
              thumbColor={paidOnly ? '#fff' : '#f4f3f4'}
              style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
            />
          </View>
        }>
          <AnalyticsContent events={[...events, ...pastEvents]} paidOnly={paidOnly} setPaidOnly={setPaidOnly} joinDate={joinDate} />
        </HostSection>

        {/* Profile */}
        <HostSection title="Profile" icon="person">
          <PlaceholderContent 
            icon="person-outline"
            title="Profile"
            description="Manage your host profile, bio, and account settings"
          />
        </HostSection>

        {/* Tools */}
        <HostSection title="Tools" icon="settings">
          <PlaceholderContent 
            icon="construct-outline"
            title="Tools"
            description="Advanced tools for event management, bulk operations, and integrations"
          />
        </HostSection>

        {/* Bottom spacing for tab bar */}
        <View style={{ height: 100 }} />
      </ScrollView>
      
      <HostDrawerOverlay />
    </SafeAreaView>
    </LinearGradient>
  );
} 