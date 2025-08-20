import { useEffect, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';

export default function useScreenGuards({ clearFns = [], largeRefs = [] } = {}) {
  const timeouts = useRef(new Set());
  const intervals = useRef(new Set());

  useEffect(() => {
    const origSetTimeout = global.setTimeout;
    const origSetInterval = global.setInterval;
    const origClearTimeout = global.clearTimeout;
    const origClearInterval = global.clearInterval;

    global.setTimeout = (fn, ms, ...args) => {
      const id = origSetTimeout(fn, ms, ...args);
      timeouts.current.add(id);
      return id;
    };
    global.setInterval = (fn, ms, ...args) => {
      const id = origSetInterval(fn, ms, ...args);
      intervals.current.add(id);
      return id;
    };
    global.clearTimeout = (id) => {
      timeouts.current.delete(id);
      return origClearTimeout(id);
    };
    global.clearInterval = (id) => {
      intervals.current.delete(id);
      return origClearInterval(id);
    };

    return () => {
      // restore
      global.setTimeout = origSetTimeout;
      global.setInterval = origSetInterval;
      global.clearTimeout = origClearTimeout;
      global.clearInterval = origClearInterval;
    };
  }, []);

  const cleanupAll = () => {
    timeouts.current.forEach((id) => clearTimeout(id));
    intervals.current.forEach((id) => clearInterval(id));
    timeouts.current.clear();
    intervals.current.clear();
    clearFns.forEach((fn) => {
      try { fn?.(); } catch {}
    });
    largeRefs.forEach((ref) => {
      try { if (ref) { if ('current' in ref) ref.current = undefined; else ref = undefined; } } catch {}
    });
  };

  useFocusEffect(() => {
    return () => cleanupAll();
  });

  useEffect(() => () => cleanupAll(), []);
}


