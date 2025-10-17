import { registerRootComponent } from 'expo';
// Early suppression of known RN WebView focus/blur redbox in dev
try {
  const __origConsoleError = console.error;
  console.error = (...args) => {
    try {
      if (typeof args[0] === 'string' && (args[0].includes('topFocus') || args[0].includes('topBlur'))) {
        return;
      }
    } catch {}
    __origConsoleError.apply(console, args);
  };
  if (global.ErrorUtils && typeof global.ErrorUtils.getGlobalHandler === 'function') {
    const __defaultHandler = global.ErrorUtils.getGlobalHandler();
    if (typeof global.ErrorUtils.setGlobalHandler === 'function') {
      global.ErrorUtils.setGlobalHandler((error, isFatal) => {
        try {
          const msg = error && error.message ? String(error.message) : '';
          if (msg.includes('topFocus') || msg.includes('topBlur')) {
            return;
          }
        } catch {}
        __defaultHandler(error, isFatal);
      });
    }
  }
} catch {}

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
