import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../src/hooks/useTheme';
import { useTranslation } from '../src/hooks/useTranslation';
import { useAppStore, useHasHydrated } from '../src/store/appStore';
import { authApi } from '../src/services/api';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://go-compo-dev.preview.emergentagent.com';

export default function LoginScreen() {
  const { colors } = useTheme();
  const { t, isRTL } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const hasHydrated = useHasHydrated();
  
  // Get store actions directly from store for atomic updates
  const setUser = useAppStore((state) => state.setUser);
  const setSessionToken = useAppStore((state) => state.setSessionToken);
  const setUserRole = useAppStore((state) => state.setUserRole);
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);

  const [loading, setLoading] = useState(false);
  const [processingAuth, setProcessingAuth] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Track component mount state
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // Reactive navigation - auto-redirect when authenticated (with safety delay)
  useEffect(() => {
    if (hasHydrated && isAuthenticated && isMounted) {
      console.log('Login screen: User already authenticated, redirecting...');
      // Use setTimeout to ensure router is ready
      const timer = setTimeout(() => {
        router.replace('/(tabs)');
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, hasHydrated, isMounted]);

  // Handle initial URL (cold start)
  useEffect(() => {
    const checkInitialUrl = async () => {
      const url = await Linking.getInitialURL();
      if (url) {
        handleAuthUrl(url);
      }
    };
    checkInitialUrl();
  }, []);

  // Handle web auth callback - check URL on mount and on hash changes
  useEffect(() => {
    if (Platform.OS === 'web') {
      const processWebAuth = () => {
        // Check hash first
        const hash = window.location.hash;
        if (hash && hash.includes('session_id=')) {
          const sessionId = hash.split('session_id=')[1]?.split('&')[0];
          if (sessionId) {
            console.log('Found session_id in hash:', sessionId);
            processSessionId(sessionId);
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
            return;
          }
        }
        
        // Check search params
        const searchParams = new URLSearchParams(window.location.search);
        const sessionId = searchParams.get('session_id');
        if (sessionId) {
          console.log('Found session_id in query:', sessionId);
          processSessionId(sessionId);
          // Clean URL
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
        }
        
        // Check full URL for any session_id
        const fullUrl = window.location.href;
        if (fullUrl.includes('session_id=')) {
          const match = fullUrl.match(/session_id=([^&]+)/);
          if (match && match[1]) {
            console.log('Found session_id in full URL:', match[1]);
            processSessionId(match[1]);
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }
      };
      
      // Process immediately
      processWebAuth();
      
      // Also listen for hash changes (in case of redirects)
      const handleHashChange = () => processWebAuth();
      window.addEventListener('hashchange', handleHashChange);
      
      return () => {
        window.removeEventListener('hashchange', handleHashChange);
      };
    }
  }, []);

  const handleAuthUrl = (url: string) => {
    // Parse session_id from URL
    let sessionId: string | null = null;
    
    if (url.includes('#session_id=')) {
      sessionId = url.split('#session_id=')[1]?.split('&')[0];
    } else if (url.includes('?session_id=')) {
      sessionId = url.split('?session_id=')[1]?.split('&')[0];
    }
    
    if (sessionId) {
      processSessionId(sessionId);
    }
  };

  const processSessionId = async (sessionId: string) => {
    if (processingAuth) return; // Prevent duplicate processing
    
    setProcessingAuth(true);
    console.log('Processing session ID:', sessionId);
    
    try {
      const response = await authApi.exchangeSession(sessionId);
      console.log('Auth response:', response.data);
      
      const { user: userData, session_token } = response.data;
      
      if (!userData || !session_token) {
        console.error('Invalid auth response - missing user or token');
        setProcessingAuth(false);
        return;
      }
      
      console.log('Auth successful, setting user data...');
      
      // ATOMIC UPDATE: Set all auth state in one go
      setUser(userData, session_token);
      if (userData.role) {
        setUserRole(userData.role);
      }
      
      console.log('User set, will navigate via AuthGuard or manually...');
      
      // The AuthGuard should handle navigation automatically
      // But we add a fallback with longer delay to ensure state is synced
      setTimeout(() => {
        // Check if still on login page (AuthGuard didn't trigger)
        if (window.location.pathname.includes('login')) {
          console.log('Manual navigation fallback triggered');
          router.replace('/(tabs)');
        }
      }, 500);
      
    } catch (error: any) {
      console.error('Auth error:', error?.response?.data || error?.message || error);
      setProcessingAuth(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    
    try {
      // Create redirect URL based on platform
      const redirectUrl = Platform.OS === 'web'
        ? `${BACKEND_URL}/login`
        : Linking.createURL('/login');
      
      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
      
      if (Platform.OS === 'web') {
        window.location.href = authUrl;
      } else {
        const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
        
        if (result.type === 'success' && result.url) {
          handleAuthUrl(result.url);
        }
      }
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Show loading while processing auth or before hydration
  if (processingAuth || (!hasHydrated)) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          {t('loading')}
        </Text>
      </View>
    );
  }

  return (
    <View style={[
      styles.container, 
      { backgroundColor: colors.background, paddingTop: insets.top }
    ]}>
      {/* Close Button */}
      <TouchableOpacity
        style={[styles.closeButton, isRTL ? { left: 16 } : { right: 16 }]}
        onPress={() => router.back()}
      >
        <Ionicons name="close" size={28} color={colors.text} />
      </TouchableOpacity>

      {/* Logo */}
      <View style={styles.logoContainer}>
        <View style={[styles.logoCircle, { backgroundColor: colors.primary }]}>
          <Ionicons name="car-sport" size={60} color="#FFF" />
        </View>
        <Text style={[styles.appName, { color: colors.primary }]}>
          {t('appName')}
        </Text>
        <Text style={[styles.tagline, { color: colors.textSecondary }]}>
          {t('appTagline')}
        </Text>
      </View>

      {/* Login Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.googleButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={handleGoogleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <Ionicons name="logo-google" size={24} color="#DB4437" />
              <Text style={[styles.googleButtonText, { color: colors.text }]}>
                {t('loginWithGoogle')}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    padding: 8,
    zIndex: 10,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  appName: {
    fontSize: 36,
    fontWeight: '800',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 320,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
});
