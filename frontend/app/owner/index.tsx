/**
 * Owner Interface Dashboard
 * The advanced owner interface with icon grid and live metrics with deep-linking
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAppStore, useColorMood } from '../../src/store/appStore';
import { SyncIndicator } from '../../src/components/ui/SyncIndicator';
import { useWebSocket } from '../../src/services/websocketService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Dashboard icon configuration
const DASHBOARD_ICONS = [
  { id: 'customers', icon: 'people', label: 'Customers', labelAr: 'العملاء', color: '#3B82F6', route: '/owner/customers' },
  { id: 'admins', icon: 'shield-checkmark', label: 'Admins', labelAr: 'المسؤولين', color: '#10B981', route: '/owner/admins' },
  { id: 'collection', icon: 'cube', label: 'Collection', labelAr: 'المجموعة', color: '#F59E0B', route: '/owner/collection' },
  { id: 'subscriptions', icon: 'card', label: 'Subscriptions', labelAr: 'الاشتراكات', color: '#8B5CF6', route: '/owner/subscriptions' },
  { id: 'analytics', icon: 'bar-chart', label: 'Analytics', labelAr: 'التحليلات', color: '#EC4899', route: '/owner/analytics' },
  { id: 'suppliers', icon: 'briefcase', label: 'Suppliers', labelAr: 'الموردين', color: '#14B8A6', route: '/owner/suppliers' },
  { id: 'distributors', icon: 'car', label: 'Distributors', labelAr: 'الموزعين', color: '#EF4444', route: '/owner/distributors' },
  { id: 'settings', icon: 'settings', label: 'Settings', labelAr: 'الإعدادات', color: '#6B7280', route: '/owner/settings' },
];

export default function OwnerDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const storedMood = useColorMood();
  const language = useAppStore((state) => state.language);
  const user = useAppStore((state) => state.user);
  const orders = useAppStore((state) => state.orders);
  const customers = useAppStore((state) => state.customers);
  const products = useAppStore((state) => state.products);
  const setOrderFilter = useAppStore((state) => state.setOrderFilter);

  // Default mood fallback
  const defaultMood = {
    primary: '#3B82F6',
    background: '#F0F9FF',
    surface: '#FFFFFF',
    text: '#1E3A5F',
    textSecondary: '#64748B',
    border: '#E2E8F0',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    card: '#FFFFFF',
    tabBar: '#FFFFFF',
    tabBarActive: '#3B82F6',
    tabBarInactive: '#9CA3AF',
    gradient: ['#1E1E3F', '#2D2D5F', '#3D3D7F'],
  };

  // Use stored mood or default
  const mood = storedMood || defaultMood;

  // Get gradient colors safely
  const gradientColors = (mood as any).gradient && Array.isArray((mood as any).gradient) && (mood as any).gradient.length >= 3
    ? (mood as any).gradient
    : ['#1E1E3F', '#2D2D5F', '#3D3D7F'];

  // Connect WebSocket for real-time updates
  useWebSocket();

  // Calculate live metrics from store
  const metrics = {
    todayOrders: orders.filter((o: any) => {
      const today = new Date().toDateString();
      return new Date(o.created_at).toDateString() === today;
    }).length,
    pendingOrders: orders.filter((o: any) => o.status === 'pending').length,
    totalRevenue: orders.reduce((sum: number, o: any) => sum + (o.total || 0), 0),
    activeCustomers: customers.length,
    totalProducts: products.length,
    lowStock: products.filter((p: any) => (p.quantity || p.stock_quantity || 0) < 10).length,
  };

  const isRTL = language === 'ar';

  const handleIconPress = (route: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(route as any);
  };

  // Handle metric press - deep link to filtered orders
  const handleMetricPress = (metricType: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    switch (metricType) {
      case 'todayOrders':
        setOrderFilter?.({ type: 'today' });
        router.push('/owner/orders?filter=today' as any);
        break;
      case 'pendingOrders':
        setOrderFilter?.({ status: 'pending' });
        router.push('/owner/orders?filter=pending' as any);
        break;
      case 'totalRevenue':
        router.push('/owner/analytics' as any);
        break;
      case 'activeCustomers':
        router.push('/owner/customers' as any);
        break;
      case 'totalProducts':
        router.push('/admin/products' as any);
        break;
      case 'lowStock':
        setOrderFilter?.({ type: 'lowStock' });
        router.push('/admin/products?filter=lowstock' as any);
        break;
      default:
        break;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Gradient Background */}
      <LinearGradient
        colors={gradientColors as [string, string, string]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, isRTL && styles.headerRTL]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons
              name={isRTL ? 'arrow-forward' : 'arrow-back'}
              size={24}
              color="#FFFFFF"
            />
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>
              {language === 'ar' ? 'لوحة التحكم' : 'Owner Dashboard'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {user?.name || user?.email}
            </Text>
          </View>

          <SyncIndicator compact />
        </View>

        {/* Icon Grid */}
        <View style={styles.gridContainer}>
          <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>
            {language === 'ar' ? 'الإدارة' : 'Management'}
          </Text>
          
          <View style={styles.iconGrid}>
            {DASHBOARD_ICONS.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.iconCard}
                onPress={() => handleIconPress(item.route)}
                activeOpacity={0.7}
              >
                <BlurView intensity={20} tint="light" style={styles.iconBlur}>
                  <View style={[styles.iconCircle, { backgroundColor: item.color + '30' }]}>
                    <Ionicons name={item.icon as any} size={28} color={item.color} />
                  </View>
                  <Text style={styles.iconLabel}>
                    {isRTL ? item.labelAr : item.label}
                  </Text>
                </BlurView>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Live Metrics Panel - Clickable */}
        <View style={styles.metricsContainer}>
          <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>
            {language === 'ar' ? 'المقاييس الحية' : 'Live Metrics'}
          </Text>
          <Text style={[styles.sectionSubtitle, isRTL && styles.textRTL]}>
            {language === 'ar' ? 'اضغط للتفاصيل' : 'Tap for details'}
          </Text>

          <View style={styles.metricsGrid}>
            <MetricCard
              icon="receipt"
              label={language === 'ar' ? 'طلبات اليوم' : 'Today Orders'}
              value={metrics.todayOrders}
              color="#3B82F6"
              onPress={() => handleMetricPress('todayOrders')}
            />
            <MetricCard
              icon="time"
              label={language === 'ar' ? 'قيد الانتظار' : 'Pending'}
              value={metrics.pendingOrders}
              color="#F59E0B"
              pulse={metrics.pendingOrders > 0}
              onPress={() => handleMetricPress('pendingOrders')}
            />
            <MetricCard
              icon="cash"
              label={language === 'ar' ? 'الإيرادات' : 'Revenue'}
              value={`${(metrics.totalRevenue / 1000).toFixed(1)}K`}
              color="#10B981"
              onPress={() => handleMetricPress('totalRevenue')}
            />
            <MetricCard
              icon="people"
              label={language === 'ar' ? 'العملاء' : 'Customers'}
              value={metrics.activeCustomers}
              color="#8B5CF6"
              onPress={() => handleMetricPress('activeCustomers')}
            />
            <MetricCard
              icon="cube"
              label={language === 'ar' ? 'المنتجات' : 'Products'}
              value={metrics.totalProducts}
              color="#EC4899"
              onPress={() => handleMetricPress('totalProducts')}
            />
            <MetricCard
              icon="alert"
              label={language === 'ar' ? 'مخزون منخفض' : 'Low Stock'}
              value={metrics.lowStock}
              color="#EF4444"
              pulse={metrics.lowStock > 0}
              onPress={() => handleMetricPress('lowStock')}
            />
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.quickStatsContainer}>
          <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>
            {language === 'ar' ? 'إحصائيات سريعة' : 'Quick Stats'}
          </Text>
          
          <View style={styles.quickStatsRow}>
            <View style={styles.quickStatCard}>
              <BlurView intensity={15} tint="light" style={styles.quickStatBlur}>
                <Text style={styles.quickStatValue}>
                  {orders.filter((o: any) => o.status === 'delivered').length}
                </Text>
                <Text style={styles.quickStatLabel}>
                  {language === 'ar' ? 'تم التسليم' : 'Delivered'}
                </Text>
              </BlurView>
            </View>
            <View style={styles.quickStatCard}>
              <BlurView intensity={15} tint="light" style={styles.quickStatBlur}>
                <Text style={styles.quickStatValue}>
                  {orders.filter((o: any) => o.status === 'shipped').length}
                </Text>
                <Text style={styles.quickStatLabel}>
                  {language === 'ar' ? 'قيد الشحن' : 'Shipped'}
                </Text>
              </BlurView>
            </View>
            <View style={styles.quickStatCard}>
              <BlurView intensity={15} tint="light" style={styles.quickStatBlur}>
                <Text style={styles.quickStatValue}>
                  {orders.filter((o: any) => o.status === 'cancelled').length}
                </Text>
                <Text style={styles.quickStatLabel}>
                  {language === 'ar' ? 'ملغي' : 'Cancelled'}
                </Text>
              </BlurView>
            </View>
          </View>
        </View>

        {/* Bottom padding */}
        <View style={{ height: insets.bottom + 40 }} />
      </ScrollView>
    </View>
  );
}

