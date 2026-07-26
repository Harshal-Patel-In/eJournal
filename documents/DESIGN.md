# Frontend Design System & UI Specification (DESIGN.md)
## Journal Management & Review System (eJournal)

> This document defines the complete visual language, design system tokens, interactive component behaviors, and screen layouts for the eJournal project. Grounded in Apple Human Interface Guidelines (HIG) principles and adapted for a modern, responsive web application using Next.js, Tailwind CSS, and shadcn/ui.

---

## 1. Design Philosophy

The visual and interactive style of eJournal is **minimalistic, calm, clean, and highly efficient**. 

Academic writing, formula composition, and academic review require deep focus. The UI must fade into the background, drawing the user's attention entirely to their content.

### 1.1 The Layered Depth Model (Functional vs. Content Layer)
eJournal adopts Apple's depth model using a dual-layer interface system:

1. **The Content Layer (Base Layer)**:
   - Contains the actual academic text, tables, formulas, image blocks, and data grids.
   - Styled with clean, solid, high-contrast backgrounds (pure light or deep dark solid values).
   - Uses zero glassmorphic or translucent treatments to ensure perfect text contrast and absolute legibility.
2. **The Functional Layer (Floating Layer)**:
   - Contains control utilities, toolbars, sidebars, navigation tabs, popovers, and interactive action components.
   - Implements **Liquid Glass** properties: high blur radius, low background opacity, dynamic color adaptation, and subtle border strokes.
   - Appears visually floating over the Content Layer to denote its utility and accessibility.

```
┌──────────────────────────────────────────────────────────┐
│  Functional Layer (Sidebars, Toolbars, Slash Menu, CTAs) │  ← Liquid Glass (Blur: 20-30px, Opacity: 70-80%)
├──────────────────────────────────────────────────────────┤
│  Content Layer (Structured Block Editor Canvas, Text)    │  ← Solid background, high-contrast typography
└──────────────────────────────────────────────────────────┘
```

### 1.2 Design Principles
- **Clarity over Decoration**: Every line, border, color accent, and shadow must serve a functional purpose. If a layout can be clean without a border, omit the border.
- **Visual Continuity**: Controls must match expectations. Popovers emerge from their triggering buttons, drag actions show immediate ghost previews, and selections animate smoothly.
- **Zero Input Friction**: Reduce keystrokes and pointer movement. The slash menu (`/`) inserts blocks instantly; the Equation Builder uses simple visual grids; auto-save occurs silently.
- **Device Adaptability**: Seamless transition from desktop layouts to mobile structures. Sidebar items become bottom tabs, panels stack vertically, and touch targets enlarge automatically on mobile.

---

## 2. Design Tokens

The following CSS custom properties and utility classes form the design system core. They map directly to Tailwind configuration tokens.

### 2.1 Color Palette
The color system supports dynamic Light and Dark appearance modes. It uses semantic naming patterns mapping directly to standard HSL values.

#### Light Mode Colors
```css
--background: 0 0% 100%;           /* Pure white */
--foreground: 240 10% 4%;          /* Deep carbon gray */
--card: 0 0% 98%;                  /* Warm white background */
--card-foreground: 240 10% 4%;
--popover: 0 0% 100%;
--popover-foreground: 240 10% 4%;
--primary: 240 6% 10%;             /* Charcoal black */
--primary-foreground: 0 0% 98%;
--secondary: 240 5% 96%;           /* Light cool gray */
--secondary-foreground: 240 6% 10%;
--muted: 240 5% 96%;
--muted-foreground: 240 4% 46%;    /* Mid-tone gray */
--accent: 212 100% 45%;            /* Apple Blue: interactive highlight */
--accent-foreground: 0 0% 100%;
--destructive: 0 84% 60%;          /* Soft error red */
--destructive-foreground: 0 0% 98%;
--border: 240 6% 90%;
--input: 240 6% 90%;
--ring: 212 100% 45%;

/* Liquid Glass Light Tokens */
--glass-bg: 0 0% 100% / 0.75;
--glass-border: 240 6% 90% / 0.8;
--glass-blur: 24px;
```

