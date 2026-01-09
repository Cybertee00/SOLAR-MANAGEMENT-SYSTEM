# Mobile vs Desktop Customization Guide

## Quick Overview

The app's responsive design is controlled in `client/src/index.css`. All styles are organized into two main sections:

1. **Desktop/Laptop Styles** (default, applies to screens wider than 768px)
2. **Mobile Styles** (applies to screens 768px and below)

## How to Customize

### 1. Change the Breakpoint

The breakpoint (when mobile styles kick in) is set at the top of `index.css`:

```css
:root {
  --mobile-breakpoint: 768px;
}
```

**To change when mobile styles activate:**
- Edit the `@media (max-width: 768px)` queries in the CSS
- Common breakpoints: `480px` (small phones), `768px` (tablets), `1024px` (small laptops)

### 2. Customize Mobile Styles

All mobile-specific styles are in the `@media (max-width: 768px)` section at the bottom of `index.css`.

**Common things to customize:**

#### Button Sizes on Mobile
```css
@media (max-width: 768px) {
  .btn {
    padding: 12px 16px;  /* Change padding */
    font-size: 14px;     /* Change font size */
    width: 100%;         /* Remove width: 100% to keep buttons inline */
  }
}
```

#### Card Padding on Mobile
```css
@media (max-width: 768px) {
  .card {
    padding: 15px;       /* Make smaller: 10px, or larger: 20px */
    margin-bottom: 15px; /* Adjust spacing */
  }
}
```

#### Font Sizes on Mobile
```css
@media (max-width: 768px) {
  h2 {
    font-size: 20px;     /* Make smaller or larger */
  }
  
  h3 {
    font-size: 18px;     /* Make smaller or larger */
  }
}
```

#### Table Layout on Mobile
Currently, tables convert to card layout on mobile. To keep tables as tables (with horizontal scroll):

```css
@media (max-width: 768px) {
  table {
    display: table;      /* Change from 'block' to 'table' */
  }
  
  table thead {
    display: table-header-group;  /* Show headers */
  }
  
  table tr {
    display: table-row;  /* Keep as rows */
  }
  
  table td {
    display: table-cell; /* Keep as cells */
  }
}
```

### 3. Customize Desktop Styles

Desktop styles are the default styles (before the `@media` query). Edit them directly in the "Desktop/Laptop Styles" section.

## Examples

### Example 1: Make buttons smaller on mobile
```css
@media (max-width: 768px) {
  .btn {
    padding: 8px 12px;   /* Smaller padding */
    font-size: 12px;     /* Smaller text */
  }
}
```

### Example 2: Keep buttons inline on mobile (not full width)
```css
@media (max-width: 768px) {
  .btn {
    width: auto;         /* Remove full width */
    margin-right: 10px; /* Add spacing between buttons */
  }
}
```

### Example 3: Increase mobile font sizes
```css
@media (max-width: 768px) {
  .card {
    font-size: 18px;     /* Larger base font */
  }
  
  h2 {
    font-size: 24px;     /* Larger headings */
  }
}
```

### Example 4: Change mobile breakpoint to tablet size
Change all instances of `@media (max-width: 768px)` to `@media (max-width: 1024px)` to apply mobile styles to tablets too.

## Testing

1. **Desktop**: Open browser at full width (or resize to > 768px)
2. **Mobile**: 
   - Use browser DevTools (F12) → Toggle device toolbar (Ctrl+Shift+M)
   - Or resize browser window to < 768px width
   - Or test on actual mobile device

## Need Help?

If you want to customize something specific, tell me:
- What element (buttons, cards, tables, forms, etc.)
- What you want to change (size, spacing, layout, colors)
- Mobile, desktop, or both

I can help you write the exact CSS changes needed!