// Metric Card Component with Press Handler
interface MetricCardProps {
  icon: string;
  label: string;
  value: number | string;
  color: string;
  pulse?: boolean;
  onPress?: () => void;
}

const MetricCard: React.FC<MetricCardProps> = ({ icon, label, value, color, pulse, onPress }) => {
  return (
    <TouchableOpacity style={styles.metricCard} onPress={onPress} activeOpacity={0.7}>
      <BlurView intensity={15} tint="light" style={styles.metricBlur}>
        <View style={[styles.metricIconContainer, { backgroundColor: color + '20' }]}>
          <Ionicons name={icon as any} size={20} color={color} />
          {pulse && <View style={[styles.pulseDot, { backgroundColor: color }]} />}
        </View>
        <Text style={styles.metricValue}>{value}</Text>
        <Text style={styles.metricLabel}>{label}</Text>
        <View style={styles.metricArrow}>
          <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.4)" />
        </View>
      </BlurView>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E1E3F',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  headerRTL: {
    flexDirection: 'row-reverse',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 16,
  },
  textRTL: {
    textAlign: 'right',
  },
  gridContainer: {
    marginTop: 24,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  iconCard: {
    width: (SCREEN_WIDTH - 56) / 4,
    aspectRatio: 0.85,
    borderRadius: 16,
    overflow: 'hidden',
  },
  iconBlur: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  iconLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  metricsContainer: {
    marginTop: 32,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    width: (SCREEN_WIDTH - 52) / 3,
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  metricBlur: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  metricIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  pulseDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  metricLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginTop: 4,
  },
  metricArrow: {
    position: 'absolute',
    bottom: 8,
    right: 8,
  },
  quickStatsContainer: {
    marginTop: 32,
  },
  quickStatsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  quickStatCard: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  quickStatBlur: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  quickStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  quickStatLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
});
