---
name: react-vite-ui-design
description: Design and implement production-grade, modern, restrained, non-generic web application UI for React 18 + Vite projects while preserving the project's existing architecture, styling system, and product identity.
---

# React 18 + Vite UI Design

## Purpose

Use this skill when designing, redesigning, or implementing user interfaces in a **React 18 + Vite** web application.

The goal is to create UI that feels deliberately designed by an experienced product designer and frontend engineer—not assembled from a generic AI-generated SaaS template.

Optimize for:

- clear information hierarchy
- product-specific character
- useful information density
- restrained visual styling
- predictable interaction patterns
- responsive behavior
- accessibility
- maintainable React code
- consistency with the existing codebase

Do not optimize for visual novelty at the expense of usability.

---

# 1. Operating Principles

## 1.1 Preserve the existing application

Before making UI changes, inspect the project and identify:

- existing component structure
- routing solution
- styling approach
- CSS variables or design tokens
- installed component libraries
- icon library
- form library
- data-fetching patterns
- existing responsive conventions
- existing typography
- existing layout primitives

Prefer extending existing conventions over introducing a parallel system.

Do not:

- migrate away from React 18 or Vite
- replace the existing styling system without a clear requirement
- introduce Tailwind, CSS-in-JS, a UI kit, or another design system only for convenience
- install new packages when the existing stack already solves the problem
- rewrite unrelated components during a visual change

When the project already has a design language, improve it rather than replacing it.

## 1.2 Product UI before decoration

Every screen must have an obvious primary purpose.

Before coding, answer internally:

1. What is the user's primary task on this screen?
2. What information should be noticed first?
3. What action should be easiest to perform?
4. Which information is secondary or contextual?
5. What can be removed without harming the task?

Visual emphasis must follow task importance.

Do not make every section equally prominent.

## 1.3 Avoid generic AI aesthetics

A modern interface is not defined by gradients, glass, huge rounded cards, or excessive animation.

Prefer:

- typography
- spacing
- alignment
- proportion
- hierarchy
- contrast
- meaningful grouping

as the main design tools.

Decoration is secondary.

---

# 2. Required Workflow

Follow this workflow for UI work unless the task explicitly requires a narrower change.

## Step 1 — Inspect

Read the relevant source files before changing them.

Identify:

- page/component ownership
- reusable components already available
- design tokens
- breakpoint conventions
- loading, empty, error, and disabled states
- existing accessibility patterns

Do not guess when the answer exists in the repository.

## Step 2 — Define the visual direction

Before implementation, choose a concise design direction using 2–4 adjectives.

Good examples:

- quiet, technical, precise
- editorial, spacious, understated
- dense, utilitarian, professional
- warm, tactile, restrained
- minimal, architectural, calm

Avoid vague directions such as:

- modern
- beautiful
- premium
- futuristic
- cool

These words alone are not sufficient design guidance.

## Step 3 — Establish hierarchy

Decide:

- primary content region
- secondary navigation or supporting region
- primary action
- secondary actions
- reading order
- density level

Use layout and typography before adding containers or decoration.

## Step 4 — Reuse or define tokens

Use existing design tokens when available.

If the project has no token system, introduce a small semantic token layer rather than scattering arbitrary values.

Prefer semantic names such as:

```css
--color-bg;
--color-surface;
--color-surface-subtle;
--color-text;
--color-text-muted;
--color-border;
--color-accent;
--color-danger;
--radius-sm;
--radius-md;
--space-1;
--space-2;
--space-3;
--shadow-overlay;
```

Do not create a large token system for a small task.

## Step 5 — Implement

Build the smallest maintainable component structure that expresses the design.

Prefer semantic HTML and existing primitives.

## Step 6 — Verify states and breakpoints

Check:

- default
- hover
- focus-visible
- active/selected
- disabled
- loading
- empty
- error
- long content
- narrow viewport
- wide viewport

## Step 7 — Run the anti-slop audit

Perform the audit defined at the end of this skill before completion.

---

# 3. Visual Design Rules

## 3.1 Layout

Prefer layouts driven by content and task flow.

Use:

- clear page regions
- consistent alignment
- intentional whitespace
- readable maximum widths where appropriate
- stable navigation placement
- content density appropriate to the product

Avoid:

- centering everything by default
- wrapping every section in a card
- equal-width three-column grids without a content reason
- excessive empty space inside application screens
- oversized marketing-style heroes inside operational product UI
- layouts where secondary content competes with the primary task

For application UI, useful density is often better than oversized presentation.

### Content width

Do not force every screen into the same max-width container.

Use narrower widths for:

