'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { client, CREATE_CART_MUTATION, UPDATE_CART_MUTATION, GET_CART_QUERY } from '@/lib/shopify';

interface CartItem {
  id: string;
  variantId: string;
  quantity: number;
  title: string;
  productTitle: string;
  productHandle: string;
  price: {
    amount: string;
    currencyCode: string;
  };
  image?: {
    src: string;
    altText: string;
  };
}

interface Cart {
  id: string;
  checkoutUrl: string;
  items: CartItem[];
  totalQuantity: number;
  totalAmount: {
    amount: string;
    currencyCode: string;
  };
}

interface CartContextType {
  cart: Cart | null;
  loading: boolean;
  addToCart: (variantId: string, quantity?: number) => Promise<void>;
  updateQuantity: (lineId: string, quantity: number) => Promise<void>;
  removeFromCart: (lineId: string) => Promise<void>;
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'mercury-cart-id';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    const loadCart = async () => {
      const cartId = localStorage.getItem(CART_STORAGE_KEY);
      if (cartId) {
        setLoading(true);
        try {
          const response = await client.request(GET_CART_QUERY, { variables: { cartId } });
          if (response.data?.cart) {
            setCart(formatCart(response.data.cart));
          }
        } catch (error) {
          console.error('Error loading cart:', error);
          localStorage.removeItem(CART_STORAGE_KEY);
        } finally {
          setLoading(false);
        }
      }
    };
    loadCart();
  }, []);

  const formatCart = (cartData: any): Cart => {
    return {
      id: cartData.id,
      checkoutUrl: cartData.checkoutUrl,
      totalQuantity: cartData.totalQuantity,
      totalAmount: cartData.cost.totalAmount,
      items: cartData.lines.edges.map((edge: any) => ({
        id: edge.node.id,
        variantId: edge.node.merchandise.id,
        quantity: edge.node.quantity,
        title: edge.node.merchandise.title,
        productTitle: edge.node.merchandise.product.title,
        productHandle: edge.node.merchandise.product.handle,
        price: edge.node.merchandise.price,
        image: edge.node.merchandise.image
          ? {
              src: edge.node.merchandise.image.transformedSrc,
              altText: edge.node.merchandise.image.altText || '',
            }
          : undefined,
      })),
    };
  };

  const addToCart = useCallback(async (variantId: string, quantity = 1) => {
    setLoading(true);
    try {
      if (!cart) {
        // Create new cart
        const response = await client.request(CREATE_CART_MUTATION, {
          variables: {
            lines: [{ merchandiseId: variantId, quantity }],
          },
        });
        const newCart = formatCart(response.data.cartCreate.cart);
        setCart(newCart);
        localStorage.setItem(CART_STORAGE_KEY, newCart.id);
        setIsCartOpen(true);
      } else {
        // Update existing cart
        const existingItem = cart.items.find((item) => item.variantId === variantId);
        if (existingItem) {
          // Update quantity
          await updateQuantity(existingItem.id, existingItem.quantity + quantity);
        } else {
          // Add new item
          const response = await client.request(UPDATE_CART_MUTATION, {
            variables: {
              cartId: cart.id,
              lines: [{ id: variantId, quantity }],
            },
          });
          setCart(formatCart(response.data.cartLinesUpdate.cart));
        }
        setIsCartOpen(true);
      }
    } catch (error) {
      console.error('Error adding to cart:', error);
    } finally {
      setLoading(false);
    }
  }, [cart]);

  const updateQuantity = useCallback(async (lineId: string, quantity: number) => {
    if (!cart) return;
    
    setLoading(true);
    try {
      if (quantity === 0) {
        await removeFromCart(lineId);
        return;
      }

      const response = await client.request(UPDATE_CART_MUTATION, {
        variables: {
          cartId: cart.id,
          lines: [{ id: lineId, quantity }],
        },
      });
      setCart(formatCart(response.data.cartLinesUpdate.cart));
    } catch (error) {
      console.error('Error updating quantity:', error);
    } finally {
      setLoading(false);
    }
  }, [cart]);

  const removeFromCart = useCallback(async (lineId: string) => {
    if (!cart) return;
    
    setLoading(true);
    try {
      const response = await client.request(UPDATE_CART_MUTATION, {
        variables: {
          cartId: cart.id,
          lines: [{ id: lineId, quantity: 0 }],
        },
      });
      setCart(formatCart(response.data.cartLinesUpdate.cart));
    } catch (error) {
      console.error('Error removing from cart:', error);
    } finally {
      setLoading(false);
    }
  }, [cart]);

  const openCart = useCallback(() => setIsCartOpen(true), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);

  return (
    <CartContext.Provider
      value={{
        cart,
        loading,
        addToCart,
        updateQuantity,
        removeFromCart,
        isCartOpen,
        openCart,
        closeCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};