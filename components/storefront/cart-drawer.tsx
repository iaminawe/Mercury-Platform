'use client';

import { Fragment, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ShoppingCart, X, Plus, Minus, Trash2 } from 'lucide-react';
import { useCart } from '@/contexts/cart-context';
import { formatPrice } from '@/lib/shopify';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

export default function CartDrawer() {
  const { cart, loading, updateQuantity, removeFromCart, isCartOpen, openCart, closeCart } = useCart();

  const handleQuantityChange = async (lineId: string, currentQuantity: number, change: number) => {
    const newQuantity = Math.max(0, currentQuantity + change);
    await updateQuantity(lineId, newQuantity);
  };

  const totalItems = cart?.totalQuantity || 0;

  return (
    <Sheet open={isCartOpen} onOpenChange={(open) => open ? openCart() : closeCart()}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <ShoppingCart className="h-5 w-5" />
          {totalItems > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
              {totalItems}
            </span>
          )}
          <span className="sr-only">Cart</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Shopping Cart</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col h-full">
          {!cart || cart.items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
              <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">Your cart is empty</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add items to your cart to see them here
              </p>
              <Button asChild onClick={closeCart}>
                <Link href="/products">Continue Shopping</Link>
              </Button>
            </div>
          ) : (
            <>
              {/* Cart Items */}
              <div className="flex-1 overflow-y-auto py-6">
                <div className="space-y-4">
                  {cart.items.map((item) => (
                    <div key={item.id} className="flex gap-4 p-4 rounded-lg border">
                      {/* Product Image */}
                      {item.image && (
                        <Link 
                          href={`/products/${item.productHandle}`}
                          onClick={closeCart}
                          className="relative w-20 h-20 rounded-md overflow-hidden bg-muted flex-shrink-0"
                        >
                          <Image
                            src={item.image.src}
                            alt={item.image.altText}
                            fill
                            sizes="80px"
                            className="object-cover"
                          />
                        </Link>
                      )}

                      {/* Product Details */}
                      <div className="flex-1 min-w-0">
                        <Link 
                          href={`/products/${item.productHandle}`}
                          onClick={closeCart}
                          className="font-medium text-sm hover:text-primary transition-colors block truncate"
                        >
                          {item.productTitle}
                        </Link>
                        {item.title !== 'Default Title' && (
                          <p className="text-xs text-muted-foreground mt-1">{item.title}</p>
                        )}
                        <p className="text-sm font-medium mt-1">
                          {formatPrice(item.price.amount, item.price.currencyCode)}
                        </p>

                        {/* Quantity Controls */}
                        <div className="flex items-center gap-2 mt-2">
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
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 ml-auto"
                            onClick={() => removeFromCart(item.id)}
                            disabled={loading}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cart Footer */}
              <div className="border-t pt-6 pb-6 space-y-4">
                <div className="flex justify-between text-lg font-medium">
                  <span>Total</span>
                  <span>
                    {formatPrice(cart.totalAmount.amount, cart.totalAmount.currencyCode)}
                  </span>
                </div>
                <div className="space-y-2">
                  <Button 
                    className="w-full" 
                    size="lg"
                    asChild
                  >
                    <a href={cart.checkoutUrl} target="_blank" rel="noopener noreferrer">
                      Checkout
                    </a>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={closeCart}
                    asChild
                  >
                    <Link href="/products">Continue Shopping</Link>
                  </Button>
                </div>
                <p className="text-xs text-center text-muted-foreground">
                  Shipping and taxes calculated at checkout
                </p>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}