- long-form reading
- settings forms
- focused creation flows

Use wider layouts for:

- data tables
- dashboards
- editors
- timelines
- multi-column workspaces

## 3.2 Spacing

Use a small spacing scale and repeat it consistently.

Prefer relationships such as:

- 4px for very tight internal alignment
- 8px for related controls
- 12–16px for component internals
- 20–24px between related groups
- 32–48px between major sections

These are defaults, not mandatory values. Respect existing project tokens first.

Avoid arbitrary spacing values unless required by layout geometry.

Whitespace should communicate grouping and hierarchy, not simply make the interface look expensive.

## 3.3 Typography

Typography should carry much of the visual hierarchy.

Prefer:

- one primary UI typeface already used by the application
- a restrained type scale
- clear weight differences
- readable line height
- muted metadata rather than tiny text
- tabular numerals where numeric comparison benefits from them

Avoid:

- giant page titles in product screens
- unnecessary uppercase labels
- excessive bold text
- more than 3–4 visually competing text styles on one screen
- decorative gradient text

A typical application hierarchy may use:

- page title: 24–32px
- section title: 16–20px
- body/control text: 14–16px
- metadata/helper text: 12–14px

Follow the existing typography system when present.

## 3.4 Color

Use semantic color intentionally.

Prefer:

- neutral backgrounds
- high-legibility text
- subtle separators
- one primary accent family
- status colors only where status exists

Accent color should primarily indicate:

- actions
- selection
- focus
- current state
- meaningful emphasis

Do not use accent color as ambient decoration across the entire screen.

Avoid blue-purple gradients unless they are explicitly part of the brand.

Never rely on color alone to communicate state.

## 3.5 Borders

Borders are often preferable to shadows for persistent surfaces.

Use subtle borders for:

- section separation
- inputs
- tables
- panels
- selected/active structures where appropriate

Avoid outlining every nested element.

If everything has a border, hierarchy disappears.

## 3.6 Radius

Use restrained corner radii.

Unless an existing design system specifies otherwise:

- small controls: approximately 4–6px
- buttons and inputs: approximately 6–8px
- panels: approximately 8–12px
- circular elements: 50%

Avoid:

- 16–32px radius on every container
- pill shapes for ordinary buttons, inputs, tabs, and badges simultaneously
- mixing many radius sizes without purpose

A pill shape should communicate a specific component type, not serve as the universal default.

## 3.7 Shadows

Persistent layout surfaces should usually be flat.

Reserve shadows primarily for layered UI such as:

- dialogs
- popovers
- dropdown menus
- floating toolbars
- drag previews

Avoid:

- large soft shadows under every card
- colored glow
- neon effects
- layered shadows used only to make the UI appear more "premium"

## 3.8 Cards and panels

A card must represent a meaningful grouped object or isolated surface.

Use cards when they improve comprehension.

Do not use cards merely because content needs spacing.

Before adding a card, ask:

> Would spacing, a heading, a divider, or alignment communicate this grouping more clearly?

Avoid:

- card inside card inside card
- identical rounded cards for every dashboard section
- card grids used as the default solution for unrelated content
- decorative cards containing one icon, one sentence, and no useful interaction

## 3.9 Icons

Reuse the project's existing icon library.

Use icons for:

- recognizable actions
- compact navigation
- status when paired with sufficient context
- reducing repeated text where meaning remains clear

Avoid:

- icons used only to fill empty space
- random icon styles from multiple libraries
- oversized icons above every section title
- sparkles/star icons as a generic indicator of AI features
- emoji as interface icons unless the product language explicitly calls for them

Keep size and stroke weight consistent.

---

# 4. Components and Interaction

## 4.1 Buttons

Buttons must communicate hierarchy.

A typical screen should have a small number of visually primary actions.

Prefer:

- primary action
- secondary action
- quiet/ghost action
- destructive action only when required

Avoid making every button filled or high contrast.

Button labels should describe the action clearly.

Prefer:

- `Save changes`
- `Create project`
- `Invite member`

over vague labels such as:

- `Continue`
- `Submit`
- `Let's go`

when a more precise action is possible.

## 4.2 Forms

Use visible labels for important inputs.

Placeholder text is not a substitute for a label.

Forms should provide:

- clear labels
- reasonable input widths
- helper text only when useful
- inline validation near the relevant field
- disabled/loading submit states
- obvious success or failure feedback

Do not make every input full-width when the data has a naturally short format.

Group related fields spatially.

Do not place unrelated fields in decorative cards.

## 4.3 Tables and data-heavy UI

Use semantic `<table>` markup for actual tabular data.

Prioritize:

