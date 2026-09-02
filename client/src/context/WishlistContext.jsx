import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getWishlist, addToWishlist, removeFromWishlist } from '../api/products';
import { useAuth } from './AuthContext';

const WishlistContext = createContext();

export function WishlistProvider({ children }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load the account's wishlist whenever the signed-in user changes
  useEffect(() => {
    if (user?.id) {
      setLoading(true);
      getWishlist()
        .then(res => setItems(res.data || []))
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    } else {
      setItems([]);
    }
  }, [user?.id]);

  const addItem = useCallback(async (product) => {
    try {
      await addToWishlist(product.id);
      const { data } = await getWishlist();
      setItems(data || []);
      setIsOpen(true); // show itself like the cart drawer
      return true;
    } catch (err) {
      console.error('Error adding to wishlist:', err);
      return false;
    }
  }, []);

  const removeItem = useCallback(async (productId) => {
    try {
      await removeFromWishlist(productId);
      setItems(prev => prev.filter(p => p.id !== productId));
      return true;
    } catch (err) {
      console.error('Error removing from wishlist:', err);
      return false;
    }
  }, []);

  const isWishlisted = useCallback((productId) => items.some(p => p.id === productId), [items]);

  return (
    <WishlistContext.Provider value={{
      items,
      count: items.length,
      loading,
      isOpen,
      setIsOpen,
      addItem,
      removeItem,
      isWishlisted,
    }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
}
