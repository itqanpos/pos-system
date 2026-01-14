class SyncManager {
  constructor() {
    this.queue = [];
    this.isSyncing = false;
    this.isOnline = navigator.onLine;
    this.syncInterval = null;
    this.maxRetries = 3;
    this.retryDelay = 5000; // 5 seconds
    
    this.init();
  }

  init() {
    // Listen to online/offline events
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
    
    // Start periodic sync
    this.startPeriodicSync();
    
    // Listen to custom sync events
    document.addEventListener('sync-required', (e) => {
      this.addToQueue(e.detail);
    });
  }

  addToQueue(operation) {
    const operationWithMetadata = {
      ...operation,
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      retryCount: 0,
      status: 'pending',
    };
    
    this.queue.push(operationWithMetadata);
    this.saveQueueToStorage();
    
    // Trigger sync if online
    if (this.isOnline) {
      this.processQueue();
    }
    
    // Emit event for UI
    this.emitQueueUpdate();
  }

  async processQueue() {
    if (this.isSyncing || this.queue.length === 0) return;
    
    this.isSyncing = true;
    
    try {
      while (this.queue.length > 0) {
        const operation = this.queue[0];
        
        try {
          await this.syncOperation(operation);
          
          // Remove from queue on success
          this.queue.shift();
          this.saveQueueToStorage();
          
          // Emit success event
          this.emitSyncSuccess(operation);
        } catch (error) {
          operation.retryCount++;
          
          if (operation.retryCount >= this.maxRetries) {
            // Move to failed operations
            operation.status = 'failed';
            operation.error = error.message;
            this.moveToFailed(operation);
            this.queue.shift();
          } else {
            // Wait before retry
            await this.delay(this.retryDelay * operation.retryCount);
          }
        }
      }
    } finally {
      this.isSyncing = false;
      this.emitQueueUpdate();
    }
  }

  async syncOperation(operation) {
    switch (operation.type) {
      case 'invoice':
        return this.syncInvoice(operation.data);
      case 'customer':
        return this.syncCustomer(operation.data);
      case 'product':
        return this.syncProduct(operation.data);
      case 'stock':
        return this.syncStockMovement(operation.data);
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  async syncInvoice(invoiceData) {
    // Check for conflicts
    const localVersion = await this.getLocalVersion('invoices', invoiceData.id);
    const serverVersion = await this.fetchServerVersion('invoices', invoiceData.id);
    
    if (serverVersion && serverVersion.updatedAt > localVersion.updatedAt) {
      // Conflict detected - use server wins strategy
      await this.resolveConflict('invoices', invoiceData.id, serverVersion);
      throw new Error('Conflict resolved - server version used');
    }
    
    // Upload to server
    const response = await fetch('/api/sync/invoices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': this.getTenantId(),
      },
      body: JSON.stringify(invoiceData),
    });
    
    if (!response.ok) {
      throw new Error(`Sync failed: ${response.statusText}`);
    }
    
    // Mark as synced in local DB
    await this.markAsSynced('invoices', invoiceData.id);
    
    return response.json();
  }

  async handleOnline() {
    this.isOnline = true;
    this.emitConnectionChange(true);
    
    // Process any pending operations
    await this.processQueue();
    
    // Fetch updates from server
    await this.pullUpdates();
  }

  async handleOffline() {
    this.isOnline = false;
    this.emitConnectionChange(false);
  }

  async pullUpdates() {
    try {
      const lastSync = await this.getLastSyncTime();
      
      const response = await fetch(`/api/sync/pull?since=${lastSync}`, {
        headers: {
          'x-tenant-id': this.getTenantId(),
        },
      });
      
      if (response.ok) {
        const updates = await response.json();
        await this.applyUpdates(updates);
        await this.setLastSyncTime(new Date().toISOString());
      }
    } catch (error) {
      console.error('Failed to pull updates:', error);
    }
  }

  async applyUpdates(updates) {
    const db = await this.getDatabase();
    
    for (const table in updates) {
      for (const record of updates[table]) {
        await db.table(table).put(record);
      }
    }
  }

  startPeriodicSync() {
    // Sync every 30 seconds when online
    this.syncInterval = setInterval(() => {
      if (this.isOnline && !this.isSyncing) {
        this.pullUpdates();
      }
    }, 30000);
  }

  stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
  }

  // Utility methods
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  emitConnectionChange(isOnline) {
    const event = new CustomEvent('connection-change', {
      detail: { isOnline }
    });
    document.dispatchEvent(event);
  }

  emitQueueUpdate() {
    const event = new CustomEvent('sync-queue-update', {
      detail: {
        queue: this.queue,
        isSyncing: this.isSyncing,
      }
    });
    document.dispatchEvent(event);
  }

  emitSyncSuccess(operation) {
    const event = new CustomEvent('sync-success', {
      detail: { operation }
    });
    document.dispatchEvent(event);
  }

  // IndexedDB methods
  async getDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('pos-db', 1);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create object stores
        if (!db.objectStoreNames.contains('invoices')) {
          const store = db.createObjectStore('invoices', { keyPath: 'id' });
          store.createIndex('by_synced', 'isSynced');
          store.createIndex('by_updated', 'updatedAt');
        }
        
        if (!db.objectStoreNames.contains('products')) {
          const store = db.createObjectStore('products', { keyPath: 'id' });
          store.createIndex('by_barcode', 'barcode');
        }
        
        if (!db.objectStoreNames.contains('customers')) {
          db.createObjectStore('customers', { keyPath: 'id' });
        }
        
        if (!db.objectStoreNames.contains('sync_queue')) {
          db.createObjectStore('sync_queue', { keyPath: 'id' });
        }
      };
      
      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (event) => reject(event.target.error);
    });
  }

  async saveQueueToStorage() {
    try {
      const db = await this.getDatabase();
      const tx = db.transaction('sync_queue', 'readwrite');
      const store = tx.objectStore('sync_queue');
      
      // Clear existing
      await store.clear();
      
      // Save all
      for (const operation of this.queue) {
        await store.put(operation);
      }
    } catch (error) {
      console.error('Failed to save sync queue:', error);
    }
  }
}

// Export singleton instance
export const syncManager = new SyncManager();
