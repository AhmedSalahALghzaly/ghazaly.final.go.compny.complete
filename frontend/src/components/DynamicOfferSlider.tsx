/**
 * Dynamic Offer Slider - Fetches from Marketing API
 * Displays both Promotions and Bundle Offers
 */
import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
  ScrollView,
  ImageBackground,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from '../hooks/useTranslation';
import { useTheme } from '../hooks/useTheme';
import { marketingApi } from '../services/api';

const { width } = Dimensions.get('window');
const SLIDER_WIDTH = width - 40;

// Fallback images
const FALLBACK_IMAGES = [
  'https://customer-assets.emergentagent.com/job_run-al-project/artifacts/04kxu3h3_car-brake-parts-and-components-displayed-on-a-whit-2025-12-08-16-53-24-utc.jpg',
  'https://customer-assets.emergentagent.com/job_run-al-project/artifacts/e0wpx2r9_car-parts-2025-02-25-15-02-08-utc.jpg',
  'https://customer-assets.emergentagent.com/job_run-al-project/artifacts/yt3zfrnf_car-parts-2025-02-24-20-10-48-utc%20%282%29.jpg',
];

// Color palettes for slides
const COLOR_PALETTES = [
  { gradient: ['rgba(102, 126, 234, 0.85)', 'rgba(118, 75, 162, 0.9)'], accent: '#667EEA', icon: '#FF6B35' },
  { gradient: ['rgba(17, 153, 142, 0.85)', 'rgba(56, 239, 125, 0.9)'], accent: '#11998E', icon: '#FFD93D' },
  { gradient: ['rgba(255, 107, 107, 0.85)', 'rgba(255, 142, 83, 0.9)'], accent: '#FF6B6B', icon: '#4ECDC4' },
  { gradient: ['rgba(59, 130, 246, 0.85)', 'rgba(147, 51, 234, 0.9)'], accent: '#3B82F6', icon: '#F59E0B' },
  { gradient: ['rgba(236, 72, 153, 0.85)', 'rgba(139, 92, 246, 0.9)'], accent: '#EC4899', icon: '#10B981' },
];

interface SliderItem {
  id: string;
  type: 'promotion' | 'bundle_offer';
  title: string;
  title_ar?: string;
  image?: string;
  discount_percentage?: number;
  original_total?: number;
  discounted_total?: number;
  product_count?: number;
  target_product?: any;
  target_car_model?: any;
  is_active: boolean;
}

interface DynamicOfferSliderProps {
  compact?: boolean;
  showArrows?: boolean;
  hideIcon?: boolean;
  onOfferChange?: (index: number) => void;
  initialIndex?: number;
}