- scanability
- aligned columns
- clear headers
- restrained row height
- stable actions
- readable numeric formatting

Do not automatically convert a useful desktop table into a stack of cards on mobile.

Choose responsive behavior according to the data:

- horizontal scrolling
- column prioritization
- expandable rows
- alternate compact layout

Keep critical identifiers visible.

## 4.4 Navigation

Navigation should clearly expose current location.

Use familiar patterns unless there is a strong product reason not to:

- sidebar for broad application navigation
- tabs for sibling views
- breadcrumbs for deep hierarchy
- segmented control for a small number of mutually exclusive modes

Do not use pill tabs everywhere by default.

Do not mix navigation and action controls if they look identical but behave differently.

## 4.5 Dialogs and overlays

Use dialogs only for focused tasks that benefit from temporary context.

Do not put major multi-step workflows into small modals by default.

Dialogs must support:

- keyboard focus management
- Escape where appropriate
- clear title
- clear primary action
- safe destructive confirmation
- scrolling when content exceeds viewport height

Prefer an existing accessible dialog primitive if the project already includes one.

## 4.6 Empty states

Empty states should help the user understand what to do next.

Prefer:

- concise explanation
- one relevant action
- optional lightweight illustration only when consistent with the product

Avoid giant illustrations, motivational copy, or decorative gradients for routine empty states.

## 4.7 Loading states

Use loading UI that preserves layout stability.

Prefer:

- skeletons when structure is known
- localized spinners for small actions
- progress indicators for measurable work

Avoid blocking the entire application for a local update.

## 4.8 Error states

Errors must explain what happened and, when possible, how to recover.

Place errors close to the failed action or affected content.

Avoid generic `Something went wrong` when more useful context is available.

---

# 5. React 18 Implementation Rules

## 5.1 Component boundaries

Create components around meaningful reusable UI or clear responsibilities.

Prefer composition over deeply configurable mega-components.

Do not create a reusable abstraction for a pattern that appears only once unless it materially improves clarity.

Split a component when it contains clearly independent visual or behavioral regions.

Keep page-level components responsible for orchestration, not every implementation detail.

## 5.2 State

Store only actual state.

Do not place derived values in state when they can be calculated from props or existing state.

Prefer:

- local state for local UI behavior
- existing project state solution for shared application state
- URL/search params for state that should be navigable/shareable when appropriate

Avoid adding global state solely to simplify prop passing across a small component tree.

## 5.3 Effects

Use `useEffect` for synchronization with external systems, not as the default place for application logic.

Avoid effects that merely derive one piece of state from another.

Clean up subscriptions, timers, observers, and event listeners.

## 5.4 IDs and labels

Use stable identifiers.

Use React `useId()` when a component needs generated IDs for accessible relationships such as:

- label/input
- helper text/input
- error/input

Do not generate random IDs during rendering.

## 5.5 Lists

Use stable domain identifiers as React keys.

Do not use array indexes as keys when items can be reordered, inserted, or removed.

## 5.6 Memoization

Do not add `useMemo`, `useCallback`, or `memo` automatically.

Use them when:

- the computation is meaningfully expensive
- referential stability matters for an existing API
- profiling identifies a real rendering issue

Prefer readable code over speculative optimization.

## 5.7 Lazy loading

Use route-level or feature-level lazy loading when a dependency or screen is meaningfully heavy and the project architecture supports it.

Do not split tiny components into separate chunks without benefit.

## 5.8 DOM structure

Prefer semantic elements:

- `main`
- `nav`
- `header`
- `section`
- `article`
- `aside`
- `button`
- `form`
- `label`
- `table`

Do not use clickable `div` elements when a native interactive element exists.

Native semantics come before ARIA.

---

# 6. Vite-Specific Implementation Rules

Vite is the build environment, not a visual design system.

Do not introduce visual conventions merely because the project uses Vite.

Follow these implementation rules:

- keep source code within the project's established `src` structure
- use the existing alias configuration instead of inventing new import conventions
- use Vite-compatible asset imports
- use `import.meta.env` for client-exposed Vite environment variables
- never expose secrets in client-side environment variables
- preserve existing dev/build scripts unless the task requires changes
- avoid unnecessary Vite config changes for UI-only work
- respect existing code-splitting and routing setup
- do not add a plugin when standard React/CSS/browser APIs solve the task adequately

If a new asset is required, follow the project's existing convention for `src/assets` versus `public`.

---

# 7. Styling Rules

## 7.1 Respect the current styling approach

Determine whether the project uses:

- plain CSS
- CSS Modules
- Sass
- Tailwind CSS
- CSS-in-JS
- a component library
- another established approach

