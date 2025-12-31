/**
 * Marketing Suite - Admin Panel
 * Manages Promotions (Banners/Sliders) and Bundle Offers
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
  Switch,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/hooks/useTheme';
import { useTranslation } from '../../src/hooks/useTranslation';
import { Header } from '../../src/components/Header';
import { promotionApi, bundleOfferApi, productApi, carModelApi } from '../../src/services/api';

interface Promotion {
  id: string;
  title: string;
  title_ar?: string;
  image?: string;
  promotion_type: 'slider' | 'banner';
  is_active: boolean;
  target_product_id?: string;
  target_car_model_id?: string;
  target_product?: any;
  target_car_model?: any;
  sort_order: number;
}

interface BundleOffer {
  id: string;
  name: string;
  name_ar?: string;
  description?: string;
  discount_percentage: number;
  target_car_model_id?: string;
  target_car_model?: any;
  product_ids: string[];
  products?: any[];
  image?: string;
  is_active: boolean;
  original_total?: number;
  discounted_total?: number;
}

type ActiveTab = 'promotions' | 'bundles';

export default function MarketingSuiteScreen() {
  const { colors } = useTheme();
  const { language, isRTL } = useTranslation();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<ActiveTab>('promotions');
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [bundleOffers, setBundleOffers] = useState<BundleOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal states
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [showBundleModal, setShowBundleModal] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [editingBundle, setEditingBundle] = useState<BundleOffer | null>(null);

  // Form states for promotion
  const [promoTitle, setPromoTitle] = useState('');
  const [promoTitleAr, setPromoTitleAr] = useState('');
  const [promoImage, setPromoImage] = useState('');
  const [promoType, setPromoType] = useState<'slider' | 'banner'>('slider');
  const [promoIsActive, setPromoIsActive] = useState(true);
  const [promoTargetType, setPromoTargetType] = useState<'product' | 'car_model'>('product');
  const [promoTargetProductId, setPromoTargetProductId] = useState('');
  const [promoTargetCarModelId, setPromoTargetCarModelId] = useState('');

  // Form states for bundle
  const [bundleName, setBundleName] = useState('');
  const [bundleNameAr, setBundleNameAr] = useState('');
  const [bundleDescription, setBundleDescription] = useState('');
  const [bundleDiscount, setBundleDiscount] = useState('');
  const [bundleImage, setBundleImage] = useState('');
  const [bundleIsActive, setBundleIsActive] = useState(true);
  const [bundleTargetCarModelId, setBundleTargetCarModelId] = useState('');
  const [bundleProductIds, setBundleProductIds] = useState<string[]>([]);

  // Selector states
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [showCarModelSelector, setShowCarModelSelector] = useState(false);
  const [selectorMode, setSelectorMode] = useState<'promo' | 'bundle'>('promo');
  const [products, setProducts] = useState<any[]>([]);
  const [carModels, setCarModels] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [saving, setSaving] = useState(false);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const [promosRes, bundlesRes, productsRes, modelsRes] = await Promise.all([
        promotionApi.getAll(),
        bundleOfferApi.getAll(),
        productApi.getAll({ limit: 1000 }),
        carModelApi.getAll(),
      ]);
      setPromotions(promosRes.data || []);
      setBundleOffers(bundlesRes.data || []);
      setProducts(productsRes.data?.products || []);
      setCarModels(modelsRes.data || []);
    } catch (error) {
      console.error('Error fetching marketing data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Reset promotion form
  const resetPromotionForm = () => {
    setPromoTitle('');
    setPromoTitleAr('');
    setPromoImage('');
    setPromoType('slider');
    setPromoIsActive(true);
    setPromoTargetType('product');
    setPromoTargetProductId('');
    setPromoTargetCarModelId('');
    setEditingPromotion(null);
  };

  // Reset bundle form
  const resetBundleForm = () => {
    setBundleName('');
    setBundleNameAr('');
    setBundleDescription('');
    setBundleDiscount('');
    setBundleImage('');
    setBundleIsActive(true);
    setBundleTargetCarModelId('');
    setBundleProductIds([]);
    setEditingBundle(null);
  };

  // Open edit promotion
  const openEditPromotion = (promo: Promotion) => {
    setEditingPromotion(promo);
    setPromoTitle(promo.title);
    setPromoTitleAr(promo.title_ar || '');
    setPromoImage(promo.image || '');
    setPromoType(promo.promotion_type);
    setPromoIsActive(promo.is_active);
    if (promo.target_product_id) {
      setPromoTargetType('product');
      setPromoTargetProductId(promo.target_product_id);
    } else if (promo.target_car_model_id) {
      setPromoTargetType('car_model');
      setPromoTargetCarModelId(promo.target_car_model_id);
    }
    setShowPromotionModal(true);
  };

  // Open edit bundle
  const openEditBundle = (bundle: BundleOffer) => {
    setEditingBundle(bundle);
    setBundleName(bundle.name);
    setBundleNameAr(bundle.name_ar || '');
    setBundleDescription(bundle.description || '');
    setBundleDiscount(bundle.discount_percentage.toString());
    setBundleImage(bundle.image || '');
    setBundleIsActive(bundle.is_active);
    setBundleTargetCarModelId(bundle.target_car_model_id || '');
    setBundleProductIds(bundle.product_ids || []);
    setShowBundleModal(true);
  };

  // Save promotion
  const savePromotion = async () => {
    if (!promoTitle.trim()) {
      Alert.alert('Error', 'Title is required');
      return;
    }
    if (!promoTargetProductId && !promoTargetCarModelId) {
      Alert.alert('Error', 'Please select a target (Product or Car Model)');
      return;
    }

    setSaving(true);
    try {
      const data = {
        title: promoTitle,
        title_ar: promoTitleAr || null,
        image: promoImage || null,
        promotion_type: promoType,
        is_active: promoIsActive,
        target_product_id: promoTargetType === 'product' ? promoTargetProductId : null,
        target_car_model_id: promoTargetType === 'car_model' ? promoTargetCarModelId : null,
        sort_order: editingPromotion?.sort_order || promotions.length,
      };

      if (editingPromotion) {
        await promotionApi.update(editingPromotion.id, data);
      } else {
        await promotionApi.create(data);
      }

      setShowPromotionModal(false);
      resetPromotionForm();
      fetchData();
    } catch (error) {
      console.error('Error saving promotion:', error);
      Alert.alert('Error', 'Failed to save promotion');
    } finally {
      setSaving(false);
    }
  };

  // Save bundle
  const saveBundle = async () => {
    if (!bundleName.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }
    if (!bundleDiscount || parseFloat(bundleDiscount) <= 0) {
      Alert.alert('Error', 'Valid discount percentage is required');
      return;
    }
    if (bundleProductIds.length === 0) {
      Alert.alert('Error', 'Please select at least one product');
      return;
    }

    setSaving(true);
    try {
      const data = {
        name: bundleName,
        name_ar: bundleNameAr || null,
        description: bundleDescription || null,
        discount_percentage: parseFloat(bundleDiscount),
        target_car_model_id: bundleTargetCarModelId || null,
        product_ids: bundleProductIds,
        image: bundleImage || null,
        is_active: bundleIsActive,
      };

      if (editingBundle) {
        await bundleOfferApi.update(editingBundle.id, data);
      } else {
        await bundleOfferApi.create(data);
      }

      setShowBundleModal(false);
      resetBundleForm();
      fetchData();
    } catch (error) {
      console.error('Error saving bundle:', error);
      Alert.alert('Error', 'Failed to save bundle offer');
    } finally {
      setSaving(false);
    }
  };

  // Delete promotion
  const deletePromotion = async (id: string) => {
    Alert.alert(
      language === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete',
      language === 'ar' ? 'هل أنت متأكد من حذف هذا العرض؟' : 'Are you sure you want to delete this promotion?',
      [
        { text: language === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: language === 'ar' ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await promotionApi.delete(id);
              fetchData();
            } catch (error) {
              console.error('Error deleting promotion:', error);
            }
          },
        },
      ]
    );
  };

  // Delete bundle
  const deleteBundle = async (id: string) => {
    Alert.alert(
      language === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete',
      language === 'ar' ? 'هل أنت متأكد من حذف هذا العرض؟' : 'Are you sure you want to delete this bundle?',
      [
        { text: language === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: language === 'ar' ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await bundleOfferApi.delete(id);
              fetchData();
            } catch (error) {
              console.error('Error deleting bundle:', error);
            }
          },
        },
      ]
    );
  };

  // Filter items by search
  const filteredProducts = products.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.name_ar?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q)
    );
  });

  const filteredCarModels = carModels.filter((m) => {
    const q = searchQuery.toLowerCase();
    return m.name?.toLowerCase().includes(q) || m.name_ar?.toLowerCase().includes(q);
  });

  // Get selected product/model names
  const getSelectedProductName = (id: string) => {
    const product = products.find((p) => p.id === id);
    return product ? (language === 'ar' ? product.name_ar : product.name) || product.name : '';
  };

  const getSelectedCarModelName = (id: string) => {
    const model = carModels.find((m) => m.id === id);
    return model ? (language === 'ar' ? model.name_ar : model.name) || model.name : '';
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
        <Header title={language === 'ar' ? 'جناح التسويق' : 'Marketing Suite'} showBack />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <Header title={language === 'ar' ? 'جناح التسويق' : 'Marketing Suite'} showBack />

      {/* Tabs */}
      <View style={[styles.tabContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'promotions' && { backgroundColor: colors.primary }]}
          onPress={() => setActiveTab('promotions')}
        >
          <Ionicons
            name="megaphone"
            size={20}
            color={activeTab === 'promotions' ? '#FFF' : colors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'promotions' ? '#FFF' : colors.textSecondary },
            ]}
          >
            {language === 'ar' ? 'الترويج' : 'Promotions'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'bundles' && { backgroundColor: colors.primary }]}
          onPress={() => setActiveTab('bundles')}
        >
          <Ionicons
            name="gift"
            size={20}
            color={activeTab === 'bundles' ? '#FFF' : colors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'bundles' ? '#FFF' : colors.textSecondary },
            ]}
          >
            {language === 'ar' ? 'العروض المجمعة' : 'Bundle Offers'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {activeTab === 'promotions' ? (
          <View style={styles.section}>
            {/* Add Button */}
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                resetPromotionForm();
                setShowPromotionModal(true);
              }}
            >
              <Ionicons name="add" size={24} color="#FFF" />
              <Text style={styles.addButtonText}>
                {language === 'ar' ? 'إضافة عرض ترويجي' : 'Add Promotion'}
              </Text>
            </TouchableOpacity>

            {/* Promotions List */}
            {promotions.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="megaphone-outline" size={48} color={colors.textSecondary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {language === 'ar' ? 'لا توجد عروض ترويجية' : 'No promotions yet'}
                </Text>
              </View>
            ) : (
              promotions.map((promo) => (
                <View
                  key={promo.id}
                  style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={styles.itemHeader}>
                    {promo.image ? (
                      <Image source={{ uri: promo.image }} style={styles.itemImage} />
                    ) : (
                      <View style={[styles.itemImagePlaceholder, { backgroundColor: colors.surface }]}>
                        <Ionicons name="image-outline" size={24} color={colors.textSecondary} />
                      </View>
                    )}
                    <View style={styles.itemInfo}>
                      <Text style={[styles.itemTitle, { color: colors.text }]}>{promo.title}</Text>
                      <View style={styles.itemBadges}>
                        <View
                          style={[
                            styles.badge,
                            { backgroundColor: promo.promotion_type === 'slider' ? '#3B82F6' : '#10B981' },
                          ]}
                        >
                          <Text style={styles.badgeText}>
                            {promo.promotion_type === 'slider'
                              ? language === 'ar'
                                ? 'سلايدر'
                                : 'Slider'
                              : language === 'ar'
                              ? 'بانر'
                              : 'Banner'}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.badge,
                            { backgroundColor: promo.is_active ? '#10B981' : '#EF4444' },
                          ]}
                        >
                          <Text style={styles.badgeText}>
                            {promo.is_active
                              ? language === 'ar'
                                ? 'نشط'
                                : 'Active'
                              : language === 'ar'
                              ? 'غير نشط'
                              : 'Inactive'}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.itemTarget, { color: colors.textSecondary }]}>
                        {promo.target_product
                          ? `→ ${promo.target_product.name}`
                          : promo.target_car_model
                          ? `→ ${promo.target_car_model.name}`
                          : ''}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.itemActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: colors.primary + '20' }]}
                      onPress={() => openEditPromotion(promo)}
                    >
                      <Ionicons name="pencil" size={18} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: colors.error + '20' }]}
                      onPress={() => deletePromotion(promo.id)}
                    >
                      <Ionicons name="trash" size={18} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        ) : (
          <View style={styles.section}>
            {/* Add Button */}
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                resetBundleForm();
                setShowBundleModal(true);
              }}
            >
              <Ionicons name="add" size={24} color="#FFF" />
              <Text style={styles.addButtonText}>
                {language === 'ar' ? 'إضافة عرض مجمع' : 'Add Bundle Offer'}
              </Text>
            </TouchableOpacity>

            {/* Bundle Offers List */}
            {bundleOffers.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="gift-outline" size={48} color={colors.textSecondary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {language === 'ar' ? 'لا توجد عروض مجمعة' : 'No bundle offers yet'}
                </Text>
              </View>
            ) : (
              bundleOffers.map((bundle) => (
                <View
                  key={bundle.id}
                  style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={styles.itemHeader}>
                    {bundle.image ? (
                      <Image source={{ uri: bundle.image }} style={styles.itemImage} />
                    ) : (
                      <View style={[styles.itemImagePlaceholder, { backgroundColor: colors.surface }]}>
                        <Ionicons name="gift" size={24} color={colors.textSecondary} />
                      </View>
                    )}
                    <View style={styles.itemInfo}>
                      <Text style={[styles.itemTitle, { color: colors.text }]}>{bundle.name}</Text>
                      <View style={styles.itemBadges}>
                        <View style={[styles.badge, { backgroundColor: '#F59E0B' }]}>
                          <Text style={styles.badgeText}>{bundle.discount_percentage}% OFF</Text>
                        </View>
                        <View
                          style={[
                            styles.badge,
                            { backgroundColor: bundle.is_active ? '#10B981' : '#EF4444' },
                          ]}
                        >
                          <Text style={styles.badgeText}>
                            {bundle.is_active
                              ? language === 'ar'
                                ? 'نشط'
                                : 'Active'
                              : language === 'ar'
                              ? 'غير نشط'
                              : 'Inactive'}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.itemTarget, { color: colors.textSecondary }]}>
                        {bundle.product_ids?.length || 0}{' '}
                        {language === 'ar' ? 'منتجات' : 'products'}
                        {bundle.target_car_model && ` • ${bundle.target_car_model.name}`}
                      </Text>
                      {bundle.original_total && bundle.discounted_total && (
                        <View style={styles.priceRow}>
                          <Text style={[styles.originalPrice, { color: colors.textSecondary }]}>
                            {bundle.original_total.toFixed(2)} EGP
                          </Text>
                          <Text style={[styles.discountedPrice, { color: colors.success }]}>
                            {bundle.discounted_total.toFixed(2)} EGP
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.itemActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: colors.primary + '20' }]}
                      onPress={() => openEditBundle(bundle)}
                    >
                      <Ionicons name="pencil" size={18} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: colors.error + '20' }]}
                      onPress={() => deleteBundle(bundle.id)}
                    >
                      <Ionicons name="trash" size={18} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Promotion Modal */}
      <Modal visible={showPromotionModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editingPromotion
                  ? language === 'ar'
                    ? 'تعديل العرض'
                    : 'Edit Promotion'
                  : language === 'ar'
                  ? 'إضافة عرض جديد'
                  : 'Add Promotion'}
              </Text>
              <TouchableOpacity onPress={() => setShowPromotionModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={[styles.label, { color: colors.text }]}>
                {language === 'ar' ? 'العنوان' : 'Title'} *
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                value={promoTitle}
                onChangeText={setPromoTitle}
                placeholder={language === 'ar' ? 'أدخل العنوان' : 'Enter title'}
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={[styles.label, { color: colors.text }]}>
                {language === 'ar' ? 'العنوان بالعربية' : 'Title (Arabic)'}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                value={promoTitleAr}
                onChangeText={setPromoTitleAr}
                placeholder={language === 'ar' ? 'أدخل العنوان بالعربية' : 'Enter Arabic title'}
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={[styles.label, { color: colors.text }]}>
                {language === 'ar' ? 'رابط الصورة' : 'Image URL'}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                value={promoImage}
                onChangeText={setPromoImage}
                placeholder="https://..."
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={[styles.label, { color: colors.text }]}>
                {language === 'ar' ? 'نوع العرض' : 'Promotion Type'}
              </Text>
              <View style={styles.typeSelector}>
                <TouchableOpacity
                  style={[
                    styles.typeOption,
                    { backgroundColor: promoType === 'slider' ? colors.primary : colors.surface, borderColor: colors.border },
                  ]}
                  onPress={() => setPromoType('slider')}
                >
                  <Text style={{ color: promoType === 'slider' ? '#FFF' : colors.text }}>
                    {language === 'ar' ? 'سلايدر' : 'Slider'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeOption,
                    { backgroundColor: promoType === 'banner' ? colors.primary : colors.surface, borderColor: colors.border },
                  ]}
                  onPress={() => setPromoType('banner')}
                >
                  <Text style={{ color: promoType === 'banner' ? '#FFF' : colors.text }}>
                    {language === 'ar' ? 'بانر' : 'Banner'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.switchRow}>
                <Text style={[styles.label, { color: colors.text, marginBottom: 0 }]}>
                  {language === 'ar' ? 'نشط' : 'Active'}
                </Text>
                <Switch value={promoIsActive} onValueChange={setPromoIsActive} />
              </View>

              <Text style={[styles.label, { color: colors.text }]}>
                {language === 'ar' ? 'الاستهداف' : 'Targeting'} *
              </Text>
              <View style={styles.typeSelector}>
                <TouchableOpacity
                  style={[
                    styles.typeOption,
                    { backgroundColor: promoTargetType === 'product' ? colors.primary : colors.surface, borderColor: colors.border },
                  ]}
                  onPress={() => {
                    setPromoTargetType('product');
                    setPromoTargetCarModelId('');
                  }}
                >
                  <Text style={{ color: promoTargetType === 'product' ? '#FFF' : colors.text }}>
                    {language === 'ar' ? 'منتج' : 'Product'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeOption,
                    { backgroundColor: promoTargetType === 'car_model' ? colors.primary : colors.surface, borderColor: colors.border },
                  ]}
                  onPress={() => {
                    setPromoTargetType('car_model');
                    setPromoTargetProductId('');
                  }}
                >
                  <Text style={{ color: promoTargetType === 'car_model' ? '#FFF' : colors.text }}>
                    {language === 'ar' ? 'موديل سيارة' : 'Car Model'}
                  </Text>
                </TouchableOpacity>
              </View>

              {promoTargetType === 'product' ? (
                <TouchableOpacity
                  style={[styles.selectorButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => {
                    setSelectorMode('promo');
                    setSearchQuery('');
                    setShowProductSelector(true);
                  }}
                >
                  <Text style={{ color: promoTargetProductId ? colors.text : colors.textSecondary }}>
                    {promoTargetProductId
                      ? getSelectedProductName(promoTargetProductId)
                      : language === 'ar'
                      ? 'اختر منتج'
                      : 'Select Product'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.selectorButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => {
                    setSelectorMode('promo');
                    setSearchQuery('');
                    setShowCarModelSelector(true);
                  }}
                >
                  <Text style={{ color: promoTargetCarModelId ? colors.text : colors.textSecondary }}>
                    {promoTargetCarModelId
                      ? getSelectedCarModelName(promoTargetCarModelId)
                      : language === 'ar'
                      ? 'اختر موديل سيارة'
                      : 'Select Car Model'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: colors.border }]}
                onPress={() => setShowPromotionModal(false)}
              >
                <Text style={{ color: colors.text }}>{language === 'ar' ? 'إلغاء' : 'Cancel'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: colors.primary }]}
                onPress={savePromotion}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={{ color: '#FFF', fontWeight: '600' }}>
                    {language === 'ar' ? 'حفظ' : 'Save'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bundle Modal */}
      <Modal visible={showBundleModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editingBundle
                  ? language === 'ar'
                    ? 'تعديل العرض المجمع'
                    : 'Edit Bundle Offer'
                  : language === 'ar'
                  ? 'إضافة عرض مجمع'
                  : 'Add Bundle Offer'}
              </Text>
              <TouchableOpacity onPress={() => setShowBundleModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={[styles.label, { color: colors.text }]}>
                {language === 'ar' ? 'اسم العرض' : 'Offer Name'} *
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                value={bundleName}
                onChangeText={setBundleName}
                placeholder={language === 'ar' ? 'مثال: عرض الفرامل الصيفي' : 'e.g., Summer Brake Special'}
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={[styles.label, { color: colors.text }]}>
                {language === 'ar' ? 'نسبة الخصم %' : 'Discount %'} *
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                value={bundleDiscount}
                onChangeText={setBundleDiscount}
                keyboardType="numeric"
                placeholder="15"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={[styles.label, { color: colors.text }]}>
                {language === 'ar' ? 'رابط الصورة' : 'Image URL'}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                value={bundleImage}
                onChangeText={setBundleImage}
                placeholder="https://..."
                placeholderTextColor={colors.textSecondary}
              />

              <View style={styles.switchRow}>
                <Text style={[styles.label, { color: colors.text, marginBottom: 0 }]}>
                  {language === 'ar' ? 'نشط' : 'Active'}
                </Text>
                <Switch value={bundleIsActive} onValueChange={setBundleIsActive} />
              </View>

              <Text style={[styles.label, { color: colors.text }]}>
                {language === 'ar' ? 'موديل السيارة المستهدف' : 'Target Car Model'}
              </Text>
              <TouchableOpacity
                style={[styles.selectorButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => {
                  setSelectorMode('bundle');
                  setSearchQuery('');
                  setShowCarModelSelector(true);
                }}
              >
                <Text style={{ color: bundleTargetCarModelId ? colors.text : colors.textSecondary }}>
                  {bundleTargetCarModelId
                    ? getSelectedCarModelName(bundleTargetCarModelId)
                    : language === 'ar'
                    ? 'اختر موديل (اختياري)'
                    : 'Select Model (optional)'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
              </TouchableOpacity>

              <Text style={[styles.label, { color: colors.text }]}>
                {language === 'ar' ? 'المنتجات' : 'Products'} * ({bundleProductIds.length})
              </Text>
              <TouchableOpacity
                style={[styles.selectorButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => {
                  setSelectorMode('bundle');
                  setSearchQuery('');
                  setShowProductSelector(true);
                }}
              >
                <Text style={{ color: bundleProductIds.length > 0 ? colors.text : colors.textSecondary }}>
                  {bundleProductIds.length > 0
                    ? `${bundleProductIds.length} ${language === 'ar' ? 'منتجات مختارة' : 'products selected'}`
                    : language === 'ar'
                    ? 'اختر المنتجات'
                    : 'Select Products'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
              </TouchableOpacity>

              {bundleProductIds.length > 0 && (
                <View style={styles.selectedProducts}>
                  {bundleProductIds.map((pid) => (
                    <View key={pid} style={[styles.selectedChip, { backgroundColor: colors.primary + '20' }]}>
                      <Text style={{ color: colors.primary, fontSize: 12 }}>
                        {getSelectedProductName(pid)}
                      </Text>
                      <TouchableOpacity
                        onPress={() => setBundleProductIds((prev) => prev.filter((id) => id !== pid))}
                      >
                        <Ionicons name="close-circle" size={16} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: colors.border }]}
                onPress={() => setShowBundleModal(false)}
              >
                <Text style={{ color: colors.text }}>{language === 'ar' ? 'إلغاء' : 'Cancel'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: colors.primary }]}
                onPress={saveBundle}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={{ color: '#FFF', fontWeight: '600' }}>
                    {language === 'ar' ? 'حفظ' : 'Save'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Product Selector Modal */}
      <Modal visible={showProductSelector} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.selectorModal, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {language === 'ar' ? 'اختر المنتجات' : 'Select Products'}
              </Text>
              <TouchableOpacity onPress={() => setShowProductSelector(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.searchInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={language === 'ar' ? 'بحث...' : 'Search...'}
              placeholderTextColor={colors.textSecondary}
            />
            <FlatList
              data={filteredProducts}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const isSelected =
                  selectorMode === 'promo'
                    ? promoTargetProductId === item.id
                    : bundleProductIds.includes(item.id);
                return (
                  <TouchableOpacity
                    style={[
                      styles.selectorItem,
                      { backgroundColor: isSelected ? colors.primary + '20' : colors.surface, borderColor: colors.border },
                    ]}
                    onPress={() => {
                      if (selectorMode === 'promo') {
                        setPromoTargetProductId(item.id);
                        setShowProductSelector(false);
                      } else {
                        if (isSelected) {
                          setBundleProductIds((prev) => prev.filter((id) => id !== item.id));
                        } else {
                          setBundleProductIds((prev) => [...prev, item.id]);
                        }
                      }
                    }}
                  >
                    <View>
                      <Text style={[styles.selectorItemTitle, { color: colors.text }]}>
                        {language === 'ar' ? item.name_ar : item.name || item.name}
                      </Text>
                      <Text style={[styles.selectorItemSubtitle, { color: colors.textSecondary }]}>
                        {item.sku} • {item.price?.toFixed(2)} EGP
                      </Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={24} color={colors.primary} />}
                  </TouchableOpacity>
                );
              }}
            />
            {selectorMode === 'bundle' && (
              <TouchableOpacity
                style={[styles.doneButton, { backgroundColor: colors.primary }]}
                onPress={() => setShowProductSelector(false)}
              >
                <Text style={{ color: '#FFF', fontWeight: '600' }}>
                  {language === 'ar' ? 'تم' : 'Done'} ({bundleProductIds.length})
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* Car Model Selector Modal */}
      <Modal visible={showCarModelSelector} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.selectorModal, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {language === 'ar' ? 'اختر موديل السيارة' : 'Select Car Model'}
              </Text>
              <TouchableOpacity onPress={() => setShowCarModelSelector(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.searchInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={language === 'ar' ? 'بحث...' : 'Search...'}
              placeholderTextColor={colors.textSecondary}
            />
            <FlatList
              data={filteredCarModels}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const isSelected =
                  selectorMode === 'promo'
                    ? promoTargetCarModelId === item.id
                    : bundleTargetCarModelId === item.id;
                return (
                  <TouchableOpacity
                    style={[
                      styles.selectorItem,
                      { backgroundColor: isSelected ? colors.primary + '20' : colors.surface, borderColor: colors.border },
                    ]}
                    onPress={() => {
                      if (selectorMode === 'promo') {
                        setPromoTargetCarModelId(item.id);
                      } else {
                        setBundleTargetCarModelId(item.id);
                      }
                      setShowCarModelSelector(false);
                    }}
                  >
                    <View>
                      <Text style={[styles.selectorItemTitle, { color: colors.text }]}>
                        {language === 'ar' ? item.name_ar : item.name || item.name}
                      </Text>
                      {item.year_start && item.year_end && (
                        <Text style={[styles.selectorItemSubtitle, { color: colors.textSecondary }]}>
                          {item.year_start} - {item.year_end}
                        </Text>
                      )}
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={24} color={colors.primary} />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  tabText: {
    fontWeight: '600',
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
  },
  addButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 15,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
  },
  itemCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  itemHeader: {
    flexDirection: 'row',
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  itemImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
  },
  itemBadges: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
  },
  itemTarget: {
    fontSize: 12,
  },
  priceRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  originalPrice: {
    fontSize: 12,
    textDecorationLine: 'line-through',
  },
  discountedPrice: {
    fontSize: 12,
    fontWeight: '600',
  },
  itemActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  selectorModal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalBody: {
    padding: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 10,
  },
  typeOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  selectorButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
  },
  selectedProducts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    fontSize: 15,
  },
  selectorItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  selectorItemTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  selectorItemSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  doneButton: {
    margin: 16,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
});
