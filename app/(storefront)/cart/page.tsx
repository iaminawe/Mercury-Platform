'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Trash2, Plus, Minus, ShoppingBag } from 'lucide-react';
import { useCart } from '@/contexts/cart-context';
import { formatPrice } from '@/lib/shopify';
import { Button } from '@/components/ui/button';

export default function CartPage() {
  const { cart, loading, updateQuantity, removeFromCart } = useCart();

  const handleQuantityChange = async (lineId: string, currentQuantity: number, change: number) => {
    const newQuantity = Math.max(0, currentQuantity + change);
    await updateQuantity(lineId, newQuantity);
  };

  if (!cart || cart.items.length === 0) {
    return (
      <div className="min-h-screen">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="max-w-2xl mx-auto text-center">
            <ShoppingBag className="h-16 w-16 text-muted-foreground mx-auto mb-6" />
            <h1 className="text-3xl font-bold mb-4">Your cart is empty</h1>
            <p className="text-lg text-muted-foreground mb-8">
              Looks like you haven't added anything to your cart yet.
            </p>
            <Button asChild size="lg">
              <Link href="/products">Continue Shopping</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold mb-8">Shopping Cart</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2">
            <div className="space-y-4">
              {cart.items.map((item) => (
                <div key={item.id} className="bg-card rounded-lg border p-4 md:p-6">
                  <div className="flex gap-4">
                    {/* Product Image */}
                    {item.image && (
                      <Link 
                        href={`/products/${item.productHandle}`}
                        className="relative w-24 h-24 md:w-32 md:h-32 rounded-md overflow-hidden bg-muted flex-shrink-0"
                      >
                        <Image
                          src={item.image.src}
                          alt={item.image.altText}
                          fill
                          sizes="(max-width: 768px) 96px, 128px"
                          className="object-cover"
                        />
                      </Link>
                    )}

                    {/* Product Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between gap-4">
                        <div className="flex-1">
                          <Link 
                            href={`/products/${item.productHandle}`}
                            className="font-medium hover:text-primary transition-colors"
                          >
                            {item.productTitle}
                          </Link>
                          {item.title !== 'Default Title' && (
                            <p className="text-sm text-muted-foreground mt-1">{item.title}</p>
                          )}
                          <p className="text-sm font-medium mt-2 md:hidden">
                            {formatPrice(item.price.amount, item.price.currencyCode)}
                          </p>
                        </div>
                        <p className="text-sm font-medium hidden md:block">
                          {formatPrice(item.price.amount, item.price.currencyCode)}
                        </p>
                      </div>

                      {/* Quantity and Actions */}
                      <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleQuantityChange(item.id, item.quantity, -1)}
                            disabled={loading}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="text-sm w-8 text-center">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleQuantityChange(item.id, item.quantity, 1)}
                            disabled={loading}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>

                        <div className="flex items-center gap-4">
                          <p className="text-sm font-medium">
                            {formatPrice(
                              (parseFloat(item.price.amount) * item.quantity).toString(),
                              item.price.currencyCode
                            )}
                          </p>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFromCart(item.id)}
                            disabled={loading}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-card rounded-lg border p-6 sticky top-24">
              <h2 className="text-lg font-semibold mb-4">Order Summary</h2>
              
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span>Subtotal ({cart.totalQuantity} items)</span>
                  <span>{formatPrice(cart.totalAmount.amount, cart.totalAmount.currencyCode)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Shipping</span>
                  <span className="text-muted-foreground">Calculated at checkout</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Taxes</span>
                  <span className="text-muted-foreground">Calculated at checkout</span>
                </div>
              </div>

              <div className="border-t pt-4 mb-6">
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span>{formatPrice(cart.totalAmount.amount, cart.totalAmount.currencyCode)}</span>
                </div>
              </div>

              <Button 
                className="w-full" 
                size="lg"
                asChild
              >
                <a href={cart.checkoutUrl} target="_blank" rel="noopener noreferrer">
                  Proceed to Checkout
                </a>
              </Button>

              <Button 
                variant="outline" 
                className="w-full mt-2"
                asChild
              >
                <Link href="/products">Continue Shopping</Link>
              </Button>

              <p className="text-xs text-center text-muted-foreground mt-4">
                Secure checkout powered by Shopify
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}