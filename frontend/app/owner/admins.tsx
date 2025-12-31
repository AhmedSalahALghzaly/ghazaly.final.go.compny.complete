/**
 * Admins Management Screen - Full CRUD with Revenue Settlement
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '../../src/store/appStore';
import { adminApi } from '../../src/services/api';
import { VoidDeleteGesture } from '../../src/components/ui/VoidDeleteGesture';
import { ErrorCapsule } from '../../src/components/ui/ErrorCapsule';
import { ConfettiEffect } from '../../src/components/ui/ConfettiEffect';

export default function AdminsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const language = useAppStore((state) => state.language);
  const admins = useAppStore((state) => state.admins);
  const setAdmins = useAppStore((state) => state.setAdmins);
  const isRTL = language === 'ar';

  // Local state
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [expandedAdminId, setExpandedAdminId] = useState<string | null>(null);
  const [adminProducts, setAdminProducts] = useState<any[]>([]);

  // Fetch admins
  const fetchAdmins = async () => {
    try {
      const res = await adminApi.getAll();
      setAdmins(res.data || []);
    } catch (err) {
      console.error('Error fetching admins:', err);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAdmins();
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchAdmins();
  }, []);

  // Add admin with optimistic update
  const handleAddAdmin = async () => {
    if (!newEmail.trim()) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticAdmin = {
      id: tempId,
      email: newEmail.trim(),
      name: newName.trim() || newEmail.split('@')[0],
      revenue: 0,
      products_added: 0,
      products_delivered: 0,
      products_processing: 0,
    };

    // Optimistic update
    setAdmins([...admins, optimisticAdmin]);
    setShowAddModal(false);
    setNewEmail('');
    setNewName('');
    setShowConfetti(true);

    try {
      setLoading(true);
      const res = await adminApi.create(newEmail.trim(), newName.trim() || undefined);
      // Replace temp with real data
      setAdmins(admins.filter(a => a.id !== tempId).concat(res.data));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      // Rollback optimistic update
      setAdmins(admins.filter(a => a.id !== tempId));
      setError(err.response?.data?.detail || 'Failed to add admin');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  // Delete admin with optimistic update
  const handleDeleteAdmin = async (adminId: string) => {
    const adminToDelete = admins.find(a => a.id === adminId);
    if (!adminToDelete) return;

    // Optimistic update
    setAdmins(admins.filter(a => a.id !== adminId));

    try {
      await adminApi.delete(adminId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      // Rollback
      setAdmins([...admins, adminToDelete]);
      setError(err.response?.data?.detail || 'Failed to delete admin');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  // Long press to reset revenue
  const handleLongPressReset = (admin: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      language === 'ar' ? 'إعادة تعيين الإيرادات' : 'Reset Revenue',
      language === 'ar' 
        ? `هل تريد إعادة تعيين إيرادات ${admin.name}؟` 
        : `Reset revenue for ${admin.name}?`,
      [
        { text: language === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' },
        { 
          text: language === 'ar' ? 'إعادة تعيين' : 'Reset', 
          style: 'destructive',
          onPress: () => handleClearRevenue(admin.id),
        },
      ]
    );
  };

  // Clear revenue with optimistic update
  const handleClearRevenue = async (adminId: string) => {
    const prevAdmins = [...admins];
    
    // Optimistic update
    setAdmins(admins.map(a => a.id === adminId ? { ...a, revenue: 0 } : a));

    try {
      await adminApi.clearRevenue(adminId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      // Rollback
      setAdmins(prevAdmins);
      setError(err.response?.data?.detail || 'Failed to reset revenue');
    }
  };

  // Expand admin to show products
  const handleExpandAdmin = async (adminId: string) => {
    if (expandedAdminId === adminId) {
      setExpandedAdminId(null);
      setAdminProducts([]);
      return;
    }

    setExpandedAdminId(adminId);
    try {
      const res = await adminApi.getProducts(adminId);
      setAdminProducts(res.data || []);
    } catch (err) {
      console.error('Error fetching admin products:', err);
      setAdminProducts([]);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#065F46', '#059669', '#10B981']} style={StyleSheet.absoluteFill} />
      
      {/* Error Capsule */}
      <ErrorCapsule
        message={error || ''}
        visible={!!error}
        onDismiss={() => setError(null)}
        type="error"
      />

      {/* Confetti */}
      <ConfettiEffect active={showConfetti} onComplete={() => setShowConfetti(false)} />

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFF" />
        }
      >
        {/* Header */}
        <View style={[styles.header, isRTL && styles.headerRTL]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isRTL ? 'المسؤولين' : 'Admins'}</Text>
          <TouchableOpacity 
            style={styles.addButton} 
            onPress={() => setShowAddModal(true)}
          >
            <Ionicons name="add" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Stats Summary */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{admins.length}</Text>
            <Text style={styles.statLabel}>{isRTL ? 'إجمالي' : 'Total'}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {admins.reduce((sum, a) => sum + (a.products_added || 0), 0)}
            </Text>
            <Text style={styles.statLabel}>{isRTL ? 'المنتجات' : 'Products'}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {(admins.reduce((sum, a) => sum + (a.revenue || 0), 0) / 1000).toFixed(1)}K
            </Text>
            <Text style={styles.statLabel}>{isRTL ? 'الإيرادات' : 'Revenue'}</Text>
          </View>
        </View>

        {/* Admins List */}
        <View style={styles.listContainer}>
          {admins.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="shield-outline" size={64} color="rgba(255,255,255,0.5)" />
              <Text style={styles.emptyText}>{isRTL ? 'لا يوجد مسؤولين' : 'No admins yet'}</Text>
            </View>
          ) : (
            admins.map((admin: any) => (
              <VoidDeleteGesture key={admin.id} onDelete={() => handleDeleteAdmin(admin.id)}>
                <TouchableOpacity 
                  style={styles.card}
                  onPress={() => handleExpandAdmin(admin.id)}
                  onLongPress={() => handleLongPressReset(admin)}
                  delayLongPress={800}
                >
                  <BlurView intensity={15} tint="light" style={styles.cardBlur}>
                    <View style={styles.cardHeader}>
                      <View style={styles.avatar}>
                        <Ionicons name="shield-checkmark" size={24} color="#10B981" />
                      </View>
                      <View style={styles.info}>
                        <Text style={styles.name}>{admin.name || admin.email}</Text>
                        <Text style={styles.email}>{admin.email}</Text>
                      </View>
                      <View style={styles.revenueBox}>
                        <Text style={styles.revenueValue}>{admin.revenue || 0}</Text>
                        <Text style={styles.revenueLabel}>ج.م</Text>
                      </View>
                    </View>

                    {/* Stats Row */}
                    <View style={styles.adminStats}>
                      <View style={styles.adminStat}>
                        <Ionicons name="cube" size={16} color="#FFF" />
                        <Text style={styles.adminStatText}>{admin.products_added || 0}</Text>
                      </View>
                      <View style={styles.adminStat}>
                        <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                        <Text style={styles.adminStatText}>{admin.products_delivered || 0}</Text>
                      </View>
                      <View style={styles.adminStat}>
                        <Ionicons name="time" size={16} color="#F59E0B" />
                        <Text style={styles.adminStatText}>{admin.products_processing || 0}</Text>
                      </View>
                      <Ionicons 
                        name={expandedAdminId === admin.id ? 'chevron-up' : 'chevron-down'} 
                        size={20} 
                        color="rgba(255,255,255,0.5)" 
                      />
                    </View>

                    {/* Expanded Products */}
                    {expandedAdminId === admin.id && (
                      <View style={styles.expandedSection}>
                        <Text style={styles.expandedTitle}>
                          {isRTL ? 'المنتجات' : 'Products'}
                        </Text>
                        {adminProducts.length === 0 ? (
                          <Text style={styles.noProducts}>
                            {isRTL ? 'لا توجد منتجات' : 'No products'}
                          </Text>
                        ) : (
                          adminProducts.slice(0, 5).map((product: any) => (
                            <View key={product.id} style={styles.productRow}>
                              <Text style={styles.productName} numberOfLines={1}>
                                {product.name}
                              </Text>
                              <Text style={styles.productPrice}>{product.price} ج.م</Text>
                            </View>
                          ))
                        )}
                        {adminProducts.length > 5 && (
                          <Text style={styles.moreProducts}>
                            +{adminProducts.length - 5} {isRTL ? 'منتجات أخرى' : 'more products'}
                          </Text>
                        )}
                      </View>
                    )}

                    {/* Long press hint */}
                    <Text style={styles.longPressHint}>
                      {isRTL ? 'اضغط مطولاً لإعادة تعيين' : 'Long press to reset revenue'}
                    </Text>
                  </BlurView>
                </TouchableOpacity>
              </VoidDeleteGesture>
            ))
          )}
        </View>

        <View style={{ height: insets.bottom + 40 }} />
      </ScrollView>

      {/* Add Admin Modal */}
      {showAddModal && (
        <View style={styles.modalOverlay}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {isRTL ? 'إضافة مسؤول جديد' : 'Add New Admin'}
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder={isRTL ? 'البريد الإلكتروني' : 'Email'}
              placeholderTextColor="#9CA3AF"
              value={newEmail}
              onChangeText={setNewEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={styles.modalInput}
              placeholder={isRTL ? 'الاسم (اختياري)' : 'Name (optional)'}
              placeholderTextColor="#9CA3AF"
              value={newName}
              onChangeText={setNewName}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.cancelButtonText}>{isRTL ? 'إلغاء' : 'Cancel'}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleAddAdmin}
                disabled={loading}
              >
                <Text style={styles.confirmButtonText}>{isRTL ? 'إضافة' : 'Add'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 12 },
  headerRTL: { flexDirection: 'row-reverse' },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 24, fontWeight: '700', color: '#FFF' },
  addButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  statBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 16, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '700', color: '#FFF' },
  statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  listContainer: { marginTop: 24 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: 'rgba(255,255,255,0.5)', fontSize: 16, marginTop: 16 },
  card: { marginBottom: 12, borderRadius: 16, overflow: 'hidden' },
  cardBlur: { padding: 16, backgroundColor: 'rgba(255,255,255,0.1)' },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(16,185,129,0.2)', alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, marginLeft: 12 },
  name: { fontSize: 16, fontWeight: '600', color: '#FFF' },
  email: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  revenueBox: { alignItems: 'flex-end' },
  revenueValue: { fontSize: 20, fontWeight: '700', color: '#10B981' },
  revenueLabel: { fontSize: 10, color: 'rgba(255,255,255,0.5)' },
  adminStats: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 16 },
  adminStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  adminStatText: { fontSize: 14, color: '#FFF', fontWeight: '600' },
  expandedSection: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  expandedTitle: { fontSize: 14, fontWeight: '600', color: '#FFF', marginBottom: 8 },
  noProducts: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  productRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  productName: { flex: 1, fontSize: 13, color: '#FFF' },
  productPrice: { fontSize: 13, color: '#10B981', fontWeight: '600' },
  moreProducts: { fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 8 },
  longPressHint: { fontSize: 10, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 12 },
  modalOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { backgroundColor: '#FFF', borderRadius: 20, padding: 24, width: '100%', maxWidth: 340 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1F2937', marginBottom: 20, textAlign: 'center' },
  modalInput: { backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, marginBottom: 12, color: '#1F2937' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalButton: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  cancelButton: { backgroundColor: '#F3F4F6' },
  cancelButtonText: { fontSize: 16, fontWeight: '600', color: '#6B7280' },
  confirmButton: { backgroundColor: '#10B981' },
  confirmButtonText: { fontSize: 16, fontWeight: '600', color: '#FFF' },
});
