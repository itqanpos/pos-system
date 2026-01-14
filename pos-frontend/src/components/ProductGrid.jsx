import React, { useState, useMemo } from 'react';
import { Search, Filter, Barcode, Grid3x3 } from 'lucide-react';
import ProductCard from './ProductCard';
import { useCart } from '../contexts/CartContext';
import { useProducts } from '../hooks/useProducts';
import CategoryFilter from './CategoryFilter';

const ProductGrid = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // grid or list
  const { addToCart } = useCart();
  const { products, loading, categories } = useProducts();

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           product.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           product.barcode?.includes(searchQuery);
      const matchesCategory = !selectedCategory || product.categoryId === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  const handleBarcodeScan = () => {
    // Simulate barcode scan
    const barcode = prompt('Enter barcode or scan:');
    if (barcode) {
      const product = products.find(p => p.barcode === barcode);
      if (product) {
        addToCart(product);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500 dark:text-gray-400">Loading products...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search products by name, SKU, or barcode..."
              className="w-full pl-10 pr-4 py-2 border dark:border-gray-700 rounded-lg 
                       bg-white dark:bg-gray-800 text-gray-900 dark:text-white 
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={handleBarcodeScan}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                       flex items-center space-x-2"
            >
              <Barcode className="w-5 h-5" />
              <span>Scan</span>
            </button>
            
            <button
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              className="p-2 border dark:border-gray-700 rounded-lg hover:bg-gray-100 
                       dark:hover:bg-gray-700"
            >
              <Grid3x3 className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <CategoryFilter
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />
      </div>

      {/* Products Grid */}
      <div className="flex-1 overflow-y-auto">
        <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-4' : 'grid-cols-1'}`}>
          {filteredProducts.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              onAddToCart={() => addToCart(product)}
              viewMode={viewMode}
            />
          ))}
        </div>
        
        {filteredProducts.length === 0 && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            No products found. Try a different search.
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="mt-4 pt-4 border-t dark:border-gray-700">
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>Total Products: {products.length}</span>
          <span>Showing: {filteredProducts.length}</span>
        </div>
      </div>
    </div>
  );
};

export default ProductGrid;