Use the existing solution.

Do not mix styling paradigms casually.

## 7.2 Avoid one-off magic values

Prefer existing tokens and repeated values.

Use one-off values when they solve genuine geometry or alignment needs—not simply because an AI generated a visually plausible number.

## 7.3 Keep global CSS controlled

Avoid broad selectors that unintentionally affect unrelated screens.

Prefer scoped styles or established application-level primitives.

Global styles should primarily contain:

- reset/base rules
- typography defaults
- tokens
- application-wide theme rules

## 7.4 Responsive CSS

Design from content constraints rather than named device models.

Use existing project breakpoints first.

When introducing a breakpoint, choose it because the layout stops working at that width.

Do not add several near-duplicate breakpoints for small visual differences.

---

# 8. Responsive Design

Every changed screen must remain usable on narrow and wide viewports unless the product explicitly targets one form factor.

Check at minimum:

- narrow mobile-like width
- medium/tablet-like width
- common laptop width
- wide desktop width

Responsive behavior should prioritize content rather than preserve desktop geometry.

Prefer:

- stacking secondary regions
- collapsing nonessential navigation
- allowing controlled horizontal scrolling for dense data
- preserving touch target size
- shortening noncritical labels only when meaning remains clear

Avoid:

- shrinking text excessively
- hiding critical actions
- making dense data unreadable just to avoid horizontal scrolling
- converting every component into a card on mobile

---

# 9. Accessibility

Accessibility is part of visual and interaction quality, not a separate optional pass.

## Required baseline

Ensure:

- semantic HTML
- keyboard operability
- visible `:focus-visible` treatment
- sufficient text/background contrast
- accessible names for controls
- labels for form fields
- descriptive button text or accessible labels for icon-only buttons
- error relationships using appropriate semantics
- logical heading hierarchy
- sensible reading and tab order
- meaningful alt text for informative images
- empty alt text for purely decorative images

Do not remove focus outlines without replacing them with a clearly visible focus treatment.

Do not communicate status only through color.

Respect reduced-motion preferences.

For complex widgets such as comboboxes, dialogs, menus, and listboxes, prefer an accessible primitive already installed in the project rather than recreating behavior incorrectly.

---

# 10. Motion

Motion should explain state change, not decorate the interface.

Prefer short transitions around approximately 120–200ms for common UI interactions unless the existing design system specifies otherwise.

Good uses:

- opacity transition
- small translate transition
- expand/collapse
- overlay entry/exit
- selection feedback

Avoid by default:

- bouncing
- spring-heavy motion
- scale-up hover effects on every card
- animated gradients
- floating decorative blobs
- long entrance animations
- staggered reveals for routine application content

Support `prefers-reduced-motion` when motion is nonessential.

---

# 11. Content and Microcopy

UI copy should sound product-specific and useful.

Prefer concise operational language.

Avoid generic AI/SaaS phrases such as:

- `Supercharge your workflow`
- `Unlock your potential`
- `Seamlessly transform...`
- `Next-generation experience`
- `AI-powered magic`
- `Revolutionize the way you...`

Do not invent fake statistics, testimonials, activity, or user metrics to make a page look complete.

For AI-powered features, describe the actual action or outcome rather than decorating the interface with sparkles and vague AI terminology.

Prefer:

- `Summarize thread`
- `Draft reply`
- `Extract fields`
- `Generate variants`

instead of:

- `AI Magic`
- `Enhance with AI`
- `Smartify`

unless those phrases are part of the established product language.

---

# 12. AI-Generated UI Anti-Patterns

Do not introduce these patterns by default.

## Visual slop

- blue-purple gradients without brand justification
- gradient text
- glassmorphism
- frosted translucent panels
- colored glow around primary controls
- oversized rounded containers
- excessive pill-shaped UI
- large shadowed cards everywhere
- nested cards
- decorative blobs and background orbs
- giant centered hero titles inside an application
- excessive whitespace that reduces usability
- icon-in-circle above every heading
- ornamental grid backgrounds
- fake charts or metrics
- repetitive three-card feature sections

## Interaction slop

- every card animates on hover
- unnecessary scale transitions
- hiding ordinary actions behind novelty interactions
- custom controls where native controls work better
- unclear icon-only actions
- using modals for normal page navigation

## Structural slop

- one card per conceptual sentence
- every page built from the same dashboard template
- identical hierarchy across unrelated sections
- excessive abstraction in React components
- adding dependencies to avoid writing small amounts of straightforward code

## Copy slop

