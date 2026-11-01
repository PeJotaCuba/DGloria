/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { ConvexDish } from '../lib/convexClient';

export interface OrderItem extends ConvexDish {
  quantity: number;
}

export interface PresentedOrder {
  items: OrderItem[];
  totalUnits: number;
  totalPrice: number;
  timestamp: number;
  expiryTime: number;
}

const STORAGE_KEY = 'dona_gloria_personal_order';
const PRESENTED_STORAGE_KEY = 'dona_gloria_presented_order';
const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;

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

  const [presentedOrder, setPresentedOrder] = useState<PresentedOrder | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem(PRESENTED_STORAGE_KEY);
      if (!stored) return null;
      const parsed: PresentedOrder = JSON.parse(stored);
      if (Date.now() > parsed.expiryTime) {
        localStorage.removeItem(PRESENTED_STORAGE_KEY);
        return null;
      }
      return parsed;
    } catch {
      return null;
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

  const presentOrder = useCallback(() => {
    const totalUnits = orderItems.reduce((acc, item) => acc + item.quantity, 0);
    const totalPrice = orderItems.reduce((acc, item) => {
        const price = typeof item.priceCup === 'number' ? item.priceCup : 0;
        return acc + (price * item.quantity);
    }, 0);
    
    const now = Date.now();
    const newPresentedOrder: PresentedOrder = {
        items: [...orderItems],
        totalUnits,
        totalPrice,
        timestamp: now,
        expiryTime: now + FIVE_HOURS_MS
    };
    setPresentedOrder(newPresentedOrder);
    localStorage.setItem(PRESENTED_STORAGE_KEY, JSON.stringify(newPresentedOrder));
    clearOrder(); // Clear the draft order after presenting
  }, [orderItems, clearOrder]);

  const closePresentedOrder = useCallback(() => {
    setPresentedOrder(null);
    localStorage.removeItem(PRESENTED_STORAGE_KEY);
  }, []);

  const totalUnits = orderItems.reduce((acc, item) => acc + item.quantity, 0);
  
  const totalPrice = orderItems.reduce((acc, item) => {
    const price = typeof item.priceCup === 'number' ? item.priceCup : 0;
    return acc + (price * item.quantity);
  }, 0);

  return {
    orderItems,
    presentedOrder,
    updateQuantity,
    clearOrder,
    presentOrder,
    closePresentedOrder,
    totalUnits,
    totalPrice,
  };
}
