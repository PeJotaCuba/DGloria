/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { ConvexDish } from '../lib/convexClient';

export interface OrderItem extends ConvexDish {
  quantity: number;
}

const STORAGE_KEY = 'dona_gloria_personal_order';

export function usePersonalOrder() {
  const [orderItems, setOrderItems] = useState<OrderItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orderItems));
  }, [orderItems]);

  const updateQuantity = useCallback((dish: ConvexDish, delta: number) => {
    setOrderItems((prev) => {
      const existing = prev.find((item) => item._id === dish._id);
      if (existing) {
        const newQuantity = existing.quantity + delta;
        if (newQuantity <= 0) {
          return prev.filter((item) => item._id !== dish._id);
        }
        return prev.map((item) =>
          item._id === dish._id ? { ...item, quantity: newQuantity } : item
        );
      }
      if (delta > 0) {
        return [...prev, { ...dish, quantity: delta }];
      }
      return prev;
    });
  }, []);

  const clearOrder = useCallback(() => {
    setOrderItems([]);
  }, []);

  const totalUnits = orderItems.reduce((acc, item) => acc + item.quantity, 0);
  
  const totalPrice = orderItems.reduce((acc, item) => {
    const price = typeof item.priceCup === 'number' ? item.priceCup : 0;
    return acc + (price * item.quantity);
  }, 0);

  return {
    orderItems,
    updateQuantity,
    clearOrder,
    totalUnits,
    totalPrice,
  };
}
