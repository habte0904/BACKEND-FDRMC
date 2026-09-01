# Live Dashboard Layout & Multi-Screen Display Guide

## Overview
The **DRM Live Situational Dashboard** provides flexible controls to customize how cards are displayed, order their sequence, hide/show specific widgets (including the situational filter panel), and set up multi-screen command wall displays.

---

## 1. Hide & Show Situational Filters
- **Filter Toggle Button**:
  - Located in the Dashboard Header: Click **`Filters`** to show or collapse the filter panel.
  - An indicator dot appears whenever active filters (woreda, hazard type, severity, status, or date ranges) are applied.
  - Your filter visibility preference is saved in `localStorage`, keeping it in your preferred state even after page reload.

---

## 2. Customize Card Ordering & Visibility
Click the **`Layout & Displays`** button in the header (sliders icon) to open the **Dashboard Layout & Card Manager**:

### Visibility Toggles
- Click the **Eye Icon (`👁`)** next to any card to show or hide it.
- When hidden, the card title is struck through and excluded from the live dashboard.

### Card Reordering & Grid Width Controls
- **Card Order**: Use the **Up (`▲`)** and **Down (`▼`)** arrow buttons to move any card up or down in the rendering sequence.
- **Card Grid Width**: Choose the column span for each card using the interactive width pills:
  - **`1/4` (25%)**: 4 cards fit on one row (great for compact monitors)
  - **`1/3` (33%)**: 3 cards fit on one row
  - **`1/2` (50%)**: 2 cards fit side-by-side on one row
  - **`2/3` (66%)**: 2-column wide layout (ideal for the GIS Live Map)
  - **`Full` (100%)**: Full row width
- Click **`Reset Default`** to restore the standard command center arrangement.

### Quick Grid Style Presets:
- **Command Grid**: Mixed layout with full-width alerts and 2:1 spatial & 1:1 trends splits.
- **2-Column Grid**: Splits all cards equally into 2 columns (50% / 50%).
- **3-Column Grid**: Splits all cards into 3 columns (33% each) for dense multi-monitor walls.
- **Full Stack**: All cards take full 100% width stacked sequentially.

### Configurable Cards List:
1. **Key Performance Indicators (KPI Cards)**
2. **Active Early Warning & Disaster Alerts**
3. **Public Submissions & Office Workflow**
4. **Live GIS Incident Map**
5. **Live Activity & Incident Feed**
6. **Incident Severity Trends**
7. **Hazard Severity Breakdown**
8. **Response Activities & Monitoring**
9. **Site Survey & Inspection Status**
10. **Household Vulnerability & Woreda Capacity (Assessment Analytics)**

---

## 3. Screen Configurations & Display Profiles

In the **Layout & Card Manager**, you can select specialized display profiles or **create your own custom named screen setups**:

### Built-in Screen Profiles:
| Display Mode | Focus Area | Included Cards |
| :--- | :--- | :--- |
| **Integrated All** | Complete single-monitor command view | All enabled cards in custom sequence |
| **Screen 1: GIS Map** | Dedicated spatial & situation wall | GIS Map + Early Warning Alerts + Live Incident Feed + KPIs |
| **Screen 2: Analytics** | Executive & statistical trends wall | KPI Cards + Incident Severity Trends + Hazard Breakdown |
| **Screen 3: Dispatch** | Response & field inspection wall | Public Workflow + Response Monitoring + Site Survey Tracking + Alerts |

### Adding Custom Screen Configurations:
1. Click **`Layout & Displays`** in the header.
2. Click **`+ Add Screen Configuration`**.
3. Enter a Screen Name (e.g. *TV Wall 2 - Emergency Ops*, *Operations Room 3*) and description.
4. Click **`Save & Activate Screen`**.
5. Customize card order and visibility for that screen.
6. All saved screen configurations appear in the profile grid and can be deleted anytime using the trash icon.

---

## 4. Real-Time Dynamic Layout & Dual View Mode Support
- **Dual View Support**: The customizable grid layout, card ordering, and screen profiles apply seamlessly in **both Command Operations View and Executive Charts View**.
- **Equalized Side-by-Side Dimensions**: When cards share a row (e.g. 50/50, 33/33/33, or 2/3 + 1/3), their heights and widths stretch to match each other equally (`items-stretch`).
- **Instant Persistence**: When you toggle visibility (hide/show), change widths, or reorder cards (move up/down), the live dashboard updates **instantly in real-time** and persists across browser sessions.

---

## 4. Standalone Card Pop-Out & Dedicated Focus Mode
- In the **Layout & Card Manager**, click the **Pop-out icon (`↗`)** next to any card (e.g. *Live GIS Incident Map* or *Active Early Warning & Disaster Alerts*).
- This opens that single card in a dedicated, distraction-free full-screen view—ideal for projecting onto secondary TV walls or dedicated video feeds in an operations room.
- Click **`X`** in the top right corner to return to the standard view.

---

## 5. Storage & Persistence
All customizations (theme, filter visibility, custom card ordering, enabled cards, and screen display profiles) are automatically saved to browser storage and restored when you revisit the dashboard.