#### Dark Mode Colors
```css
--background: 240 10% 4%;          /* Pure dark black */
--foreground: 0 0% 98%;            /* Off-white */
--card: 240 10% 6%;                /* Soft elevated dark card */
--card-foreground: 0 0% 98%;
--popover: 240 10% 6%;
--popover-foreground: 0 0% 98%;
--primary: 0 0% 98%;
--primary-foreground: 240 10% 4%;
--secondary: 240 4% 16%;
--secondary-foreground: 0 0% 98%;
--muted: 240 4% 16%;
--muted-foreground: 240 5% 65%;
--accent: 212 100% 50%;            /* Vivid Apple Blue */
--accent-foreground: 0 0% 100%;
--destructive: 0 84% 60%;
--destructive-foreground: 0 0% 98%;
--border: 240 4% 16%;
--input: 240 4% 16%;
--ring: 212 100% 50%;

/* Liquid Glass Dark Tokens */
--glass-bg: 240 10% 4% / 0.70;
--glass-border: 240 4% 20% / 0.8;
--glass-blur: 24px;
```

#### Status Semantic Palette
- **Success (Approved)**: HSL `142 76% 36%` (Emerald Green)
- **Warning (Changes Requested)**: HSL `38 92% 50%` (Amber Orange)
- **Info (Submitted / Under Review)**: HSL `212 100% 45%` (Ocean Blue)
- **Destructive (Draft/Error)**: HSL `0 84% 60%` (Coral Red)

### 2.2 Typography
We use sans-serif fonts for interface navigation and serif fonts for academic reading block layout.

#### Font Families
- **Interface / UI**: `Inter`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`, sans-serif.
- **Academic Block Content (Editor)**: `New York` (or fallback `Georgia`, `Charter`, `serif`) — used exclusively inside the paragraph, heading, result, and observation blocks to provide a scholarly typographic voice.
- **Mathematical Output**: `KaTeX_Main`, `KaTeX_Math`, `KaTeX_Size1` (loaded via KaTeX package).
- **Code / Technical Text**: `JetBrains Mono`, `Fira Code`, monospace.

#### Type Scale and Hierarchy

| Token Name | Font Family | Size (px / rem) | Line Height | Weight | Usage |
|------------|-------------|-----------------|-------------|--------|-------|
| `Title 1` | Interface | 32px / 2.0rem | 1.2 | Bold (700) | Document title, main page headers |
| `Title 2` | Interface | 24px / 1.5rem | 1.3 | Semibold (600) | Section headers, modal titles |
| `Title 3` | Interface | 20px / 1.25rem | 1.4 | Semibold (600) | Group headers, card titles |
| `Heading 1` | Academic | 28px / 1.75rem | 1.3 | Bold (700) | Block H1 (Experiment Title) |
| `Heading 2` | Academic | 22px / 1.375rem | 1.4 | Semibold (600) | Block H2 (Experiment Aim, Method) |
| `Heading 3` | Academic | 18px / 1.125rem | 1.4 | Medium (500) | Block H3 (Subsection heading) |
| `Body Large` | Academic | 17px / 1.0625rem| 1.6 | Regular (400) | Primary academic text blocks |
| `Body Base` | Interface | 14px / 0.875rem | 1.5 | Regular (400) | UI text, table contents, sidebar links |
| `Body Small` | Interface | 12px / 0.75rem  | 1.4 | Medium (500) | Captions, metadata, input placeholders |
| `Code` | Monospace | 13px / 0.8125rem| 1.5 | Regular (400) | Inline code, code blocks |

### 2.3 Spacing Grid
Spacing utilizes an 8px base spacing grid to guarantee visual alignment. All padding, margin, gap, and layout grid variables follow this token scale:

- **Space 1** (`4px` / `0.25rem`): Micro gaps, inside input icons, inline spacing.
- **Space 2** (`8px` / `0.5rem`): Pill padding, list item gaps, small buttons.
- **Space 3** (`12px` / `0.75rem`): Default inner element padding, toolbar gaps, metadata labels.
- **Space 4** (`16px` / `1.0rem`): Card padding, standard container gaps, button separation.
- **Space 5** (`24px` / `1.5rem`): Section gaps, editor side padding, modal inner offsets.
- **Space 6** (`32px` / `2.0rem`): High visual separation, dashboard layout gap, page margins.
- **Space 7** (`48px` / `3.0rem`): Header vertical offsets, login card separation.
- **Space 8** (`64px` / `4.0rem`): Hero sections, empty state layouts.

### 2.4 Border Radius
Curves are soft and clean, mirroring the Apple hardware squircle coordinates.
- `radius-sm` (`4px`): Table cell buttons, checkbox, math formula symbols.
- `radius-md` (`8px`): Inputs, dropdown lists, small context buttons, code block wraps.
- `radius-lg` (`12px`): Primary cards, list cells, editor block elements.
- `radius-xl` (`16px`): Modals, main sidebars, popovers, image uploads.
- `radius-full` (`9999px`): Pill tags, status badges, avatar outlines, toggle switches.

### 2.5 Shadows & Elevation
Shadows simulate depth using soft ambient light.
- **Shadow Low (Resting controls)**:
  `0 1px 2px 0 rgba(0, 0, 0, 0.05)`
- **Shadow Medium (Dropdowns, Floating toolbars, Inline cards)**:
  `0 4px 12px -2px rgba(0, 0, 0, 0.08), 0 2px 6px -1px rgba(0, 0, 0, 0.04)`
- **Shadow High (Modals, Context Menus, Floating controls over editor)**:
  `0 12px 28px -4px rgba(0, 0, 0, 0.12), 0 8px 16px -2px rgba(0, 0, 0, 0.08)`

### 2.6 Iconography System
We use **Lucide React** as our icon engine. All icons must adopt consistent sizes and stroke weights:
- **Default UI Icons**: `size={16}`, `strokeWidth={2}` (e.g., Edit, Settings, Trash, ChevronDown).
- **Navigation Sidebar / Tab Icons**: `size={20}`, `strokeWidth={1.75}` (e.g., Folder, BookOpen, Inbox, NotificationBell).
- **Interactive Action Indicators**: `size={18}`, `strokeWidth={2}` (e.g., Check, Plus, AlertCircle).

---

## 3. Navigation and Layout System

The navigation architecture shifts dynamically to support desktop, tablet, and mobile screens.

```
                  DESKTOP LAYOUT (Sidebar System)
