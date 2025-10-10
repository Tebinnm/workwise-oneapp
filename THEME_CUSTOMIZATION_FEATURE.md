# Theme Customization Feature - Complete Implementation

## Overview

The application now includes comprehensive theme customization allowing users to personalize both the color scheme and background image directly from the header dropdown menu.

## Features Implemented

### 1. Color Theme Customization

- **Color Picker**: Native HTML5 color picker for selecting any color
- **Real-time Updates**: Theme color changes apply instantly across the entire application
- **Persistent Storage**: Selected color saved to localStorage
- **Automatic Conversion**: Hex colors automatically converted to HSL for proper theme integration
- **Glow Effects**: Automatically calculated lighter shades for glow/hover effects

### 2. Background Image Customization

- **Multiple Options**: Choose from 6 predefined background images
- **Visual Preview**: Thumbnail grid showing all available backgrounds
- **Active Indicator**: Checkmark overlay on currently selected background
- **Persistent Storage**: Background preference saved to localStorage

## Available Background Options

1. **OneApp 1** (default) - Background variant 1
2. **OneApp 2** - Background variant 2
3. **OneApp 3** - Background variant 3
4. **OneApp 4** - Background variant 4
5. **OneApp 5** - Background variant 5
6. **OneApp 6** - Background variant 6

### Required Image Files

The following image files should be placed in the `src/` directory:

- `bg-oneapp1.png` ✅ (currently exists)
- `bg-oneapp2.jpg` ⚠️ (needs to be added)
- `bg-oneapp3.jpg` ⚠️ (needs to be added)
- `bg-oneapp4.jpg` ⚠️ (needs to be added)
- `bg-oneapp5.jpg` ⚠️ (needs to be added)
- `bg-oneapp6.jpg` ⚠️ (needs to be added)

The system will work with whatever images are available, but missing images won't display properly in the selector.

## Technical Implementation

### Files Modified

1. **`src/contexts/ThemeContext.tsx`**

   - Added `BackgroundOption` interface
   - Exported `backgroundOptions` array with predefined backgrounds
   - Extended context to manage both color and background state
   - Added `hexToHSL()` converter for color processing
   - Implemented dual localStorage persistence (color + background)
   - Dynamic CSS variable updates for both theme and background

2. **`src/components/layout/AppLayout.tsx`**

   - Added background selector UI in dropdown menu
   - Grid layout (2 columns) for background thumbnails
   - Visual feedback with borders and hover states
   - Check icon overlay for active selection
   - Integrated with Theme Context

3. **`src/index.css`**

   - Removed hardcoded background image
   - Kept background styling properties for dynamic management
   - Added comment documenting dynamic management

4. **`src/hooks/useTheme.ts`**
   - Already properly configured to consume full context

### Storage Keys

- **Color**: `workwise-theme-color` (stores hex color value)
- **Background**: `workwise-background` (stores background ID)

### Default Values

- **Color**: `#ff6b35` (Orange)
- **Background**: `oneapp1`

## User Interface

### Location

All customization options are accessible from the **header dropdown menu**:

1. Click your avatar/profile picture in the top-right corner
2. Dropdown reveals:
   - User information
   - **Theme Color** picker with color input
   - **Background** selector with thumbnail grid
   - Logout option

### Design Features

- **Color Picker**:
  - Palette icon
  - Label "Theme Color"
  - Color input box (shows current color)
- **Background Selector**:
  - Image icon
  - Label "Background"
  - 3-column grid of thumbnail previews (displays 6 background options)
  - Each thumbnail shows:
    - Preview of the background
    - Label at bottom
    - Primary border + ring when selected
    - Checkmark overlay when active
    - Hover effect on non-selected items

## How to Use

### Changing Theme Color

1. Open the header dropdown (click your avatar)
2. Find "Theme Color" section
3. Click the color box to open color picker
4. Select any color from the full spectrum
5. Theme updates instantly

### Changing Background

1. Open the header dropdown (click your avatar)
2. Scroll to "Background" section
3. Click any background thumbnail to select it
4. Background changes immediately
5. Selection persists across sessions

## Extending the Feature

### Adding New Backgrounds

To add new background images, update `src/contexts/ThemeContext.tsx`:

```typescript
export const backgroundOptions: BackgroundOption[] = [
  // ... existing options
  {
    id: "custom-id",
    label: "Custom Name",
    url: "/path/to/image.png",
    thumbnail: "/path/to/thumbnail.png", // optional
  },
];
```

### Customization Ideas

Future enhancements could include:

- Upload custom background images
- More predefined color palettes with quick-select buttons
- Dark/light mode toggle
- Background blur intensity slider
- Background opacity control
- Pattern/texture overlays
- Gradient backgrounds
- Animated backgrounds

## Browser Compatibility

- ✅ Modern browsers (Chrome, Firefox, Safari, Edge)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)
- ✅ Color picker supported natively (fallback to text input on old browsers)
- ✅ LocalStorage required (available in all modern browsers)

## Performance

- Lightweight implementation
- No external dependencies
- Instant color changes (CSS variable updates)
- Background images cached by browser
- Minimal re-renders (optimized with React Context)

## Testing

The feature has been implemented and is ready for testing. The development server is running at:

- Local: http://localhost:8083/
- Network: http://10.199.100.147:8083/

Test both features:

1. Try different colors and verify they apply to buttons, links, accents
2. Switch between backgrounds and verify smooth transitions
3. Reload the page and confirm settings persist
4. Test in light/dark mode (if applicable)
