import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

function startOfMonth(date){ const d=new Date(date); d.setDate(1); d.setHours(0,0,0,0); return d; }
function endOfMonth(date){ const d=new Date(date); d.setMonth(d.getMonth()+1); d.setDate(0); d.setHours(23,59,59,999); return d; }
function sameDay(a,b){ return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }

export default function MiniCalendar({ events = [], onSelectEvent }){
  const [monthOffset, setMonthOffset] = useState(0);
  const base = new Date(); base.setDate(1);
  const currentMonth = new Date(base.getFullYear(), base.getMonth()+monthOffset, 1);

  // Normalize events by day
  const dayMap = useMemo(()=>{
    const map = new Map();
    events.forEach(e=>{
      if(!e?.starts_at) return;
      const d = new Date(e.starts_at);
      const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
      if(!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    });
    return map;
  }, [events]);

  const first = startOfMonth(currentMonth);
  const last  = endOfMonth(currentMonth);
  const startWeekday = (first.getDay()+6)%7; // make Monday=0; adjust to taste
  const daysInMonth = last.getDate();

  const cells = [];
  // leading blanks
  for(let i=0;i<startWeekday;i++) cells.push(null);
  // month days
  for(let d=1; d<=daysInMonth; d++) cells.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d));
  // trailing blanks to complete grid rows
  while(cells.length % 7 !== 0) cells.push(null);

  const monthLabel = currentMonth.toLocaleString(undefined, { month:'long', year:'numeric' });

  return (
    <View style={{ backgroundColor:'white', borderRadius:12, padding:12, borderWidth:1, borderColor:'#e5e7eb' }}>
      {/* Header */}
      <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
        <TouchableOpacity onPress={()=>setMonthOffset(monthOffset-1)} style={{ padding:6 }}>
          <Ionicons name="chevron-back" size={18} color="#6b7280" />
        </TouchableOpacity>
        <Text style={{ fontSize:14, fontWeight:'700', color:'#1f2937' }}>{monthLabel}</Text>
        <TouchableOpacity onPress={()=>setMonthOffset(monthOffset+1)} style={{ padding:6 }}>
          <Ionicons name="chevron-forward" size={18} color="#6b7280" />
        </TouchableOpacity>
      </View>

      {/* Weekday row */}
      <View style={{ flexDirection:'row', marginBottom:6 }}>
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((w,i)=> (
          <Text key={i} style={{ flex:1, textAlign:'center', fontSize:11, color:'#6b7280' }}>{w}</Text>
        ))}
      </View>

      {/* Grid */}
      <View style={{ flexDirection:'row', flexWrap:'wrap' }}>
        {cells.map((cell, idx)=>{
          if(!cell){
            return <View key={idx} style={{ width:`${100/7}%`, padding:4 }} />
          }
          const key = new Date(cell.getFullYear(), cell.getMonth(), cell.getDate()).toISOString();
          const dayEvents = dayMap.get(key) || [];
          const isToday = sameDay(cell, new Date());
          return (
            <View key={idx} style={{ width:`${100/7}%`, padding:4 }}>
              <View style={{ borderWidth:1, borderColor:'#f3f4f6', borderRadius:8, padding:6, minHeight:54, backgroundColor:'#fff' }}>
                <Text style={{ fontSize:11, fontWeight:'600', color: isToday ? '#2563eb' : '#374151' }}>
                  {cell.getDate()}
                </Text>
                {dayEvents.slice(0,2).map((ev, i)=> {
                  const isPast = !!ev._isPast;
                  return (
                    <TouchableOpacity key={i} onPress={()=>onSelectEvent?.(ev)} style={{ marginTop:4, backgroundColor: isPast ? '#f3f4f6' : '#eef2ff', borderRadius:6, paddingHorizontal:6, paddingVertical:3 }}>
                      <Text numberOfLines={1} style={{ fontSize:10, color: isPast ? '#9ca3af' : '#4f46e5', fontWeight:'600' }}>{ev.title || 'Event'}</Text>
                    </TouchableOpacity>
                  );
                })}
                {dayEvents.length>2 && (
                  <Text style={{ marginTop:2, fontSize:10, color:'#6b7280' }}>+{dayEvents.length-2} more</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}