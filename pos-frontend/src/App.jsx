import React, { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import PosLayout from './layouts/PosLayout';
import ProductGrid from './components/ProductGrid';
import CartPanel from './components/CartPanel';
import PaymentModal from './components/PaymentModal';
import CustomerModal from './components/CustomerModal';
import HoldInvoicesModal from './components/HoldInvoicesModal';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { CartProvider } from './contexts/CartContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { SyncProvider } from './contexts/SyncContext';
import './styles/pos.css';

function App() {
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isHoldModalOpen, setIsHoldModalOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('online');

  // Keyboard shortcuts
  useKeyboardShortcuts({
    'F1': () => setIsCustomerModalOpen(true),
    'F2': () => setIsHoldModalOpen(true),
    'F3': () => window.print(),
    'F9': () => setIsPaymentModalOpen(true),
    'F12': () => window.open('/admin', '_blank'),
    'Escape': () => {
      setIsPaymentModalOpen(false);
      setIsCustomerModalOpen(false);
      setIsHoldModalOpen(false);
    },
  });

  // Check connection
  useEffect(() => {
    const handleOnline = () => setConnectionStatus('online');
    const handleOffline = () => setConnectionStatus('offline');
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <ThemeProvider>
      <SyncProvider>
        <CartProvider>
          <PosLayout>
            <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
              {/* Connection Status */}
              <div className={`fixed top-2 right-2 px-3 py-1 rounded-full text-xs font-semibold z-50
                ${connectionStatus === 'online' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                {connectionStatus === 'online' ? '🟢 Online' : '🔴 Offline'}
              </div>

              {/* Main Content */}
              <div className="flex-1 p-4 overflow-hidden">
                <ProductGrid />
              </div>
              
              {/* Cart Panel */}
              <div className="w-96 border-l dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
                <CartPanel 
                  onPayment={() => setIsPaymentModalOpen(true)}
                  onCustomerSelect={() => setIsCustomerModalOpen(true)}
                  onHold={() => setIsHoldModalOpen(true)}
                />
              </div>
            </div>

            {/* Modals */}
            <PaymentModal 
              isOpen={isPaymentModalOpen}
              onClose={() => setIsPaymentModalOpen(false)}
            />
            
            <CustomerModal 
              isOpen={isCustomerModalOpen}
              onClose={() => setIsCustomerModalOpen(false)}
            />
            
            <HoldInvoicesModal 
              isOpen={isHoldModalOpen}
              onClose={() => setIsHoldModalOpen(false)}
            />

            <Toaster position="top-right" />
          </PosLayout>
        </CartProvider>
      </SyncProvider>
    </ThemeProvider>
  );
}

export default App;
