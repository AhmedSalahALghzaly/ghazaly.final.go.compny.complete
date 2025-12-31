import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  TextInput,
  Animated,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../../src/components/Header';
import { CategoryCard } from '../../src/components/CategoryCard';
import { OfferSlider } from '../../src/components/OfferSlider';
import { DynamicOfferSlider } from '../../src/components/DynamicOfferSlider';
import { InteractiveCarSelector } from '../../src/components/InteractiveCarSelector';
import { useTheme } from '../../src/hooks/useTheme';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useAppStore } from '../../src/store/appStore';
import { categoriesApi, carBrandsApi, carModelsApi, productBrandsApi, productsApi, cartApi, favoritesApi } from '../../src/services/api';
import { Skeleton, ProductCardSkeleton, CategoryCardSkeleton } from '../../src/components/ui/Skeleton';
import { syncService } from '../../src/services/syncService';

export default function HomeScreen() {
  const { colors } = useTheme();
  const { t, isRTL, language } = useTranslation();
  const router = useRouter();
  const { user, addToLocalCart } = useAppStore();

  const [categories, setCategories] = useState<any[]>([]);
  const [carBrands, setCarBrands] = useState<any[]>([]);
  const [carModels, setCarModels] = useState<any[]>([]);
  const [productBrands, setProductBrands] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Product Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchAnim = useRef(new Animated.Value(0)).current;

  // Favorites state
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    try {
      console.log('Fetching data...');
      const [catsRes, carBrandsRes, carModelsRes, prodBrandsRes, productsRes] = await Promise.all([
        categoriesApi.getTree(),
        carBrandsApi.getAll(),
        carModelsApi.getAll(),
        productBrandsApi.getAll(),
        productsApi.getAll({ limit: 20 }),
      ]);
      setCategories(catsRes.data || []);
      setCarBrands(carBrandsRes.data || []);
      setCarModels(carModelsRes.data || []);
      setProductBrands(prodBrandsRes.data || []);
      setProducts(productsRes.data?.products || []);
      setFilteredProducts(productsRes.data?.products || []);

      // Fetch favorites if user is logged in
      if (user) {
        try {
          const favRes = await favoritesApi.getAll();
          const favIds = new Set<string>((favRes.data?.favorites || []).map((f: any) => f.product_id));
          setFavorites(favIds);
        } catch (error) {
          console.error('Error fetching favorites:', error);
        }
      }
    } catch (error: any) {
      console.error('Error fetching data:', error?.message || error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Start background sync service
    syncService.start();
    return () => syncService.stop();
  }, []);

  // Refetch favorites when user changes
  useEffect(() => {
    if (user) {
      favoritesApi.getAll().then((res) => {
        const favIds = new Set<string>((res.data?.favorites || []).map((f: any) => f.product_id));
        setFavorites(favIds);
      }).catch(console.error);
    } else {
      setFavorites(new Set());
    }
  }, [user]);

  // Real-time product search
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredProducts(products);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = products.filter((product) => {
        const name = (product.name || '').toLowerCase();
        const nameAr = (product.name_ar || '').toLowerCase();
        const sku = (product.sku || '').toLowerCase();
        return name.includes(query) || nameAr.includes(query) || sku.includes(query);
      });
      setFilteredProducts(filtered);
    }
  }, [searchQuery, products]);

  // Search focus animation
  useEffect(() => {
    Animated.timing(searchAnim, {
      toValue: isSearchFocused ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isSearchFocused]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const getName = (item: any) => {
    return language === 'ar' && item.name_ar ? item.name_ar : item.name;
  };

  const handleAddToCart = async (product: any) => {
    if (!user) {
      router.push('/login');
      return;
    }
    try {
      await cartApi.addItem(product.id, 1);
      addToLocalCart({ product_id: product.id, quantity: 1, product });
    } catch (error) {
      console.error('Error adding to cart:', error);
    }
  };

  const handleToggleFavorite = async (productId: string) => {
    if (!user) {
      router.push('/login');
      return;
    }
    try {
      const response = await favoritesApi.toggle(productId);
      setFavorites((prev) => {
        const newSet = new Set(prev);
        if (response.data.is_favorite) {
          newSet.add(productId);
        } else {
          newSet.delete(productId);
        }
        return newSet;
      });
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header showBack={false} />
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Car Brands Skeleton */}
          <View style={styles.section}>
            <View style={[styles.sectionHeader, isRTL && styles.sectionHeaderRTL]}>
              <Skeleton width={120} height={20} />
              <Skeleton width={60} height={16} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
              {[1, 2, 3, 4].map((i) => (
                <View key={i} style={[styles.brandCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Skeleton width={50} height={50} borderRadius={25} style={{ marginBottom: 8 }} />
                  <Skeleton width={60} height={14} />
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Offers Skeleton */}
          <View style={styles.sliderSection}>
            <View style={[styles.sectionHeader, isRTL && styles.sectionHeaderRTL]}>
              <Skeleton width={140} height={20} />
            </View>
            <Skeleton height={160} borderRadius={12} style={{ marginHorizontal: 16 }} />
          </View>

          {/* Categories Skeleton */}
          <View style={styles.section}>
            <View style={[styles.sectionHeader, isRTL && styles.sectionHeaderRTL]}>
              <Skeleton width={100} height={20} />
              <Skeleton width={60} height={16} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
              {[1, 2, 3, 4].map((i) => (
                <CategoryCardSkeleton key={i} />
              ))}
            </ScrollView>
          </View>

          {/* Products Skeleton */}
          <View style={styles.section}>
            <View style={[styles.sectionHeader, isRTL && styles.sectionHeaderRTL]}>
              <Skeleton width={80} height={20} />
              <Skeleton width={60} height={16} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
              {[1, 2, 3].map((i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </ScrollView>
          </View>
        </ScrollView>
      </View>
    );
  }

  const searchBorderColor = searchAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, colors.primary],
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header showBack={false} />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        keyboardShouldPersistTaps="handled"
      >
        {/* 1. Car Brands Section - FIRST */}
        <View style={styles.section}>
          <View style={[styles.sectionHeader, isRTL && styles.sectionHeaderRTL]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('carBrands')}
            </Text>
            <TouchableOpacity onPress={() => router.push('/car-brands')}>
              <Text style={[styles.viewAll, { color: colors.primary }]}>
                {t('viewAll')}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScroll}
          >
            {carBrands.map((brand) => {
              const brandModels = carModels.filter((m) => m.brand_id === brand.id);
              return (
                <TouchableOpacity
                  key={brand.id}
                  style={[
                    styles.brandCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                  onPress={() => router.push(`/brand/${brand.id}`)}
                >
                  <View style={[styles.brandIcon, { backgroundColor: colors.primary + '15' }]}>
                    <Ionicons name="car-sport" size={28} color={colors.primary} />
                  </View>
                  <Text style={[styles.brandName, { color: colors.text }]}>
                    {getName(brand)}
                  </Text>
                  {brandModels.length > 0 && (
                    <Text style={[styles.brandModelsCount, { color: colors.textSecondary }]}>
                      {brandModels.length} {language === 'ar' ? 'موديل' : 'models'}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* 2. Dynamic Marketing Slider - SECOND */}
        <View style={styles.sliderSection}>
          <View style={[styles.sectionHeader, isRTL && styles.sectionHeaderRTL]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {language === 'ar' ? 'العروض الخاصة' : 'Special Offers'}
            </Text>
            <View style={[styles.liveBadge, { backgroundColor: colors.error + '20' }]}>
              <View style={[styles.liveDot, { backgroundColor: colors.error }]} />
              <Text style={[styles.liveText, { color: colors.error }]}>
                {language === 'ar' ? 'حصري' : 'EXCLUSIVE'}
              </Text>
            </View>
          </View>
          {/* Dynamic slider that fetches from marketing API */}
          <DynamicOfferSlider />
        </View>

        {/* 3. Car Models Section - THIRD */}
        {carModels.length > 0 && (
          <View style={styles.section}>
            <View style={[styles.sectionHeader, isRTL && styles.sectionHeaderRTL]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {language === 'ar' ? 'موديلات السيارات' : 'Car Models'}
              </Text>
              <TouchableOpacity onPress={() => router.push('/models')}>
                <Text style={[styles.viewAll, { color: colors.primary }]}>
                  {t('viewAll')}
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScroll}
            >
              {carModels.map((model) => (
                <TouchableOpacity
                  key={model.id}
                  style={[
                    styles.carModelCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                  onPress={() => router.push(`/car/${model.id}`)}
                >
                  <View style={[styles.carModelImageContainer, { backgroundColor: colors.surface }]}>
                    {model.image_url ? (
                      <Image
                        source={{ uri: model.image_url }}
                        style={styles.carModelImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <Ionicons name="car-sport" size={36} color={colors.textSecondary} />
                    )}
                  </View>
                  <View style={styles.carModelInfo}>
                    <Text style={[styles.carModelName, { color: colors.text }]} numberOfLines={1}>
                      {getName(model)}
                    </Text>
                    {model.year_start && model.year_end && (
                      <Text style={[styles.carModelYear, { color: colors.textSecondary }]}>
                        {model.year_start} - {model.year_end}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* 4. Categories Section - FOURTH */}
        <View style={styles.section}>
          <View style={[styles.sectionHeader, isRTL && styles.sectionHeaderRTL]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('shopByCategory')}
            </Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/categories')}>
              <Text style={[styles.viewAll, { color: colors.primary }]}>
                {t('viewAll')}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScroll}
          >
            {categories.map((category) => (
              <CategoryCard key={category.id} category={category} size="medium" />
            ))}
          </ScrollView>
        </View>

        {/* 5. Product Brands Section - FIFTH */}
        <View style={styles.section}>
          <View style={[styles.sectionHeader, isRTL && styles.sectionHeaderRTL]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('productBrands')}
            </Text>
            <TouchableOpacity onPress={() => router.push('/brands')}>
              <Text style={[styles.viewAll, { color: colors.primary }]}>
                {t('viewAll')}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScroll}
          >
            {productBrands.map((brand) => (
              <TouchableOpacity
                key={brand.id}
                style={[
                  styles.productBrandCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
                onPress={() => router.push(`/search?product_brand_id=${brand.id}`)}
              >
                <View style={[styles.productBrandIcon, { backgroundColor: colors.secondary + '15' }]}>
                  <Ionicons name="pricetag" size={28} color={colors.secondary} />
                </View>
                <Text style={[styles.productBrandName, { color: colors.text }]}>
                  {brand.name}
                </Text>
                <Text style={[styles.productBrandCount, { color: colors.textSecondary }]}>
                  {language === 'ar' ? 'عرض المنتجات' : 'View Products'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* 6. Products Section - SIXTH */}
        {filteredProducts.length > 0 && (
          <View style={styles.section}>
            <View style={[styles.sectionHeader, isRTL && styles.sectionHeaderRTL]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t('products')}
                {searchQuery && (
                  <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                    {' '}({filteredProducts.length})
                  </Text>
                )}
              </Text>
              <TouchableOpacity onPress={() => router.push('/search')}>
                <Text style={[styles.viewAll, { color: colors.primary }]}>
                  {t('viewAll')}
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScroll}
            >
              {filteredProducts.map((product) => {
                const isFavorite = favorites.has(product.id);
                return (
                  <TouchableOpacity
                    key={product.id}
                    style={[
                      styles.productCard,
                      { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                    onPress={() => router.push(`/product/${product.id}`)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.productImageContainer, { backgroundColor: colors.surface }]}>
                      {product.image_url ? (
                        <Image
                          source={{ uri: product.image_url }}
                          style={styles.productImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <Ionicons name="cube-outline" size={40} color={colors.textSecondary} />
                      )}
                    </View>
                    <View style={styles.productInfo}>
                      <Text style={[styles.productName, { color: colors.text }]} numberOfLines={2}>
                        {getName(product)}
                      </Text>
                      {product.sku && (
                        <Text style={[styles.productSku, { color: colors.textSecondary }]}>
                          SKU: {product.sku}
                        </Text>
                      )}
                      {/* Footer with Favorites button, Price, and Add to Cart button */}
                      <View style={styles.productFooter}>
                        {/* Favorites Button - Left */}
                        <TouchableOpacity
                          style={[
                            styles.productActionBtn, 
                            { 
                              backgroundColor: isFavorite ? colors.error : colors.surface,
                              borderColor: isFavorite ? colors.error : colors.border,
                              borderWidth: 1,
                            }
                          ]}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleToggleFavorite(product.id);
                          }}
                        >
                          <Ionicons 
                            name={isFavorite ? "heart" : "heart-outline"} 
                            size={16} 
                            color={isFavorite ? "#FFF" : colors.error} 
                          />
                        </TouchableOpacity>
                        
                        {/* Price - Center */}
                        <Text style={[styles.productPrice, { color: colors.primary }]}>
                          {product.price?.toFixed(2)} ج.م
                        </Text>
                        
                        {/* Add to Cart Button - Right */}
                        <TouchableOpacity
                          style={[styles.productActionBtn, { backgroundColor: colors.primary }]}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleAddToCart(product);
                          }}
                        >
                          <Ionicons name="add" size={16} color="#FFF" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* 7. Product Search Bar - SEVENTH (linked to products) */}
        <View style={styles.searchSection}>
          <Text style={[styles.searchLabel, { color: colors.text }]}>
            {language === 'ar' ? 'ابحث عن منتج' : 'Search Products'}
          </Text>
          <Animated.View
            style={[
              styles.searchInputContainer,
              {
                backgroundColor: colors.surface,
                borderColor: searchBorderColor,
              },
            ]}
          >
            <Ionicons
              name="search"
              size={20}
              color={isSearchFocused ? colors.primary : colors.textSecondary}
            />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder={language === 'ar' ? 'ادخل اسم المنتج أو SKU...' : 'Enter product name or SKU...'}
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  Keyboard.dismiss();
                }}
                style={styles.clearButton}
              >
                <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </Animated.View>
          
          {/* Search Results Indicator */}
          {searchQuery.length > 0 && (
            <View style={styles.searchResults}>
              <Ionicons
                name={filteredProducts.length > 0 ? 'checkmark-circle' : 'alert-circle'}
                size={16}
                color={filteredProducts.length > 0 ? colors.success : colors.error}
              />
              <Text
                style={[
                  styles.searchResultsText,
                  { color: filteredProducts.length > 0 ? colors.success : colors.error },
                ]}
              >
                {filteredProducts.length > 0
                  ? language === 'ar'
                    ? `تم العثور على ${filteredProducts.length} منتج`
                    : `Found ${filteredProducts.length} products`
                  : language === 'ar'
                  ? 'لا توجد نتائج'
                  : 'No results found'}
              </Text>
            </View>
          )}
        </View>

        {/* Bottom padding */}
        <View style={{ height: 140 }} />
      </ScrollView>
      
      {/* Interactive Car Selector - Bottom Anchor */}
      <InteractiveCarSelector />
    </View>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  section: {
    marginTop: 16,
  },
  sliderSection: {
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionHeaderRTL: {
    flexDirection: 'row-reverse',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  viewAll: {
    fontSize: 14,
    fontWeight: '600',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveText: {
    fontSize: 11,
    fontWeight: '700',
  },
  horizontalScroll: {
    paddingHorizontal: 16,
  },
  brandCard: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
  },
  brandIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  brandName: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  brandModelsCount: {
    fontSize: 10,
    marginTop: 2,
  },
  productBrandCard: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
  },
  productBrandIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  productBrandName: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  productBrandCount: {
    fontSize: 10,
    marginTop: 2,
  },
  carModelCard: {
    width: 140,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 6,
    overflow: 'hidden',
  },
  carModelImageContainer: {
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carModelImage: {
    width: '100%',
    height: '100%',
  },
  carModelInfo: {
    padding: 10,
  },
  carModelName: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  carModelYear: {
    fontSize: 11,
  },
  productCard: {
    width: 150,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 6,
    overflow: 'hidden',
  },
  productImageContainer: {
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productInfo: {
    padding: 10,
  },
  productName: {
    fontSize: 13,
    fontWeight: '500',
    height: 36,
    marginBottom: 2,
  },
  productSku: {
    fontSize: 10,
    marginBottom: 4,
  },
  productFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  productPrice: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  productActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchSection: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  searchLabel: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  clearButton: {
    padding: 4,
  },
  searchResults: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 6,
  },
  searchResultsText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