- generic marketing filler
- vague AI terminology
- invented data
- excessive helper text for obvious controls
- headings that do not describe the content beneath them

---

# 13. Product-Specific Character

A UI should not look like it could belong unchanged to 50 unrelated SaaS products.

Introduce product character through meaningful choices such as:

- information density
- domain-specific terminology
- data presentation
- workflow structure
- navigation model
- typography
- restrained accent use
- content-specific layout
- specialized interaction patterns

Do not manufacture uniqueness with random visual effects.

When references are provided, extract principles rather than copying surfaces.

For example:

- reference A for information density
- reference B for typography hierarchy
- reference C for navigation behavior

Do not clone another product's branding or exact interface.

---

# 14. Dependency Policy

Before adding a dependency, check whether the project already contains a suitable solution.

A new dependency is justified only when it provides meaningful value such as:

- difficult accessible interaction primitives
- complex data visualization
- specialized editor behavior
- established project-wide functionality

Do not add a package for:

- a simple button
- a basic tooltip when an existing primitive exists
- trivial layout
- a small animation
- formatting easily handled by built-in APIs

If adding a dependency is necessary, keep it narrowly scoped and avoid changing unrelated architecture.

---

# 15. Completion Requirements

Before considering UI work complete, verify the following.

## Design

- [ ] The primary task is visually obvious.
- [ ] The most important content has the strongest hierarchy.
- [ ] Typography and spacing do most of the visual work.
- [ ] Cards are used only for meaningful grouping.
- [ ] Radius and shadows are restrained.
- [ ] Accent color is purposeful.
- [ ] The screen does not resemble a generic AI-generated SaaS template.
- [ ] The result feels consistent with the rest of the product.

## React

- [ ] Existing components are reused where appropriate.
- [ ] State is not duplicated unnecessarily.
- [ ] Effects are used only for real synchronization needs.
- [ ] Lists use stable keys.
- [ ] Interactive elements use correct semantic HTML.
- [ ] Components have understandable responsibilities.
- [ ] No speculative abstraction or optimization was added.

## Responsive

- [ ] Narrow layouts remain usable.
- [ ] Wide layouts do not become excessively stretched.
- [ ] Critical actions remain accessible.
- [ ] Dense data has an intentional small-screen strategy.
- [ ] No content overlaps or clips unexpectedly.

## Accessibility

- [ ] Keyboard interaction works.
- [ ] Focus is visible.
- [ ] Form controls have labels.
- [ ] Icon-only controls have accessible names.
- [ ] Status is not conveyed through color alone.
- [ ] Heading structure is logical.
- [ ] Motion respects reduced-motion preferences where relevant.

## Code quality

- [ ] Existing project conventions are preserved.
- [ ] No unnecessary dependency was introduced.
- [ ] No unrelated files were rewritten.
- [ ] Styling does not leak globally without reason.
- [ ] Repeated values use existing or appropriate semantic tokens.

---

# 16. Final Anti-Slop Audit

After implementation, review the rendered result and code with the following questions.

Do not merely report problems. Fix them when they are within the requested scope.

## Visual audit

Ask:

1. Could this interface plausibly belong unchanged to dozens of unrelated SaaS products?
2. Did I use a card where spacing or a divider would be better?
3. Are too many elements rounded?
4. Are too many controls pill-shaped?
5. Did I add a gradient, glow, shadow, or animation without a functional reason?
6. Is the page title oversized relative to the actual task?
7. Is there too much empty space for an application screen?
8. Are secondary sections competing visually with primary content?
9. Does every section use the same visual structure?
10. Did I use icons decoratively rather than functionally?
11. Is the accent color overused?
12. Does the interface communicate hierarchy without decoration?

## Interaction audit

Ask:

1. Are the primary and secondary actions obvious?
2. Can the screen be used with a keyboard?
3. Are hover effects subtle and meaningful?
4. Are loading, empty, error, and disabled states accounted for?
5. Does responsive behavior preserve the user's main task?
6. Are native browser semantics being replaced unnecessarily?

## React audit

Ask:

1. Did I create state that could be derived?
2. Did I add effects that are not synchronizing with an external system?
3. Did I introduce abstractions before they were needed?
4. Did I add a package unnecessarily?
5. Did I preserve the project's established patterns?
6. Is the component structure simpler after the change rather than more complicated?

If any answer reveals generic, decorative, inaccessible, or unnecessary implementation, revise before completion.

---

# 17. Default Decision Rule

When several designs are equally valid, choose the one that is:

1. easier to understand
2. easier to operate
3. more consistent with the existing product
4. less visually noisy
5. easier to maintain

Prefer deliberate restraint over decorative novelty.
