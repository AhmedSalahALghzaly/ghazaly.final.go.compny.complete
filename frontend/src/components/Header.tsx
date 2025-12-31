import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, StatusBar, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';
import { useAppStore } from '../store/appStore';
import { SyncIndicator } from './ui/SyncIndicator';

// Logo image URL
const LOGO_URL = 'https://customer-assets.emergentagent.com/job_carcomponents-3/artifacts/nipikb4p_1317.jpg';

// Admin emails that can access the Branch Page
const ADMIN_EMAILS = [
  'ahmed.salah.ghazaly.91@gmail.com',
  'ahmed.salah.mohamed.ai2025@gmail.com',
];

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  showSearch?: boolean;
  showCart?: boolean;
  showSettings?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  showBack = false,
  showSearch = true,
  showCart = true,
  showSettings = true,
}) => {
  const { colors, isDark } = useTheme();
  const { t, isRTL } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toggleTheme = useAppStore((state) => state.setTheme);
  const theme = useAppStore((state) => state.theme);
  const language = useAppStore((state) => state.language);
  const setLanguage = useAppStore((state) => state.setLanguage);
  const cartItems = useAppStore((state) => state.cartItems);
  const user = useAppStore((state) => state.user);
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  // Header is always white background
  const headerBgColor = '#FFFFFF';
  const headerTextColor = '#1a1a2e';
  const headerIconColor = '#1a1a2e';

  return (
    <View style={[
      styles.container, 
      { 
        backgroundColor: headerBgColor,
        paddingTop: insets.top,
        borderBottomColor: isDark ? '#e0e0e0' : colors.border,
      }
    ]}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={headerBgColor}
      />
      
      <View style={[styles.content, isRTL && styles.contentRTL]}>
        {/* Logo Section with Brand Text - Far right in RTL, Far left in LTR */}
        {!showBack && (
          <TouchableOpacity 
            style={[styles.logoSection, isRTL && styles.logoSectionRTL]}
            onPress={() => router.push('/')}
            activeOpacity={0.8}
          >
            <Image
              source={{ uri: LOGO_URL }}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={[styles.brandText, { color: colors.primary }]}>
              {language === 'ar' ? 'لقطع غيار السيارات' : 'AUTO PARTS'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Back Button with Title - Only when showBack is true */}
        {showBack && (
          <View style={[styles.backSection, isRTL && styles.backSectionRTL]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
              <Ionicons 
                name={isRTL ? 'arrow-forward' : 'arrow-back'} 
                size={24} 
                color={headerIconColor} 
              />
            </TouchableOpacity>
            {title && (
              <Text style={[styles.title, { color: headerTextColor }]} numberOfLines={1}>
                {title}
              </Text>
            )}
          </View>
        )}

        {/* Spacer to push icons to the other side */}
        <View style={styles.spacer} />

        {/* Icons Section - Far left in RTL, Far right in LTR */}
        <View style={[styles.iconsSection, isRTL && styles.iconsSectionRTL]}>
          {/* Sync Indicator - Compact version */}
          <SyncIndicator compact />

          {/* Admin Panel Icon - Only visible for authorized admins */}
          {user && ADMIN_EMAILS.includes(user.email?.toLowerCase()) && (
            <TouchableOpacity 
              onPress={() => router.push('/admin')} 
              style={styles.iconButton}
            >
              <Ionicons name="shield-checkmark" size={22} color="#6366f1" />
            </TouchableOpacity>
          )}

          {showSearch && (
            <TouchableOpacity 
              onPress={() => router.push('/search')} 
              style={styles.iconButton}
            >
              <Ionicons name="search" size={22} color={headerIconColor} />
            </TouchableOpacity>
          )}

          {/* Dark Mode Toggle */}
          <TouchableOpacity onPress={() => toggleTheme(theme === 'dark' ? 'light' : 'dark')} style={styles.iconButton}>
            <Ionicons 
              name={isDark ? 'sunny' : 'moon'} 
              size={22} 
              color={headerIconColor} 
            />
          </TouchableOpacity>

          {/* Language Toggle */}
          <TouchableOpacity 
            onPress={() => setLanguage(language === 'en' ? 'ar' : 'en')} 
            style={styles.iconButton}
          >
            <Text style={[styles.langText, { color: headerIconColor }]}>
              {language === 'en' ? 'عر' : 'EN'}
            </Text>
          </TouchableOpacity>

          {showCart && (
            <TouchableOpacity 
              onPress={() => router.push('/(tabs)/cart')} 
              style={styles.iconButton}
            >
              <Ionicons name="cart-outline" size={22} color={headerIconColor} />
              {cartCount > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.error }]}>
                  <Text style={styles.badgeText}>{cartCount > 9 ? '9+' : cartCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            onPress={() => router.push('/(tabs)/profile')} 
            style={styles.iconButton}
          >
            <Ionicons 
              name={user ? 'person' : 'person-outline'} 
              size={22} 
              color={headerIconColor} 
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    height: 60,
  },
  contentRTL: {
    flexDirection: 'row-reverse',
  },
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logoSectionRTL: {
    flexDirection: 'row-reverse',
  },
  logoImage: {
    width: 65,  // 50 * 1.3 = 65 (30% larger)
    height: 52, // 40 * 1.3 = 52 (30% larger)
  },
  brandText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  backSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backSectionRTL: {
    flexDirection: 'row-reverse',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  spacer: {
    flex: 1,
  },
  iconsSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconsSectionRTL: {
    flexDirection: 'row-reverse',
  },
  iconButton: {
    padding: 6,
    position: 'relative',
  },
  langText: {
    fontSize: 13,
    fontWeight: '700',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '700',
  },
});
