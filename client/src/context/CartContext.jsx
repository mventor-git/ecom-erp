import { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

const CART_STORAGE_KEY = 'store-cart-v2'; // v2: prices stored in cents (consistent with the currency system)

function loadCart() {
  try {
    const saved = localStorage.getItem(CART_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const [cart, setCart] = useState(loadCart);
  const [isOpen, setIsOpen] = useState(false);
  const [toast, setToast] = useState(null); // { id, count, total } — drives the "added" toast

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }, [cart]);

  const addToCart = (product, quantity = 1, selectedColor = null, selectedSize = null) => {
    const unitPrice = typeof product.price === 'number' ? product.price : 0; // cents
    setCart(prev => {
      // Find existing item with same id AND same color AND same size
      const existing = prev.find(item =>
        item.id === product.id &&
        (item.color?.name === selectedColor?.name || (!item.color && !selectedColor)) &&
        (item.size?.name === selectedSize?.name || (!item.size && !selectedSize))
      );
      let updated;
      if (existing) {
        updated = prev.map(item =>
          item.id === product.id &&
          (item.color?.name === selectedColor?.name || (!item.color && !selectedColor)) &&
          (item.size?.name === selectedSize?.name || (!item.size && !selectedSize))
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      } else {
        const newItem = {
          id: product.id,
          name: product.name,
          price: unitPrice, // cents — formatted via the active currency
          description: product.description,
          image_url: selectedColor?.image_url || selectedSize?.image_url || product.image_url,
          category_name: product.category_name,
          quantity,
        };
        if (selectedColor) {
          newItem.color = { name: selectedColor.name, hex: selectedColor.hex };
        }
        if (selectedSize) {
          newItem.size = { name: selectedSize.name };
        }
        updated = [...prev, newItem];
      }
      // Derive the UPDATED count/total from the new state so the toast reflects
      // the cart after this item was added (not the stale outer-scope values).
      const count = updated.reduce((sum, item) => sum + item.quantity, 0);
      const total = updated.reduce((sum, item) => sum + item.price * item.quantity, 0);
      setToast({ id: Date.now(), count, total });
      return updated;
    });
  };

  /** Generate a unique key for cart items (same product + same color + same size = same key) */
  const itemKey = (item) => `${item.id}-${item.color?.name || '__default__'}-${item.size?.name || '__default__'}`;

  const removeFromCart = (productId, colorName, sizeName) => {
    setCart(prev => prev.filter(item =>
      !(item.id === productId &&
        (item.color?.name || '__default__') === (colorName || '__default__') &&
        (item.size?.name || '__default__') === (sizeName || '__default__'))
    ));
  };

  const updateQuantity = (productId, quantity, colorName, sizeName) => {
    if (quantity <= 0) {
      removeFromCart(productId, colorName, sizeName);
      return;
    }
    setCart(prev =>
      prev.map(item =>
        item.id === productId &&
        (item.color?.name || '__default__') === (colorName || '__default__') &&
        (item.size?.name || '__default__') === (sizeName || '__default__')
          ? { ...item, quantity }
          : item
      )
    );
  };

  const clearCart = () => {
    setCart([]);
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  /** Total quantity of a product already in the cart (across all variants) */
  const cartCountFor = (productId) =>
    cart.reduce((sum, item) => (item.id === productId ? sum + item.quantity : sum), 0);

  return (
    <CartContext.Provider value={{
      cart,
      cartTotal,
      cartCount,
      cartCountFor,
      toast,
      isOpen,
      setIsOpen,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