┌──────────────────────────────────────────────────────────┐
│  Sidebar (Floating Glass)   │  Main Content Canvas       │
│  - User profile avatar      │  - Page Title Header       │
│  - Classrooms list          │  - Active view area        │
│  - Settings link            │  - Margins and scroll zone │
└─────────────────────────────┴────────────────────────────┘

                  MOBILE LAYOUT (Bottom Tab System)
┌──────────────────────────────────────────────────────────┐
│  Main Content Canvas (Title + Scroll view)               │
├──────────────────────────────────────────────────────────┤
│  Bottom Tab Bar (Translucent Glass - Home, Inbox, Alert) │
└──────────────────────────────────────────────────────────┘
```

### 3.1 Desktop Layout (Sidebar System)
- **Sidebar Container**: Width: `260px`. Fixed position. Utilizes a Regular Liquid Glass treatment:
  `backdrop-filter: blur(24px)`, `background: rgba(var(--glass-bg))` with a `1px` border-r `rgba(var(--glass-border))`.
- **Top Sidebar Section**: Active User profile card. Clicking triggers a dropdown modal with profile update and logout.
- **Main List**: Vertically stacked links: Classrooms, My Journals, Notifications, Settings. Active item has a colored background accent (using the client's accent token `--accent`).
- **Collapsible behavior**: Clicking the "Collapse" icon (left chevron) slides the sidebar left to `0px` with a spring transition, leaving a floating menu button at `top-4 left-4`.

### 3.2 Tablet Layout (Convertible System)
- Fits screen widths `768px` to `1024px`.
- Auto-collapses the sidebar into a slide-over panel.
- Primary navigation toggles via a top header menu bar containing icon shortcuts. Swiping from the left edge pulls the full navigation menu out.

### 3.3 Mobile Layout (Bottom Tab Bar System)
- Fits screen widths below `768px`.
- Removes the sidebar.
- Navigation shifts to a fixed bottom Tab Bar.
- **Tab Bar Container**: Height: `64px`. Spans `100vw`. Fixed at `bottom-0`. Styled with Clear Liquid Glass:
  `backdrop-filter: blur(20px)`, `background: rgba(var(--glass-bg))`, with a `1px` border-t `rgba(var(--glass-border))`.
- **Items**: 4 evenly spaced tab buttons:
  1. **Home** (Classrooms)
  2. **Journals** (My Journals)
  3. **Inbox** (Teacher Review Inbox or Student Feedback)
  4. **Profile** (User profile page)
- **Active state**: The icon scales up by 10% and glows with the accent color. Title text is highlighted underneath.

### 3.4 Page Layout Containers
- **Content Canvas**: Spans the remaining width of the screen. Max readable content width is capped at `1100px` for dashboards and `840px` for the visual document editor to ensure comfortable reading lines.
- **Scroll Behavior**: Scrollbars must use customized styling: very thin (`width: 6px`), high border radius (`rounded-full`), and match the background color during rest, appearing slightly darker during scrolling.

---

## 4. Screen Layouts & Component Specifications

### 4.1 Authentication Screens (Login, Register & OTP Verification)

```
+-------------------------------------------------------------+
|                                                             |
|                          eJournal                           |
|                  Academic Document Platform                 |
|                                                             |
|                   +-----------------------+                 |
|                   |  Sign In              |                 |
|                   |                       |                 |
|                   |  Email Address        |                 |
|                   |  [ email@college.edu] |                 |
|                   |                       |                 |
|                   |  Password             |                 |
|                   |  [ •••••••••••••••••] |                 |
|                   |                       |                 |
|                   |  [     Sign In     ]  |                 |
|                   +-----------------------+                 |
|                                                             |
+-------------------------------------------------------------+
```

#### Screen Layout
- **Container**: Centered grid layout (`place-items-center`) with a solid background matching `--background`.
- **Visual Card**: Capped at `420px`. Border-radius: `16px`, padding: `32px`. Resting state uses a clean white/dark gray container border with a light `Shadow Low` to avoid looking heavy.
- **Title Stack**: Center-aligned. Main app logo (minimalist dynamic book/pen icon) styled in the primary color, followed by name "eJournal" and a small description in secondary muted colors.

#### Components
1. **Interactive Inputs**:
   - Label: Font size `12px`, semibold, styled with `muted-foreground`.
   - Field: Height `44px`, border-radius `8px`, border color `--border`. Focus state transitions the border to `--ring` with an outer ring width of `2px` using a spring ease.
2. **Interactive Primary Action Button**:
   - Height `44px`, width `100%`, border-radius `8px`, background `--accent`, text `--accent-foreground`.
   - Hover state: Darkens background by 5% and adds scaling hover effect (`scale-98`).
   - Focus state: Displays a focus ring matching `--ring`.
3. **Interactive Role Selector Toggle**:
   - A segmented control pill matching Apple's design style:
     ```
     [  Student  ] [  Teacher  ]
     ```
   - Features a sliding glass layer behind the active segment that transitions smoothly between options.
4. **Interactive OTP Code Input Group**:
   - Appears during email verification.
   - Consists of 6 independent numerical boxes side-by-side.
   - Typing auto-focuses the next box. Backspacing deletes content and shifts focus backward.

---

### 4.2 Profile Setup (Onboarding System)
- **Onboarding Flow Layout**: Centered card wizard (`max-w-2xl`).
- **Visual Avatar Picker**: Large circle (`120px` diameter) with a dashed border. Hovering displays a camera icon and a "Upload Photo" overlay.
- **Fields**:
  - Student: Full Name, Enrollment Number, Department, Semester, Division, College, University.
  - Teacher: Full Name, Faculty ID, Department, Designation, College, University.
- **Onboarding Navigation Controls**: Primary "Save & Continue" button at bottom right, secondary "Back" button at bottom left.

---

### 4.3 Dashboards (Student & Teacher Views)

```
+-------------------------------------------------------------------------------+
| Sidebar | Subject Dashboards                          [ Notifications ] [Avatar]|
|         | ------------------------------------------------------------------- |
|         | Classrooms                                    [+] Create Classroom  |
|         | +-----------------------------------------------------------------+ |
|         | |  CS401 - Operating Systems                                      | |
|         | |  Semester V | Division A | Teacher: Prof. Miller                | |
|         | |  [ 3 Active Assignments ]                         [ View Class ]| |
|         | +-----------------------------------------------------------------+ |
+-------------------------------------------------------------------------------+
```

#### Student Dashboard
- **Layout**: Top header showing greeting + active notifications bell icon. Bottom section contains a grid of active classrooms.
- **Visual Classroom Card**: Border radius: `12px`, padding: `20px`. Background is `--card`. Features a clean subject code (e.g., `CS401`) text badge in the top-left, followed by classroom title, semester/department details, and a bottom progress strip.
- **Visual Progress Strip**: Visual horizontal bar indicating progress (e.g., `3 of 5 Practicals Completed`). Employs a green color accent for completed items.

#### Teacher Dashboard
- **Layout**: Splits into two columns:
  - Left column: Classroom list with quick action button "Create Classroom" (plus icon).
  - Right column: "Pending Review" inbox feed showing submitted journals awaiting evaluation.
- **Visual Submission Row Component**:
  - Contains the student's avatar image, name, enrollment number, subject, and assignment practical number.
  - Hover state: Displays a light gray background transition, cursor pointer, and shows a quick action button labeled "Start Review".

---

### 4.4 Classroom Screen
- **Screen Layout**: Top section shows a wide classroom banner containing subject name, code, join code badge, and member list count. Below, the page splits into two functional tabs:
  1. **Practicals Catalog**: Listing all published practical tasks.
  2. **Roster**: Showing cards for all enrolled classroom students.
- **Teacher Controls**: Floating action button "New Assignment" in bottom right corner (primary color accent, circles, showing text on hover).
- **Interactive Join Code Badge**: Clicking copies the join code `CS401-7F2A` to the clipboard. Displays a small confirmation badge ("Copied") which fades out after 2 seconds.

---

### 4.5 Visual Block-Based Document Editor

```
+-------------------------------------------------------------------------------+
| [Exit] CS401 Lab Report - Ohm's Law                [Preview] [Export v] [Submit]|
| ----------------------------------------------------------------------------- |
|  [H1] Title: Verification of Ohm's Law                                        |
|  [P]  The objective of this experiment is to verify Ohm's law by measuring    |
|       the current flowing through a resistor for various values of voltage.   |
|                                                                               |
|  [+] [Drag]                                                                   |
|  +-------------------------------------------------------------------------+  |
|  |  [Equation display block]                                               |  |
|  |                             V = I * R                                   |  |
|  +-------------------------------------------------------------------------+  |
+-------------------------------------------------------------------------------+
```

The core editor interface is designed around the block canvas.

#### Screen Layout
- **Editor Canvas**: Capped at `840px` wide. Centered on the page. Margin-top: `64px` to allow for the top bar. Padding-bottom: `200px` to allow typing space.
- **Top Sticky Command Bar**: Height: `56px`. Fixed at `top-0`. Uses Regular Liquid Glass styling:
  `backdrop-filter: blur(24px)`, `background: rgba(var(--glass-bg))`. Displays:
  - Top Left: Exit Editor button, Document Title (inline editable).
  - Top Center: Auto-Save status badge ("Saved • Revision 15 • Synced").
  - Top Right: Preview Toggle, Export dropdown, Primary Action "Submit" button.

#### Components
1. **Interactive Block Canvas Container**:
   - The scroll container holding all active blocks in a vertical stack.
   - Hovering over a block displays a clean control icon strip on its left edge containing:
     - Plus icon (`+`) to insert a block directly below.
     - Six-dot drag handle icon (`⋮⋮`) to drag and drop.
     - Block settings icon (cog).
2. **Visual Block Renderers**:
   - Heading Block: Styled with the serif Academic font, large scale.
   - Paragraph Block: Serif Academic font, line height `1.6`. Supports inline KaTeX math text nodes.
   - Table Block: Minimal grid borders, light gray header fills. Clicking cells allows text input.
   - Image Block: Display box containing the uploaded image. Features an inline caption input at the bottom and circular resizing nodes on the right and left edges when selected.
   - Code Block: Monospace styling, dark gray background with custom language tag indicator in top right.
3. **Interactive Floating Text Formatting Toolbar**:
   - Appears when text is selected inside a paragraph or heading block.
   - Styled with dark Liquid Glass (`backdrop-filter: blur(20px)`, dark background).
   - Contains toggle buttons for: Bold, Italic, Underline, Code formatting, and Inline Equation converter.
4. **Slash Command Popover Menu**:
   - Displays when a student types `/` at the beginning of a blank paragraph block.
   - Height: max `320px`, width: `220px`. Border-radius: `12px`, with a high shadow effect.
   - Lists block types with icons. Use arrow keys to select, enter key to insert.
5. **Interactive Drag-and-Drop Indicator**:
   - Dragging a block displays a clean semi-transparent preview of the block (50% opacity).
   - Places a visual blue horizontal guide line between block boundaries to indicate the drop location.

---

### 4.6 Visual Equation Builder

```
+-------------------------------------------------------------+
| Visual Equation Builder                                 [X] |
| ----------------------------------------------------------- |
| [ Fraction ] [ Square Root ] [ Subscript ] [ Integral ]     |
| [  Summation] [  Matrix  ]   [ Vector    ]                  |
| ----------------------------------------------------------- |
| Canvas:                                                     |
| +---------------------------------------------------------+ |
| |                    [  ]                                 | |
| |               y = ------                                | |
| |                    [  ]                                 | |
| +---------------------------------------------------------+ |
| [Insert Equation]                                           |
+-------------------------------------------------------------+
```

#### Screen Layout
- Opens as a centered, overlay modal window (`width: 680px`). Styled with Regular Liquid Glass.
- Top section shows structural template groups. Center section shows the equation canvas workspace. Bottom section shows the character search bar and action buttons.

#### Components
1. **Interactive Structural Templates**:
   - Grid of buttons representing mathematical templates (Fractions, Roots, Powers, Subscripts, Matrices).
   - Clicking a template (e.g., Fraction) inserts it at the active canvas placeholder, rendering:
     ```
     [  ]
     ----
     [  ]
     ```
2. **Interactive Equation Canvas**:
   - Displays the math layout being built.
   - Placeholders are represented as empty light blue boxes `[ ]` that grow dynamically as content is entered.
   - Clicking a box focuses it, turning the border blue.
   - Pressing Tab shifts focus to the next logical input box.
3. **Scientific Symbol Keyboard Panel**:
   - Side panel containing categorical tabs (Greek, Operators, Relations, Arrows).
   - Clicking a symbol (e.g., `θ`) inserts it at the active cursor position.
4. **Smart Recognition suggestion alert**:
   - Shows a notification at the bottom when a typed string pattern is recognized (e.g., "Press Tab to convert 'pi' to 'π'").

---

### 4.7 Review & Annotation Layer
- **Screen Layout**: Used exclusively by teachers in Review Mode. Displays the student's journal on the left side (`width: 70%`), and a floating review panel on the right side (`width: 30%`).
- **Interactive Review Indicators**:
  - Small, round comment icons hover next to the right edge of each block.
  - Clicking an icon opens a threaded feedback popover anchored to that block ID.
- **Interactive Comment Component**:
  - Displays the teacher's profile avatar, name, timestamp, message, and a resolve button.
  - Hovering displays a edit/delete menu.
  - Active threads show a text input for replies.
- **Interactive Suggestion Card**:
  - Appears inside comments when a correction is proposed.
  - Displays a clean visual representation showing the proposed change:
    - Red strikeout for deleted text.
    - Green underline for inserted suggestions.
  - For students, this card displays two action buttons: "Accept" (applies change, increments revision) and "Reject" (removes suggestion).
- **Interactive Grade Assignment Panel**:
  - Positioned at the bottom of the review sidebar.
  - Contains a numeric input for marks (validated against maximum practical marks) and a final evaluation text area.
  - Action buttons: "Request Changes" (Warning Orange border styling) and "Approve Journal" (Success Green background styling).

---

### 4.8 Version History Panel

```
+-------------------------------------------------------------+
| Version History                                         [X] |
| ----------------------------------------------------------- |
| [x] Compare Revisions:                                      |
| Select A: [ Revision 14 (Current) ]                         |
| Select B: [ Revision 10 (Submitted) ]                       |
| ----------------------------------------------------------- |
| [ Revert to Revision 10 ]                                   |
| ----------------------------------------------------------- |
| Timeline:                                                   |
| - Revision 14: Active Edit (You)                 12 mins ago|
| - Revision 13: Auto-Save                         30 mins ago|
| - Revision 12: Resubmitted                       1 hour ago |
| - Revision 11: Changes Requested (Teacher)       3 hours ago|
+-------------------------------------------------------------+
```

#### Screen Layout
- Slides in from the right edge as a drawer panel (`width: 380px`). Uses Regular Liquid Glass styling.
- Lists the document's revision history chronologically.

#### Components
1. **Interactive Timeline List**:
   - Each item shows revision number, author name, timestamp, and edit type (Auto-Save, Submission, Changes Requested, Restore).
   - Hovering shows a "Preview" button. Clicking loads that revision's reconstructed snapshot in a read-only canvas editor overlay.
2. **Interactive Diff Compare Toggle**:
   - Toggling compares two selected revisions.
   - The editor view switches to a side-by-side comparison screen or highlighted overlay showing additions and deletions.
3. **Interactive Restore Button**:
   - Displayed when previewing a historical version.
   - Styled with a muted borders. Clicking displays a confirmation dialog: "Are you sure you want to restore Revision 10? This will create a new Revision 15."

---

## 5. Interaction States & System Feedback

All components must transition between visual states using the defined design tokens.

### 5.1 Element Interaction States

| Element Type | Resting State | Hover State | Active / Clicked State | Focused State | Disabled State |
|--------------|---------------|-------------|------------------------|---------------|----------------|
| **Primary Button** | Background `--accent`, text `--accent-fg`, opacity `1.0` | Darkens background 5%, scales `scale-98` | Scales `scale-95`, dims background 10% | Ring outline border `2px`, color `--ring` | Background `--muted`, text `--muted-fg`, opacity `0.5`, cursor not-allowed |
| **Secondary Button** | Transparent background, border `--border`, text `--foreground` | Background `--secondary`, border `--border` | Dims background, scales `scale-98` | Ring outline border `2px` | Border `--border`, text `--muted-fg`, opacity `0.5` |
| **Text Input** | Background `--background`, border `--border` | Border `--muted-foreground` | Border `--ring` | Border `--ring`, outer shadow glow | Background `--secondary`, opacity `0.5` |
| **Block Drag Handle** | Hidden by default | Opacity `1.0`, background `--secondary` | Background `--accent`, text `--accent-fg` | Outline border `1px` | Hidden / Unavailable |

### 5.2 System Feedback States

#### Loading States (Skeletons & Spinners)
- **Classroom Cards Loading**: Replaced by skeleton outline containers that pulse between `opacity-50` and `opacity-100` every 1.5 seconds.
- **Document Loading**: Displays a clean, centered loading spinner inside the editor canvas accompanied by a loading caption ("Reconstructing document blocks...").
- **Action In-Progress**: Buttons display a loading spinner inside the label area and toggle to a disabled state during processing.

```
       pulsing skeleton card loader