export const DynamicOfferSlider: React.FC<DynamicOfferSliderProps> = ({ 
  compact = false, 
  showArrows = false,
  hideIcon = false,
  onOfferChange,
  initialIndex = 0,
}) => {
  const router = useRouter();
  const { language } = useTranslation();
  const { colors, isDark } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [sliderItems, setSliderItems] = useState<SliderItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Animation refs
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const arrowLeftAnim = useRef(new Animated.Value(0)).current;
  const arrowRightAnim = useRef(new Animated.Value(0)).current;

  // Fetch marketing data
  const fetchSliderData = useCallback(async () => {
    try {
      const response = await marketingApi.getHomeSlider();
      const items = response.data || [];
      if (items.length > 0) {
        setSliderItems(items);
      } else {
        // Use fallback static offers if no dynamic data
        setSliderItems(getStaticOffers());
      }
    } catch (error) {
      console.error('Error fetching slider data:', error);
      setSliderItems(getStaticOffers());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSliderData();
  }, [fetchSliderData]);

  // Auto-scroll only on home page (not compact)
  useEffect(() => {
    if (compact || sliderItems.length === 0) return;
    const interval = setInterval(() => {
      const nextIndex = (currentIndex + 1) % sliderItems.length;
      scrollRef.current?.scrollTo({ x: nextIndex * (SLIDER_WIDTH + 12), animated: true });
      setCurrentIndex(nextIndex);
      onOfferChange?.(nextIndex);
    }, 5000);
    return () => clearInterval(interval);
  }, [currentIndex, compact, sliderItems.length]);

  // Pulse animation for icon
  useEffect(() => {
    if (hideIcon) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, [hideIcon]);

  // Glow animation
  useEffect(() => {
    if (hideIcon) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, [hideIcon]);

  // Rotation animation for icon
  useEffect(() => {
    if (hideIcon) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(rotateAnim, { toValue: 1, duration: 4000, useNativeDriver: true }),
        Animated.timing(rotateAnim, { toValue: 0, duration: 4000, useNativeDriver: true }),
      ])
    ).start();
  }, [hideIcon]);

  const handleScroll = (event: any) => {
    const x = event.nativeEvent.contentOffset.x;
    const index = Math.round(x / (SLIDER_WIDTH + 12));
    if (index !== currentIndex && index >= 0 && index < sliderItems.length) {
      setCurrentIndex(index);
      onOfferChange?.(index);
    }
  };

  const goToSlide = (index: number) => {
    scrollRef.current?.scrollTo({ x: index * (SLIDER_WIDTH + 12), animated: true });
    setCurrentIndex(index);
    onOfferChange?.(index);
  };

  const handlePrevious = () => {
    const prevIndex = currentIndex === 0 ? sliderItems.length - 1 : currentIndex - 1;
    goToSlide(prevIndex);
    Animated.sequence([
      Animated.timing(arrowLeftAnim, { toValue: -8, duration: 120, useNativeDriver: true }),
      Animated.timing(arrowLeftAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
    ]).start();
  };

  const handleNext = () => {
    const nextIndex = (currentIndex + 1) % sliderItems.length;
    goToSlide(nextIndex);
    Animated.sequence([
      Animated.timing(arrowRightAnim, { toValue: 8, duration: 120, useNativeDriver: true }),
      Animated.timing(arrowRightAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
    ]).start();
  };

  const handleItemPress = (item: SliderItem) => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.85, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1.1, duration: 120, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start(() => {
      if (item.type === 'bundle_offer') {
        // Navigate to bundle offer details
        router.push(`/offer/${item.id}`);
      } else if (item.type === 'promotion') {
        // Smart navigation based on target
        if (item.target_product) {
          router.push(`/product/${item.target_product.id}`);
        } else if (item.target_car_model) {
          router.push(`/car/${item.target_car_model.id}`);
        }
      }
    });
  };

  const getTitle = (item: SliderItem) => language === 'ar' ? (item.title_ar || item.title) : item.title;
  
  const getColorPalette = (index: number) => COLOR_PALETTES[index % COLOR_PALETTES.length];
  
  const getImage = (item: SliderItem, index: number) => item.image || FALLBACK_IMAGES[index % FALLBACK_IMAGES.length];

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.9],
  });

  const slideHeight = compact ? 195 : 195;

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (sliderItems.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Navigation Arrows */}
      {showArrows && sliderItems.length > 1 && (
        <TouchableOpacity 
          style={[styles.arrowButton, styles.arrowLeft, { backgroundColor: getColorPalette(currentIndex).accent }]}
          onPress={handlePrevious}
          activeOpacity={0.8}
        >
          <Animated.View style={{ transform: [{ translateX: arrowLeftAnim }] }}>
            <Ionicons name="chevron-back" size={22} color="#FFF" />
          </Animated.View>
        </TouchableOpacity>
      )}

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.scrollContent}
        decelerationRate="fast"
        snapToInterval={SLIDER_WIDTH + 12}
      >
        {sliderItems.map((item, index) => {
          const palette = getColorPalette(index);
          const discount = item.type === 'bundle_offer' ? item.discount_percentage : 
                          (item.original_total && item.discounted_total ? 
                            Math.round((1 - item.discounted_total / item.original_total) * 100) : 0);
          
          return (
            <TouchableOpacity 
              key={item.id} 
              style={[styles.slideWrapper, { width: SLIDER_WIDTH }]}
              activeOpacity={hideIcon ? 1 : 0.95}
              onPress={hideIcon ? undefined : () => handleItemPress(item)}
            >
              <ImageBackground
                source={{ uri: getImage(item, index) }}
                style={[styles.slide, { height: slideHeight }]}
                imageStyle={styles.slideImage}
                resizeMode="cover"
              >
                {/* Gradient Overlay */}
                <LinearGradient
                  colors={['rgba(0,0,0,0.25)', 'rgba(0,0,0,0.7)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0.2, y: 1 }}
                  style={styles.gradientOverlay}
                >
                  {/* Accent Strip */}
                  <View style={[styles.accentStrip, { backgroundColor: palette.accent }]} />
                  
                  {/* Type Badge */}
                  <View style={[styles.typeBadge, { backgroundColor: item.type === 'bundle_offer' ? '#F59E0B' : palette.accent }]}>
                    <Ionicons 
                      name={item.type === 'bundle_offer' ? 'gift' : 'megaphone'} 
                      size={12} 
                      color="#FFF" 
                    />
                    <Text style={styles.typeBadgeText}>
                      {item.type === 'bundle_offer' 
                        ? (language === 'ar' ? 'عرض مجمع' : 'Bundle')
                        : (language === 'ar' ? 'عرض' : 'Promo')}
                    </Text>
                  </View>
                  
                  {/* Content Container */}
                  <View style={styles.contentContainer}>
                    {/* Center Section - Title & Info */}
                    <View style={styles.centerSection}>
                      {/* Title */}
                      <Text style={styles.titleText} numberOfLines={2}>
                        {getTitle(item)}
                      </Text>
                      
                      {/* Target Badge */}
                      {(item.target_car_model || item.target_product) && (
                        <View style={[styles.carBadge, { backgroundColor: palette.accent }]}>
                          <MaterialCommunityIcons 
                            name={item.target_car_model ? 'car-sports' : 'cube'} 
                            size={14} 
                            color="#FFF" 
                          />
                          <Text style={styles.carText} numberOfLines={1}>
                            {item.target_car_model?.name || item.target_product?.name || ''}
                          </Text>
                        </View>
                      )}
                      
                      {/* Product Count for bundles */}
                      {item.type === 'bundle_offer' && item.product_count && (
                        <Text style={styles.subtitleText}>
                          {item.product_count} {language === 'ar' ? 'منتجات' : 'products'}
                        </Text>
                      )}
                    </View>

                    {/* Right Side - Discount & Action */}
                    <View style={styles.actionSection}>
                      {/* Discount Badge */}
                      {discount > 0 && (
                        <LinearGradient
                          colors={[palette.accent, palette.icon]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.discountBadge}
                        >
                          <Text style={styles.discountNum}>{discount}%</Text>
                          <Text style={styles.discountLabel}>{language === 'ar' ? 'خصم' : 'OFF'}</Text>
                        </LinearGradient>
                      )}

                      {/* Interactive Action Icon */}
                      {!hideIcon && (
                        <TouchableOpacity
                          onPress={() => handleItemPress(item)}
                          activeOpacity={0.7}
                          style={styles.iconWrapper}
                        >
                          <Animated.View 
                            style={[
                              styles.actionIcon,
                              { 
                                backgroundColor: palette.icon,
                                transform: [
                                  { scale: index === currentIndex ? pulseAnim : 1 },
                                ],
                              }
                            ]}
                          >
                            {/* Glow Effect */}
                            <Animated.View 
                              style={[
                                styles.iconGlow,
                                { 
                                  backgroundColor: palette.icon,
                                  opacity: glowOpacity,
                                }
                              ]} 
                            />
                            {/* Icon */}
                            <Animated.View style={{ transform: [{ rotate: spin }] }}>
                              <MaterialCommunityIcons 
                                name="lightning-bolt-circle" 
                                size={24} 
                                color="#1a1a2e" 
                              />
                            </Animated.View>
                          </Animated.View>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {/* Price Row - For bundle offers */}
                  {item.type === 'bundle_offer' && item.original_total && item.discounted_total && (
                    <View style={styles.priceRow}>
                      <Text style={styles.oldPrice}>{item.original_total.toFixed(2)} ج.م</Text>
                      <View style={styles.arrowIcon}>
                        <Ionicons name="arrow-forward" size={14} color="rgba(255,255,255,0.6)" />
                      </View>
                      <Text style={[styles.newPrice, { color: palette.icon }]}>
                        {item.discounted_total.toFixed(2)} <Text style={styles.currency}>ج.م</Text>
                      </Text>
                    </View>
                  )}
                </LinearGradient>
              </ImageBackground>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Navigation Arrows - Right */}
      {showArrows && sliderItems.length > 1 && (
        <TouchableOpacity 
          style={[styles.arrowButton, styles.arrowRight, { backgroundColor: getColorPalette(currentIndex).accent }]}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <Animated.View style={{ transform: [{ translateX: arrowRightAnim }] }}>
            <Ionicons name="chevron-forward" size={22} color="#FFF" />
          </Animated.View>
        </TouchableOpacity>
      )}

      {/* Pagination Dots */}
      {sliderItems.length > 1 && (
        <View style={styles.dotsRow}>
          {sliderItems.map((item, i) => (
            <TouchableOpacity key={i} onPress={() => goToSlide(i)}>
              <View 
                style={[
                  styles.singleDot, 
                  { backgroundColor: isDark ? '#555' : '#DDD' },
                  i === currentIndex && { 
                    width: 26, 
                    backgroundColor: getColorPalette(i).accent,
                  }
                ]} 
              />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

// Static fallback offers
function getStaticOffers(): SliderItem[] {
  return [
    {
      id: 'static-offer-1',
      type: 'bundle_offer',
      title: 'Brake System Bundle',
      title_ar: 'حزمة نظام الفرامل',
      image: FALLBACK_IMAGES[0],
      discount_percentage: 10,
      original_total: 171.48,
      discounted_total: 154.33,
      product_count: 3,
      is_active: true,
    },
    {
      id: 'static-offer-2',
      type: 'bundle_offer',
      title: 'Power Pack Bundle',
      title_ar: 'حزمة الطاقة المتكاملة',
      image: FALLBACK_IMAGES[1],
      discount_percentage: 10,
      original_total: 355.99,
      discounted_total: 320.39,
      product_count: 3,
      is_active: true,
    },
    {
      id: 'static-offer-3',
      type: 'bundle_offer',
      title: 'Premium Combo Deal',
      title_ar: 'صفقة الكومبو المميزة',
      image: FALLBACK_IMAGES[2],
      discount_percentage: 10,
      original_total: 310.49,
      discounted_total: 279.44,
      product_count: 3,
      is_active: true,
    },
  ];
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    position: 'relative',
  },
  loadingContainer: {
    height: 195,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  slideWrapper: {
    marginRight: 12,
  },
  slide: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
  },
  slideImage: {
    borderRadius: 18,
  },
  gradientOverlay: {
    flex: 1,
    borderRadius: 18,
    position: 'relative',
  },
  accentStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },
  typeBadge: {
    position: 'absolute',
    top: 12,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  typeBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  contentContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    paddingLeft: 18,
    paddingTop: 40,
  },
  centerSection: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    paddingRight: 12,
  },
  titleText: {
    color: '#FFD93D',
    fontSize: 18,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  subtitleText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  carBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    gap: 6,
  },
  carText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    bottom: 16,
    right: 18,
    gap: 8,
  },
  oldPrice: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    textDecorationLine: 'line-through',
  },
  arrowIcon: {
    opacity: 0.6,
  },
  newPrice: {
    fontSize: 20,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  currency: {
    fontSize: 12,
    fontWeight: '700',
  },
  actionSection: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    minWidth: 65,
    height: '100%',
    paddingTop: 0,
  },
  discountBadge: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 60,
    marginBottom: 12,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
      },
      default: {
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
    }),
  },
  discountNum: {
    color: '#1a1a2e',
    fontSize: 18,
    fontWeight: '900',
  },
  discountLabel: {
    color: '#1a1a2e',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  iconWrapper: {
    alignItems: 'center',
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...Platform.select({
      web: {
        boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
      },
      default: {
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
    }),
  },
  iconGlow: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
    gap: 10,
  },
  singleDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  arrowButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
      },
      default: {
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
    }),
  },
  arrowLeft: {
    left: 6,
  },
  arrowRight: {
    right: 6,
  },
});

export default DynamicOfferSlider;
