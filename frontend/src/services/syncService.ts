/**
 * Background Sync Service
 * Automatically syncs data from server to local Zustand store
 */
import { useAppStore } from '../store/appStore';
import { 
  carBrandApi, 
  carModelApi, 
  productBrandApi, 
  categoryApi, 
  productApi,
  supplierApi,
  distributorApi,
  orderApi,
  customerApi,
  syncApi 
} from './api';

class SyncService {
  private syncInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private syncIntervalMs = 60000; // 1 minute

  /**
   * Start the background sync service
   */
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('[SyncService] Starting background sync service');
    
    // Initial sync
    this.performSync();
    
    // Set up interval
    this.syncInterval = setInterval(() => {
      this.performSync();
    }, this.syncIntervalMs);
  }

  /**
   * Stop the background sync service
   */
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.isRunning = false;
    console.log('[SyncService] Stopped background sync service');
  }

  /**
   * Perform a full data sync
   */
  async performSync() {
    const store = useAppStore.getState();
    
    // Check if online
    if (!store.isOnline) {
      console.log('[SyncService] Offline, skipping sync');
      return;
    }

    // Check if already syncing
    if (store.syncStatus === 'syncing') {
      console.log('[SyncService] Already syncing, skipping');
      return;
    }

    store.setSyncStatus('syncing');
    store.setSyncError(null);

    try {
      console.log('[SyncService] Starting sync...');
      
      // Fetch all data in parallel
      const [
        carBrandsRes,
        carModelsRes,
        productBrandsRes,
        categoriesRes,
        productsRes,
      ] = await Promise.all([
        carBrandApi.getAll().catch(() => ({ data: [] })),
        carModelApi.getAll().catch(() => ({ data: [] })),
        productBrandApi.getAll().catch(() => ({ data: [] })),
        categoryApi.getAll().catch(() => ({ data: [] })),
        productApi.getAll({ limit: 1000 }).catch(() => ({ data: { products: [] } })),
      ]);

      // Update store with new data
      store.setCarBrands(carBrandsRes.data || []);
      store.setCarModels(carModelsRes.data || []);
      store.setProductBrands(productBrandsRes.data || []);
      store.setCategories(categoriesRes.data || []);
      store.setProducts(productsRes.data?.products || []);

      // Only fetch privileged data if user has access
      const userRole = store.userRole;
      if (['owner', 'partner'].includes(userRole)) {
        try {
          const [
            suppliersRes,
            distributorsRes,
            ordersRes,
            customersRes,
          ] = await Promise.all([
            supplierApi.getAll().catch(() => ({ data: [] })),
            distributorApi.getAll().catch(() => ({ data: [] })),
            orderApi.getAllAdmin().catch(() => ({ data: { orders: [] } })),
            customerApi.getAll().catch(() => ({ data: { customers: [] } })),
          ]);

          store.setSuppliers(suppliersRes.data || []);
          store.setDistributors(distributorsRes.data || []);
          store.setOrders(ordersRes.data?.orders || []);
          store.setCustomers(customersRes.data?.customers || []);
        } catch (e) {
          console.log('[SyncService] Could not fetch privileged data:', e);
        }
      } else if (['admin', 'subscriber'].includes(userRole)) {
        try {
          const [suppliersRes, distributorsRes] = await Promise.all([
            supplierApi.getAll().catch(() => ({ data: [] })),
            distributorApi.getAll().catch(() => ({ data: [] })),
          ]);
          store.setSuppliers(suppliersRes.data || []);
          store.setDistributors(distributorsRes.data || []);
        } catch (e) {
          console.log('[SyncService] Could not fetch supplier/distributor data:', e);
        }
      }

      store.setSyncStatus('success');
      store.setLastSyncTime(Date.now());
      console.log('[SyncService] Sync completed successfully');

      // Reset to idle after 3 seconds
      setTimeout(() => {
        if (useAppStore.getState().syncStatus === 'success') {
          useAppStore.getState().setSyncStatus('idle');
        }
      }, 3000);

    } catch (error: any) {
      console.error('[SyncService] Sync failed:', error);
      store.setSyncStatus('error');
      store.setSyncError(error.message || 'Sync failed');

      // Add error notification
      store.addNotification({
        id: `sync-error-${Date.now()}`,
        user_id: store.user?.id || 'system',
        title: 'Sync Failed',
        message: `Failed to sync data: ${error.message || 'Unknown error'}`,
        type: 'error',
        read: false,
        created_at: new Date().toISOString(),
      });

      // Reset to idle after 5 seconds
      setTimeout(() => {
        if (useAppStore.getState().syncStatus === 'error') {
          useAppStore.getState().setSyncStatus('idle');
        }
      }, 5000);
    }
  }

  /**
   * Force an immediate sync
   */
  forceSync() {
    return this.performSync();
  }

  /**
   * Set the sync interval in milliseconds
   */
  setSyncInterval(ms: number) {
    this.syncIntervalMs = ms;
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }
}

// Singleton instance
export const syncService = new SyncService();

// Hook to use sync service
export const useSyncService = () => {
  return {
    start: () => syncService.start(),
    stop: () => syncService.stop(),
    forceSync: () => syncService.forceSync(),
    setSyncInterval: (ms: number) => syncService.setSyncInterval(ms),
  };
};

export default syncService;
