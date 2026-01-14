import React, { useState } from 'react';
import { X, Trash2, Plus, Minus, User, CreditCard, Save } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { formatCurrency } from '../utils/format';

const CartPanel = ({ onPayment, onCustomerSelect, onHold }) => {
  const { items, updateQuantity, removeItem, customer, setCustomer, clearCart } = useCart();
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');

  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const tax = items.reduce((sum, item) => {
    return item.hasVat ? sum + (item.price * item.quantity * 0.15) : sum;
  }, 0);
  const total = subtotal + tax - discount;

  const handleQuantityChange = (itemId, change) => {
    const item = items.find(i => i.id === itemId);
    if (item) {
      const newQuantity = item.quantity + change;
      if (newQuantity > 0) {
        updateQuantity(itemId, newQuantity);
      }
    }
  };

  const handlePriceChange = (itemId, newPrice) => {
    // Check permission before allowing price change
    const canEditPrice = true; // Replace with actual permission check
    if (canEditPrice) {
      updateQuantity(itemId, item.quantity, newPrice);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Invoice</h2>
          <button
            onClick={clearCart}
            className="text-red-600 hover:text-red-700"
            title="Clear Cart"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
        
        {/* Customer Info */}
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <button
              onClick={onCustomerSelect}
              className="flex items-center space-x-2 text-blue-600 hover:text-blue-700"
            >
              <User className="w-4 h-4" />
              <span>{customer ? customer.name : 'Walk-in Customer'}</span>
            </button>
            
            {customer && (
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Balance: {formatCurrency(customer.balance || 0)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto p-4">
        {items.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            No items in cart
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(item => (
              <div
                key={item.id}
                className="flex items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                {/* Product Image */}
                <div className="w-12 h-12 bg-gray-300 dark:bg-gray-600 rounded flex items-center justify-center mr-3">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover rounded" />
                  ) : (
                    <span className="text-gray-500 dark:text-gray-400 text-xs">No Image</span>
                  )}
                </div>
                
                {/* Product Info */}
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {item.name}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    SKU: {item.sku || 'N/A'}
                  </div>
                </div>
                
                {/* Quantity Controls */}
                <div className="flex items-center space-x-2 mr-4">
                  <button
                    onClick={() => handleQuantityChange(item.id, -1)}
                    className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  
                  <span className="w-8 text-center font-medium">
                    {item.quantity}
                  </span>
                  
                  <button
                    onClick={() => handleQuantityChange(item.id, 1)}
                    className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                
                {/* Price */}
                <div className="text-right">
                  <div className="font-bold">
                    {formatCurrency(item.price * item.quantity)}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {formatCurrency(item.price)} each
                  </div>
                </div>
                
                {/* Remove */}
                <button
                  onClick={() => removeItem(item.id)}
                  className="ml-3 text-red-600 hover:text-red-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="p-4 border-t dark:border-gray-700 space-y-3">
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
          <span className="font-medium">{formatCurrency(subtotal)}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Tax (15%)</span>
          <span className="font-medium">{formatCurrency(tax)}</span>
        </div>
        
        <div className="flex justify-between border-t dark:border-gray-700 pt-3">
          <span className="text-lg font-bold text-gray-900 dark:text-white">Total</span>
          <span className="text-2xl font-bold text-green-600 dark:text-green-500">
            {formatCurrency(total)}
          </span>
        </div>

        {/* Notes */}
        <div className="mt-4">
          <textarea
            placeholder="Add notes to invoice..."
            className="w-full p-2 border dark:border-gray-700 rounded text-sm 
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            rows="2"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 mt-6">
          <button
            onClick={onHold}
            className="flex items-center justify-center space-x-2 p-3 
                     border border-blue-600 text-blue-600 rounded-lg
                     hover:bg-blue-50 dark:hover:bg-blue-900"
          >
            <Save className="w-4 h-4" />
            <span>Hold (F2)</span>
          </button>
          
          <button
            onClick={onPayment}
            disabled={items.length === 0}
            className={`flex items-center justify-center space-x-2 p-3 rounded-lg
                     ${items.length === 0
                       ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
                       : 'bg-green-600 hover:bg-green-700 text-white'}`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Payment (F9)</span>
            <span className="ml-auto">{formatCurrency(total)}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CartPanel;
