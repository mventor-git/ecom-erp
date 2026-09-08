# Dark Mode Implementation

## Overview
Dark mode has been successfully implemented for the entire customer website (excluding the welcome page). The implementation includes:

1. **System Preference Detection**: Automatically detects and applies the user's system theme preference on first visit
2. **Manual Toggle**: Users can manually switch between light and dark modes using a toggle button
3. **Persistent Preference**: User's theme choice is saved to localStorage and persists across sessions
4. **Smooth Transitions**: Theme changes include smooth color transitions for a polished experience

## Implementation Details

### Files Created/Modified

#### New Files:
1. **`src/context/ThemeContext.jsx`**
   - React context for managing theme state
   - Detects system preference using `window.matchMedia`
   - Saves user preference to localStorage
   - Listens for system theme changes (only applies if user hasn't manually set preference)

2. **`src/components/ThemeToggle.jsx`**
   - Toggle button component with sun/moon icons
   - Smooth sliding animation
   - Accessible with proper ARIA labels

#### Modified Files:
1. **`src/App.jsx`**
   - Wrapped app with `ThemeProvider`

2. **`src/main.jsx`**
   - Added immediate theme application script to prevent flash of wrong theme

3. **`src/components/Navbar.jsx`**
   - Added `ThemeToggle` component to desktop and mobile navigation

4. **`src/index.css`**
   - Added dark mode base styles
   - Added smooth color transitions

5. **`tailwind.config.js`**
   - Already configured with `darkMode: 'class'`

## How It Works

### Initial Load:
1. Script in `main.jsx` runs immediately before React renders
2. Checks localStorage for saved theme preference
3. If no saved preference, checks system preference via `prefers-color-scheme`
4. Applies the appropriate theme class to `<html>` element
5. React then renders with the correct theme already applied (no flash)

### Theme Toggle:
1. User clicks the toggle button in the navbar
2. `ThemeContext` updates the theme state
3. Theme is saved to localStorage
4. The `dark` class is added/removed from `<html>` element
5. All components with `dark:` variants update automatically

### System Preference Changes:
- If user hasn't manually set a preference, the app will follow system theme changes
- Once user manually toggles, their choice is saved and system changes are ignored
- This respects user intent while providing smart defaults

## Usage

### For Users:
- **Desktop**: Click the theme toggle button in the top-right corner of the navbar
- **Mobile**: Open the mobile menu and find the theme toggle
- Theme preference is automatically saved and will persist across visits

### For Developers:
To use the theme in any component:

```jsx
import { useTheme } from '../context/ThemeContext';

function MyComponent() {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <div className="bg-white dark:bg-dark-900">
      <p className="text-gray-900 dark:text-white">
        Current theme: {theme}
      </p>
    </div>
  );
}
```

## Tailwind Dark Mode Classes

All components should use Tailwind's `dark:` variant for dark mode styling:

```jsx
<div className="bg-white dark:bg-dark-900 text-gray-900 dark:text-white">
  Content
</div>
```

Common patterns:
- Backgrounds: `bg-white dark:bg-dark-900`
- Text: `text-gray-900 dark:text-white`
- Borders: `border-gray-200 dark:border-dark-700`
- Hover states: `hover:bg-gray-100 dark:hover:bg-dark-800`

## Testing

To test the dark mode implementation:

1. **System Preference Detection**:
   - Change your OS theme to dark/light
   - Clear localStorage: `localStorage.removeItem('theme')`
   - Refresh the page
   - The app should match your system theme

2. **Manual Toggle**:
   - Click the theme toggle button
   - Theme should switch immediately
   - Refresh the page - theme should persist

3. **Mobile**:
   - Open mobile menu
   - Find the theme toggle
   - Toggle should work the same as desktop

## Notes

- The welcome page (`/`) does not have dark mode as per requirements
- All other pages (`/home`, `/products`, `/cart`, etc.) support dark mode
- Theme transitions are smooth (300ms duration)
- No flash of wrong theme on initial load
- Respects user's manual preference over system preference
