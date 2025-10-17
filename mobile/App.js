import 'react-native-get-random-values';
// Removed event-target-polyfill to avoid focus/blur top-level event noise in Hermes
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Text, View, TextInput, Button, ActivityIndicator, SafeAreaView, ErrorUtils } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import colors from './theme/colors';
import AppHeader from './components/AppHeader';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import DiscoverScreen from './screens/DiscoverScreen';
import HomeDashboard from './screens/HomeScreen';
import { StatusBar } from 'expo-status-bar';
import SplashScreen from './components/SplashScreen';
import 'react-native-gesture-handler';
import React from 'react';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import HostCreateScreen from './screens/HostCreateScreen';
import CalendarScreen from './screens/CalendarScreen';
import GuidelinesScreen from './screens/GuidelinesScreen';
import PastVybesScreen from './screens/PastVybesScreen';
import TrackedHostsScreen from './screens/TrackedHostsScreen';
import BlockedUsersScreen from './screens/BlockedUsersScreen';
import PushNotificationService from './utils/pushNotifications';
import ProfileSettingsScreen from './screens/ProfileSettingsScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import KybOnboardingScreen from './screens/KybOnboardingClean2';
import KybOnboardingClean from './screens/KybOnboardingClean';
import { OnboardingDraftProvider } from './components/OnboardingDraftProvider';
import KybIntroScreen from './screens/KybIntroScreen';
import MoovOnboardingWeb from './screens/MoovOnboardingWeb';
import MoovTosScreen from './screens/MoovTosScreen';
import PaymentMethodsScreen from './screens/PaymentMethodsScreen';

// Make PushNotificationService available globally for testing
if (__DEV__) {
  global.PushNotificationService = PushNotificationService;
}

// Suppress specific WebView warnings for topFocus/topBlur events
const originalError = console.error;
console.error = (...args) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('topFocus') || args[0].includes('topBlur'))
  ) {
    return;
  }
  originalError.apply(console, args);
};

// Also catch uncaught errors
const defaultHandler = ErrorUtils.getGlobalHandler();
ErrorUtils.setGlobalHandler((error, isFatal) => {
  if (
    error && 
    error.message && 
    (error.message.includes('topFocus') || error.message.includes('topBlur'))
  ) {
    // Silently ignore these specific errors
    return;
  }
  // Pass other errors to the default handler
  defaultHandler(error, isFatal);
});



const Stack = createNativeStackNavigator();
const HomeStack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const handleSignIn = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    const { error } = await signIn(email.trim(), password);
    if (error) {
      setError(error.message);
    }
    setLoading(false);
  };

  return (
    <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:20, width:'100%' }}>
      <Text>Email</Text>
      <TextInput
        style={{ borderWidth:1, width:'100%', marginBottom:8, padding:4 }}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <Text>Password</Text>
      <TextInput
        style={{ borderWidth:1, width:'100%', marginBottom:12, padding:4 }}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      {error && <Text style={{ color:'red', marginBottom:8 }}>{error}</Text>}
      {loading ? (
        <ActivityIndicator />
      ) : (
        <Button title="Sign in" onPress={handleSignIn} disabled={!email || !password} />
      )}
    </View>
  );
}

function RootNavigator() {
  const { user } = useAuth();
  
  // Set up push notifications when user is authenticated
  React.useEffect(() => {
    if (user) {
      // Initialize push notifications
      PushNotificationService.setupNotificationListeners();
      
      // Register for push notifications and save token
      PushNotificationService.registerForPushNotificationsAsync()
        .then((token) => {
          if (token && user.id) {
            // Save token to database
            PushNotificationService.savePushTokenToDatabase(user.id, token);
          }
        })
        .catch((error) => {
    
        });
    } else {
      // Clean up notification listeners when user logs out
      PushNotificationService.removeNotificationListeners();
    }
    
    // Cleanup on unmount
    return () => {
      PushNotificationService.removeNotificationListeners();
    };
  }, [user]);
  
  return (
    <Stack.Navigator screenOptions={{ headerShown:false }}>
      {user ? (
        <>
          <Stack.Screen name="Tabs" component={AuthedTabs} />
        </>
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="Forgot" component={ForgotPasswordScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

function GradientTabBackground() {
  return <View style={{ flex:1, backgroundColor: '#000' }} />;
}

function HomeStackScreen() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown:false }}>
      <HomeStack.Screen name="HomeMain" component={HomeDashboard} />
      <HomeStack.Screen name="Calendar" component={CalendarScreen} />
      <HomeStack.Screen name="Guidelines" component={GuidelinesScreen} />
      <HomeStack.Screen name="PastVybes" component={PastVybesScreen} />
      <HomeStack.Screen name="TrackedHosts" component={TrackedHostsScreen} />
      <HomeStack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
      <HomeStack.Screen name="ProfileSettings" component={ProfileSettingsScreen} />
      <HomeStack.Screen name="KybIntro" component={KybIntroScreen} />
      <HomeStack.Screen name="KybOnboarding" component={KybOnboardingScreen} />
      <HomeStack.Screen name="KybOnboardingClean" component={KybOnboardingClean} />
      <HomeStack.Screen name="KybOnboardingClean2" component={KybOnboardingScreen} />
      {/* Removed MoovComposablePiiWeb placeholder screen */}
      <HomeStack.Screen name="MoovTosScreen" component={MoovTosScreen} />
      <HomeStack.Screen name="MoovOnboardingWeb" component={MoovOnboardingWeb} />
      <HomeStack.Screen name="PaymentMethods" component={PaymentMethodsScreen} />
    </HomeStack.Navigator>
  );
}

function AuthedTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route })=>({
        headerShown:false,
        tabBarActiveTintColor:'#fff',
        tabBarInactiveTintColor:'#ffffffaa',
        tabBarStyle:{ backgroundColor: '#000', borderTopWidth:0, overflow:'visible' },
        tabBarBackground: () => <GradientTabBackground />,
        tabBarIcon: ({ color, size }) => {
          let icon;
          if(route.name==='Home') icon='home';
          else if(route.name==='Discover') icon='search';
          else if(route.name==='Host') icon='add-circle';
          return <Ionicons name={icon} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeStackScreen} options={{ headerShown:false }} />
      <Tab.Screen name="Discover" component={DiscoverScreen} />
      <Tab.Screen name="Host" component={HostCreateScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [splashDone, setSplashDone] = React.useState(false);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <OnboardingDraftProvider>
        <NavigationContainer>
          <StatusBar style="light" backgroundColor="#000" />
          <RootNavigator />
          {!splashDone && <SplashScreen onFinish={() => setSplashDone(true)} />}
        </NavigationContainer>
        </OnboardingDraftProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
