# Design System Specification

This document outlines the core tokens for the application's design system, covering the color palette, typography definitions, and structural layout configurations (radius and shadows).

---

## 1. Color Palette

The color tokens follow a component-driven architecture, optimizing for light backgrounds with warm, earthy accents and deep charcoal typography.

### Core System Colors
| Token | Hex Value | Preview / Notes |
| :--- | :--- | :--- |
| **Primary** | `#a67c52` | Warm brown accent |
| **Primary Foreground** | `#ffffff` | Pure white for high contrast |
| **Secondary** | `#e2d8c3` | Soft cream accent |
| **Secondary Foreground**| `#5c4d3f` | Muted brown-charcoal |
| **Accent** | `#d4c8aa` | Warm sand accent |
| **Accent Foreground** | `#4a3f35` | Deep charcoal |
| **Background** | `#f5f1e6` | Main application background (Warm off-white) |
| **Foreground** | `#4a3f35` | Primary text and iconography color |
| **Card** | `#fffcf5` | Surface color for elevated elements |
| **Card Foreground** | `#4a3f35` | Text color on card surfaces |
| **Popover** | `#fffcf5` | Surface color for overlays/tooltips |
| **Popover Foreground** | `#4a3f35` | Text color on overlays |
| **Muted** | `#ece5d8` | Subtle backgrounds / disabled states |
| **Muted Foreground** | `#7d6b56` | De-emphasized text color |
| **Destructive** | `#b54a3f` | Error / Alert state crimson |
| **Destructive Foreground**| `#ffffff` | White text on alert states |

### Elements & Data Visualization
| Token | Hex Value | Application |
| :--- | :--- | :--- |
| **Border** | `#dbd0ba` | Standard component borders |
| **Input** | `#dbd0ba` | Form field boundaries |
| **Ring** | `#a67c52` | Focus state ring |
| **Chart 1** | `#a67c52` | Primary data series |
| **Chart 2** | `#8d6e4c` | Secondary data series |
| **Chart 3** | `#735a3a` | Tertiary data series |
| **Chart 4** | `#b3906f` | Quaternary data series |
| **Chart 5** | `#c0a080` | Quinary data series |

### Navigation & Sidebar Component
| Token | Hex Value |
| :--- | :--- |
| **Sidebar** | `#ece5d8` |
| **Sidebar Foreground** | `#4a3f35` |
| **Sidebar Primary** | `#a67c52` |
| **Sidebar Primary Foreground**| `#ffffff` |
| **Sidebar Accent** | `#d4c8aa` |
| **Sidebar Accent Foreground** | `#4a3f35` |
| **Sidebar Border** | `#dbd0ba` |
| **Sidebar Ring** | `#a67c52` |

---

## 2. Typography

The type scale uses high-personality serif faces for primary hierarchy and a highly legible monospace variant for code/technical strings.

* **Font Sans:** `Libre Baskerville`
* **Font Serif:** `Lora`
* **Font Mono:** `IBM Plex Mono`

---

## 3. Structural & Elevation Tokens

These tokens govern spatial layout consistency and component elevation properties.

### Border Radius
* **Base Radius:** `0.25rem` (4px equivalent on standard 16px base)

### Component Box Shadows
| Property | Value |
| :--- | :--- |
| **X Offset** | `0px` |
| **Y Offset** | `1px` |
| **Blur** | `2px` |
| **Spread** | `0px` |
| **Color** | `#0000000d` (Black at roughly 5% opacity) |