---
name: Tsukuyomi
colors:
  surface: '#101417'
  surface-dim: '#101417'
  surface-bright: '#363a3d'
  surface-container-lowest: '#0b0f12'
  surface-container-low: '#181c1f'
  surface-container: '#1c2023'
  surface-container-high: '#262a2e'
  surface-container-highest: '#313538'
  on-surface: '#e0e3e7'
  on-surface-variant: '#c5c5d2'
  inverse-surface: '#e0e3e7'
  inverse-on-surface: '#2d3134'
  outline: '#8f909c'
  outline-variant: '#454651'
  surface-tint: '#b8c3ff'
  primary: '#c2cbff'
  on-primary: '#152973'
  primary-container: '#9daeff'
  on-primary-container: '#2d3f88'
  inverse-primary: '#4859a4'
  secondary: '#66dbb0'
  on-secondary: '#003828'
  secondary-container: '#22a37c'
  on-secondary-container: '#003122'
  tertiary: '#ffc372'
  on-tertiary: '#452b00'
  tertiary-container: '#e1a859'
  on-tertiary-container: '#613d00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#dde1ff'
  primary-fixed-dim: '#b8c3ff'
  on-primary-fixed: '#001355'
  on-primary-fixed-variant: '#2f418a'
  secondary-fixed: '#84f8cb'
  secondary-fixed-dim: '#66dbb0'
  on-secondary-fixed: '#002116'
  on-secondary-fixed-variant: '#00513b'
  tertiary-fixed: '#ffddb4'
  tertiary-fixed-dim: '#f7bc6a'
  on-tertiary-fixed: '#291800'
  on-tertiary-fixed-variant: '#633f00'
  background: '#101417'
  on-background: '#e0e3e7'
  surface-variant: '#313538'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '500'
    lineHeight: 40px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Geist
    fontSize: 28px
    fontWeight: '500'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 24px
    letterSpacing: 0.01em
  body-lg:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: '0'
  body-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: '0'
  label-sm:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-xs:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-margin: 20px
  gutter: 16px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 24px
  stack-xl: 40px
---

## Brand & Style
The design system is built upon a philosophy of "Lunar Precision"—a quiet, intelligent, and mysterious aesthetic that mirrors the Japanese deity of the moon. It is tailored for high-end mobile security, where the user experience must feel calm yet authoritative.

The style is **Modern Minimalist** with a touch of **Glassmorphism**. It prioritizes vast negative space, ultra-fine lines, and a "submerged" UI depth. The emotional response should be one of absolute digital safety and sophisticated solitude. All interactions should be fluid and dampened, avoiding jarring transitions to maintain the "quiet" atmosphere.

## Colors
The palette is centered on a deep "Eclipse" black to provide maximum contrast for lunar accents.

- **Primary (Moon):** Used for active states, critical security indicators, and primary call-to-actions.
- **Surface Layers:** Depth is created through subtle shifts in saturation rather than brightness. `surface_primary` is for main containers; `surface_secondary` is for interactive elements like inputs or nested cards.
- **Semantic Colors:** Success, Warning, and Alert colors are desaturated to ensure they do not break the overall dark aesthetic while remaining functional.

## Typography
This design system utilizes **Geist** for its technical precision and monospaced-influenced kerning, which reinforces the security and developer-grade intelligence of the app.

- **Headlines:** Use tight letter spacing and medium weights to appear "locked" and secure.
- **Metadata:** Smaller labels should utilize slightly increased letter spacing (0.02em to 0.04em) to maintain legibility against the dark background.
- **Contrast:** Always use `text_secondary` for body text to reduce eye strain, reserving `text_primary` for headings and active states.

## Layout & Spacing
The layout follows a **Fluid Grid** model optimized for mobile-first interactions. 

- **Safe Zones:** A standard 20px margin is applied to the left and right of all screens.
- **Rhythm:** An 8px linear scaling system governs all white space.
- **Security Grouping:** Elements related to a single security check should be grouped with `stack-sm`, while unrelated security modules use `stack-lg`.
- **Verticality:** Use ample top-padding (stack-xl) for main headers to allow the lunar aesthetic to "breathe."

## Elevation & Depth
Depth is communicated through **Low-contrast outlines** and **Tonal layers**. Shadows are strictly avoided to maintain a clean, flat-digital look.

1. **Base Layer:** The `background_hex` layer represents the infinite void.
2. **Surface Layer:** Containers (Cards) use `surface_primary` with a 1px border of `surface_secondary` or a 5% opacity `text_primary` to define edges.
3. **Active/Modal Layer:** Floating elements use `surface_secondary` and may employ a subtle background blur (10px - 20px) when overlapping content.
4. **Interactive State:** When pressed, elements should slightly decrease in opacity (0.8) rather than moving along the Z-axis.

## Shapes
The shape language is "Soft-Modern," utilizing a consistent **16px to 18px radius** for all primary containers and buttons. This curvature provides a humanistic counter-balance to the cold, dark color palette and technical typography. 

- **Primary Containers:** 18px radius.
- **Buttons & Inputs:** 16px radius.
- **Chips/Badges:** Fully rounded (pill-shaped) to distinguish them from interactive buttons.
- **Icons:** Use a 1.5px stroke weight with rounded caps and joins to match the UI's corner softness.

## Components
- **Buttons:** Primary buttons are 56px in height using `primary_color_hex` with `background_hex` text. Secondary buttons use a ghost style with a 1px `surface_secondary` border.
- **Security Cards:** Must use an 18px radius and `surface_primary` fill. Status indicators (dots) should be placed in the top right corner of the card.
- **Input Fields:** 52px height, `surface_secondary` fill, 16px radius. Placeholder text uses `text_muted`. Active state is indicated by a 1px `primary_color_hex` border.
- **Thin-Line Icons:** All icons must maintain a consistent 1.5px stroke width. Never use filled icons unless indicating a "destructive" or "active" state toggle.
- **Pulse Indicator:** For active security scanning, use a soft, 2-stop gradient pulse of the `primary_color_hex` with 0% to 20% opacity.
- **Lists:** List items are separated by 1px lines of `surface_secondary`, with 16px vertical padding to ensure large touch targets.