┌─────────────────────────────────┐
│ [▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒]     │
│ [▒▒▒▒▒▒▒▒▒▒▒▒]                  │
│ [▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒]          │
└─────────────────────────────────┘
```

#### Empty States
- Shown when no data exists (e.g., No Classrooms Joined, No Practicals Published, No Comments Added).
- Styled with a large, centered layout containing:
  - A clean, line-art icon (Lucide) in muted colors.
  - A bold title (size `16px`) and short explanation text (size `14px`).
  - A call-to-action button (e.g., "Join Classroom" or "Create First Block").

#### Error States
- **Form Error**: Red caption text displayed below input fields. Input border color switches to `--destructive`.
- **API Error Notification**: A temporary banner displays at the top of the viewport or floats as a toast notification in the bottom right. Styled with a destructive background accent and a dismiss (`X`) button.
- **Save Sync Conflict (409)**: Modal popup showing: "Save Conflict. Another device updated this document. [ Keep Local ] [ Load Server ]".

#### Success States
- **Journal Submitted / Approved**:
  - Confetti burst animation plays on success.
  - A success toast notification displays briefly in the bottom right corner.
  - The document status badge shifts immediately to "Submitted" or "Approved" (emerald green color styling).

---

## 6. Responsive Breakpoints

The responsive styling uses Tailwind's mobile-first grid conventions.

| Breakpoint | Pixel Width | Navigation System | Layout Adjustments |
|------------|-------------|-------------------|-------------------|
| **Mobile (`sm`)** | `< 768px` | Bottom Tab Bar | Full screen panels. Left margins on canvas removed. Typography scales down (e.g., Title 1 to `24px`). Block toolbar moves to a bottom sticky bar. |
| **Tablet (`md`)** | `768px` to `1024px` | Collapsible Slide-over Sidebar | Two-column grid wraps to single column. Sidebar remains hidden unless toggled. Page margins set to `24px`. |
| **Desktop (`lg`)** | `1024px` to `1440px` | Fixed Left Sidebar | Sidebar visible (`260px`). Main dashboards use two-column layouts. Editor canvas centered with `840px` cap. |
| **Wide Screen (`xl`)**| `> 1440px` | Fixed Left Sidebar | Sidebar visible. Double inspection grids. Review overlays display side-by-side with no overlap. |

---

## 7. Accessibility Regulations

Accessibility is built directly into every component.

### 7.1 Text Legibility & Color Contrast
- Interface text below `18px` must maintain a minimum contrast ratio of **`4.5:1`** against the background.
- Larger text and icons must maintain a minimum contrast ratio of **`3:1`**.
- Focus indicator rings must maintain a minimum contrast ratio of **`3:1`** against their surroundings.
- Never use color as the sole indicator of state. Status indicators must pair colors with icons or labels (e.g., a changes requested status shows a yellow alert icon + "Changes Requested" text).

### 7.2 Scalable Text Support
- Use relative font scaling tokens (`rem`, `em`) instead of absolute values (`px`) inside stylesheets.
- Viewports must allow text sizes to scale up to **200%** without breaking layout alignment or truncating critical label text.
- Horizontal layouts must convert to stacked vertical cards when the viewport is constrained or text scaling exceeds 150%.

### 7.3 Screen Reader Compatibility (ARIA)
- Every image block, avatar picture, and logo icon must define an `alt` or `aria-label` description.
- Interactive controls must specify correct roles (e.g., `role="button"`, `role="tab"`, `role="dialog"`).
- Focused modal dialogues must lock focus within the modal container (`focus-trap`) and expose an `aria-modal="true"` attribute to prevent background navigation.
- Real-time status notifications (such as "Auto-save synced") must use an `aria-live="polite"` zone.

### 7.4 Physical Control Interaction
- Touch targets on mobile screens must be at least **`44px × 44px`**.
- Click targets on desktop interfaces must be at least **`28px × 28px`**.
- Inter-element spacing must exceed `8px` to prevent accidental clicks.
- The block editor, visual formula canvas, and review popovers must be fully navigable using the keyboard:
  - `Tab` / `Shift+Tab` navigates between controls.
  - `Enter` / `Space` activates selected elements.
  - `Arrow Keys` navigate slash command lists and document blocks.
  - `Escape` dismisses open popovers and modal screens.

---

## 8. Animation & Motion Guidelines

Motion must feel lightweight, brief, and physically natural.

### 8.1 Motion Variables
All custom animations use spring curves to mirror physical motion.

```javascript
// Framer Motion Spring Configurations
export const springDefault = {
  type: "spring",
  stiffness: 300,
  damping: 30,
  mass: 1
};

