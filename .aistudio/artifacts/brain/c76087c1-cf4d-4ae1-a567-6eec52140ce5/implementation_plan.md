# Unified Detailed Personal Order Builder (Revisar & Presentar)

Fix and refine the personal order builder in Doña Gloria so that both **«Revisar»** (Edit Mode) and **«Presentar»** (Waiter Read-Only Mode) render full itemized dish details with photos, names, portions, unit prices, quantities, and line subtotals within a single, unified overlay modal container.

## Confirmed User Decisions

- **Quantity Display in Presentar Mode**: Prominently highlighted quantity (`3×`) alongside each line's subtotal amount.
- **Modal Window Transition**: Smooth fluid transition changing the exact same overlay window between edit mode («Revisar») and read-only mode («Presentar»), maintaining identical size, position, backdrop, and styling.

---

## 1. Overview & Core Concept

Currently, users can construct a personal order by picking dishes from the menu. However, the overlay modals needed structural alignment so that:
1. Every selected dish reliably retrieves its photograph, full name, portion/volume (if defined), unit price, quantity, and line total (`unitPrice × quantity`).
2. The **«Presentar»** view shares the exact same elegant overlay modal layout as **«Revisar»** (`max-w-2xl max-h-[90vh]`), replacing the full-screen view with a unified, readable modal that transitions smoothly.

```
┌──────────────────────────────────────────────────────────┐
│                   Doña Gloria Menu                       │
│ ┌──────────────────────────────────────────────────────┐ │
│ │  [+] Order Floating Bar ($4,800 CUP - 3 items)       │ │
│ └──────────────────────────────────────────────────────┘ │
└──────────────────────────┬───────────────────────────────┘
                           │ Opens Overlay
                           ▼
┌──────────────────────────────────────────────────────────┐
│                  UNIFIED OVERLAY MODAL                   │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Header: [Revisar Pedido] <-> [Presentar Pedido]      │ │
│ ├──────────────────────────────────────────────────────┤ │
│ │ Itemized Dish Rows (Grouped by Category):            │ │
│ │ ┌──────────┬──────────────────────┬────────────────┐ │ │
│ │ │ [Thumbnail] │ Name & Portion    │ Cantidad       │ │ │
│ │ │ Photo    │ Precio Unitario      │ Subtotal Linea │ │ │
│ │ └──────────┴──────────────────────┴────────────────┘ │ │
│ ├──────────────────────────────────────────────────────┤ │
│ │ Footer: Total Units | Highlighted Total ($ CUP)      │ │
│ │ Action Buttons: [Limpiar] [Presentar] / [Regresar]   │ │
│ └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

---

## 2. User Experience & Visual Design

### A. Layout Structure & Distribution of Each Dish Row

Each selected item in the list will follow this exact two-column flex layout:

- **Left Column**:
  - **Thumbnail Image**: Uniform square thumbnail (`w-20 h-20 sm:w-24 sm:h-24`) with rounded corners, subtle border (`border-[#EADFCB]`), and lazy image loading from `item.imageUrl || item.imageId`. Utensils icon fallback if no photo exists.
  - **Dish Title**: `font-serif font-bold text-base sm:text-lg text-[#1E1E1E]`.
  - **Portion / Volume**: `text-xs text-[#8A8380] italic` (omitted clean if `portion` is null/undefined).
  - **Unit Price**: `text-xs font-mono font-semibold text-[#9B1B30] bg-[#9B1B30]/5 px-2 py-0.5 rounded` (e.g. `Unit: $1,200 CUP`).

- **Right Column**:
  - **In «Revisar» Mode**:
    - Stepper controls: `[ - ] quantity [ + ]`
    - Line Total: `$ (unitPrice × quantity) CUP`
    - Quick remove button: `Trash2` icon with "Quitar"
  - **In «Presentar» Mode**:
    - Large quantity badge: `font-serif text-3xl font-black text-[#9B1B30]` + `×`
    - Line Subtotal: `font-mono text-lg font-bold text-[#1E1E1E]`

### B. Unified Modal Container

- **Backdrop**: `fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4`
- **Modal Box**: `bg-[#FFFBF2] text-[#1E1E1E] w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-[#EADFCB]`
- **Header**: Clean branding with title, subtitle, and close `X` button.
- **Footer**: Distinctive highlighted total container displaying total units count and prominent total price in CUP.

---

## 3. Technical Strategy & Data Flow

### A. Data Integrity & State Mapping

1. **State Store (`usePersonalOrder`)**:
   - `orderItems`: Array of `OrderItem` objects containing `_id`, `name`, `description`, `category`, `priceCup`, `portion`, `imageUrl`, `imageId`, and `quantity`.
   - Ensure `orderItems` are correctly synchronized with Convex published dishes so all field references (`priceCup`, `portion`, `imageUrl`, `imageId`) are fully populated.

2. **Component Refactoring (`MenuPage.tsx` & `MenuSection.tsx`)**:
   - Extract or unify the order modal into a clean shared rendering pattern or component `PersonalOrderModal` that accepts `mode: 'review' | 'present'`.
   - Manage `orderModalMode` (`'review'` | `'present'`) so clicking "Presentar" inside "Revisar" transitions the mode fluidly without unmounting or changing overlay dimensions.

3. **Validation & Fallbacks**:
   - Format prices safely using `typeof item.priceCup === 'number' ? item.priceCup : 0`.
   - Check `item.imageUrl || item.imageId` before rendering `<img>`.
   - Hide portion element if `!item.portion`.

---

## 4. Implementation Steps

1. **Audit & Refactor `src/hooks/usePersonalOrder.ts`**:
   - Confirm full dish property preservation when items are added to `orderItems`.

2. **Build Unified `PersonalOrderModal` Component (or shared modal renderer in `MenuPage.tsx` / `MenuSection.tsx`)**:
   - Implement mode switching (`review` vs `present`).
   - Style left-column thumbnail + details and right-column quantity + line subtotal.
   - Add highlighted footer total block and contextual action buttons.

3. **Integrate Modal into `MenuPage.tsx` and `MenuSection.tsx`**:
   - Replace the legacy full-screen waiter view in `MenuPage.tsx` with the unified modal.
   - Synchronize floating order bar triggers (`Revisar` opens mode `review`, `Presentar` opens mode `present`).

4. **Linting & Compilation Verification**:
   - Run `lint_applet` and `compile_applet` to confirm zero build or TypeScript errors.
