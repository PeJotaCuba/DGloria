/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from 'jspdf';
import { PresentedOrder } from '../hooks/usePersonalOrder';
import { OFFICIAL_CATEGORIES } from '../lib/convexClient';

/**
 * Loads an image URL into a base64 Data URL with timeout fallback.
 */
async function loadImageAsBase64(url: string, timeoutMs = 2000): Promise<string | null> {
  return new Promise((resolve) => {
    if (!url) {
      resolve(null);
      return;
    }

    let isSettled = false;
    const timer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        resolve(null);
      }
    }, timeoutMs);

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width || 100;
        canvas.height = img.naturalHeight || img.height || 100;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          resolve(dataUrl);
        } else {
          resolve(null);
        }
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);
        resolve(null);
      }
    };
    img.src = url;
  });
}

/**
 * Builds a jsPDF document instance and computes the standard file name for an order.
 */
export async function buildOrderPdfDocument(order: PresentedOrder): Promise<{ doc: jsPDF; fileName: string }> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  let y = margin;

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - margin - 15) {
      doc.addPage();
      y = margin;
      drawHeaderBanner(true);
    }
  };

  const drawHeaderBanner = (isSubsequentPage = false) => {
    // Header Bar
    doc.setFillColor(30, 30, 30); // Dark #1E1E1E
    doc.rect(margin, y, contentWidth, isSubsequentPage ? 14 : 28, 'F');

    // Title text
    doc.setTextColor(237, 223, 203); // #EADFCB
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isSubsequentPage ? 12 : 16);
    doc.text('DONA GLORIA - BAR TERRAZA', margin + 6, y + (isSubsequentPage ? 9 : 12));

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(isSubsequentPage ? 8 : 10);
    doc.setTextColor(227, 184, 124); // #E3B87C
    doc.text(
      isSubsequentPage ? 'Mi Pedido (Continuación)' : 'MI PEDIDO PERSONAL',
      margin + 6,
      y + (isSubsequentPage ? 13 : 20)
    );

    if (!isSubsequentPage) {
      // Date badge
      const dateStr = new Date(order.timestamp).toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      doc.setFontSize(8);
      doc.setTextColor(255, 251, 242);
      doc.text(`Presentado: ${dateStr}`, pageWidth - margin - 6, y + 12, { align: 'right' });

      const expStr = new Date(order.expiryTime).toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
      });
      doc.setTextColor(180, 180, 180);
      doc.text(`Valido hasta: ${expStr}`, pageWidth - margin - 6, y + 20, { align: 'right' });
    }

    y += isSubsequentPage ? 18 : 34;
  };

  // Draw Initial Header
  drawHeaderBanner(false);

  // Load thumbnail image data URLs in parallel with fallbacks
  const imageMap = new Map<string, string | null>();
  const imagePromises = order.items.map(async (item) => {
    const src = item.imageUrl || item.imageId;
    if (src && !imageMap.has(src)) {
      const base64 = await loadImageAsBase64(src);
      imageMap.set(src, base64);
    }
  });
  await Promise.all(imagePromises);

  // Group items by category
  const categoriesPresent = OFFICIAL_CATEGORIES.filter((cat) =>
    order.items.some((i) => i.category?.trim().toUpperCase() === cat.trim().toUpperCase())
  );

  for (const category of categoriesPresent) {
    const items = order.items.filter(
      (i) => i.category?.trim().toUpperCase() === category.trim().toUpperCase()
    );

    checkPageBreak(16);

    // Category Section Header
    doc.setFillColor(155, 27, 48); // Burgundy #9B1B30
    doc.rect(margin, y, contentWidth, 7, 'F');
    doc.setTextColor(255, 251, 242);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(category.toUpperCase(), margin + 4, y + 5);
    y += 9;

    for (const item of items) {
      checkPageBreak(22);

      const unitPrice = typeof item.priceCup === 'number' ? item.priceCup : 0;
      const lineTotal = unitPrice * item.quantity;
      const itemSrc = item.imageUrl || item.imageId;
      const imageBase64 = itemSrc ? imageMap.get(itemSrc) : null;

      // Card Background
      doc.setFillColor(252, 249, 242);
      doc.setDrawColor(234, 223, 203);
      doc.roundedRect(margin, y, contentWidth, 20, 1.5, 1.5, 'FD');

      // Dish Image Thumbnail or Placeholder Box
      const imgX = margin + 2;
      const imgY = y + 2;
      const imgSize = 16;

      if (imageBase64) {
        try {
          doc.addImage(imageBase64, 'JPEG', imgX, imgY, imgSize, imgSize);
        } catch {
          doc.setFillColor(239, 230, 213);
          doc.rect(imgX, imgY, imgSize, imgSize, 'F');
          doc.setTextColor(155, 27, 48);
          doc.setFontSize(6);
          doc.text('DG', imgX + 5, imgY + 9);
        }
      } else {
        doc.setFillColor(239, 230, 213);
        doc.rect(imgX, imgY, imgSize, imgSize, 'F');
        doc.setTextColor(155, 27, 48);
        doc.setFontSize(6);
        doc.text('DG', imgX + 5, imgY + 9);
      }

      // Dish Info (Name & Portion)
      const textX = imgX + imgSize + 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(30, 30, 30);
      
      const maxNameWidth = contentWidth - 85;
      const truncatedName = doc.splitTextToSize(item.name, maxNameWidth)[0];
      doc.text(truncatedName, textX, y + 6.5);

      let subInfoY = y + 11;
      if (item.portion && item.portion.trim()) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(`Porcion/Volumen: ${item.portion.trim()}`, textX, subInfoY);
        subInfoY += 4.5;
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(155, 27, 48);
      doc.text(`Precio unitario: $${unitPrice.toLocaleString('es-ES')} CUP`, textX, subInfoY);

      // Right Side: Quantity & Subtotal
      const rightX = margin + contentWidth - 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(155, 27, 48);
      doc.text(`Cant: ${item.quantity}`, rightX - 35, y + 8, { align: 'right' });

      doc.setFontSize(11);
      doc.setTextColor(30, 30, 30);
      doc.text(`$${lineTotal.toLocaleString('es-ES')} CUP`, rightX, y + 8, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(130, 130, 130);
      doc.text('Subtotal linea', rightX, y + 14, { align: 'right' });

      y += 22;
    }

    y += 3;
  }

  // Summary Footer Box
  checkPageBreak(30);

  doc.setFillColor(30, 30, 30);
  doc.rect(margin, y, contentWidth, 24, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(227, 184, 124);
  doc.text('RESUMEN DEL PEDIDO', margin + 6, y + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(255, 251, 242);
  doc.text(`Total de platos/unidades: ${order.totalUnits}`, margin + 6, y + 16);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(227, 184, 124);
  doc.text(`TOTAL: $${order.totalPrice.toLocaleString('es-ES')} CUP`, margin + contentWidth - 6, y + 14, {
    align: 'right',
  });

  y += 28;

  // Footer Note
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(
    'Dona Gloria Bar-Terraza - Bayamo, Granma. Documento informativo generado digitalmente.',
    pageWidth / 2,
    y + 4,
    { align: 'center' }
  );

  // File Name formatting
  const pad = (n: number) => String(n).padStart(2, '0');
  const d = new Date(order.timestamp);
  const dateFormatted = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const timeFormatted = `${pad(d.getHours())}${pad(d.getMinutes())}`;
  const fileName = `Pedido_Dona_Gloria_${dateFormatted}_${timeFormatted}.pdf`;

  return { doc, fileName };
}

/**
 * Generates and downloads a complete PDF report of a presented personal order.
 */
export async function generateOrderPdf(order: PresentedOrder): Promise<string> {
  const { doc, fileName } = await buildOrderPdfDocument(order);
  doc.save(fileName);
  return fileName;
}

/**
 * Generates a JavaScript File object containing the PDF document.
 */
export async function generateOrderPdfFile(order: PresentedOrder): Promise<File> {
  const { doc, fileName } = await buildOrderPdfDocument(order);
  const pdfBlob = doc.output('blob');
  return new File([pdfBlob], fileName, { type: 'application/pdf' });
}