export const springSnappy = {
  type: "spring",
  stiffness: 400,
  damping: 25
};

export const springSmooth = {
  type: "spring",
  stiffness: 200,
  damping: 28
};
```

### 8.2 Standard Visual Transitions
- **Sidebar Collapse / Expand**: Width shifts dynamically over `0.3s` using `springSmooth`. Main content moves synchronously to prevent screen overlap.
- **Modal View Overlay**: Enters by fading in from `opacity-0` to `opacity-100` and scaling up from `scale-95` to `scale-100` over `0.25s` using `springSnappy`.
- **Drawer Panels (Version History / Comments)**: Enters by sliding in from the right edge (`x: "100%"` to `x: 0`) over `0.3s` using `springSmooth`.
- **Block Insertion / Reordering**: Dragged blocks animate to their new coordinates over `0.2s` using `springSnappy`. Newly inserted blocks expand their height from `0` to auto, fading in.
- **Slash Menu / Popover**: Opens by scaling down slightly and fading in (`scale-98`, `y-2` to `scale-100`, `y-0`) over `0.15s` using `springSnappy`.

### 8.3 Reduced Motion Override
To accommodate users with motion sensitivity, animations must honor the system preferences:
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## 9. Performance & Smooth Rendering Guidelines

Smooth web rendering is critical to avoid layout shift (CLS) and input lag (FID) during writing and review.

### 9.1 Block List Virtualization
- When editing or reviewing documents containing more than 50 blocks, the rendering engine must implement list virtualization (e.g., using `react-window` or `@tanstack/react-virtual`).
- Only blocks visible inside the active viewport (plus a buffer of 2 blocks above and below) are mounted to the DOM. Hidden blocks are unmounted and represented as fixed-height spacer layout containers.

### 9.2 CSS Containment for Text Blocks
- Apply the CSS rule `contain: content` to paragraph and equation blocks during rest.
- This ensures that text editing or typing updates inside one block do not trigger full layout recalculation for the entire document canvas.

### 9.3 Dynamic Resource Imports
- Avoid loading heavy rendering libraries on initial page load.
- Dynamically import (`next/dynamic` or dynamic `import()`) the following assets only when they are needed:
  - Lexical / BlockNote editor canvas.
  - KaTeX rendering styles and logic.
  - Excel/CSV export libraries (used on the Gradebook page).
  - Drag-and-drop engines.

### 9.4 Debounced Auto-Save Synchronizations
- Keystrokes must not fire immediate API requests.
- Writing triggers local Zustand state changes.
- The Auto-Save manager must debounce the update API call by **`3 seconds`** of user inactivity.
- Rapid typing pauses server synchronization; pausing starts the background synchronization task.

---

**End of DESIGN.md**
