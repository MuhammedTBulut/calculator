> **Status: informal session log, not reproducible evidence.** This is a
> working record of interactive QA passes run during development; the image
> paths under `/tmp/` existed only on the machine that produced them and are
> not part of this repository. For evidence anyone can regenerate —
> screenshots captured by tests that assert the state first — see
> [`docs/visual-evidence.md`](docs/visual-evidence.md) and
> `frontend/e2e/visual-evidence.spec.ts`. This file is kept for the reasoning
> trail: what was compared, what was found, and why each fix was made.

**Comparison Target**

- Source visual truths: conversation attachments `cropped-result-right-edge.png` (563 × 378 px) and `scientific-overflow-reference.png` (944 × 2048 px).
- Latest implementation screenshot: `/tmp/sezzle-scientific-qa/mobile.png` (538 × 900 px), 538 CSS px viewport, device scale factor 1, light theme, `9 × 10^18` completed-result state.
- Earlier implementation screenshot: `/tmp/sezzle-qa-right-safe/mobile.png` (538 × 900 px), empty-result state.
- Density normalization: source and implementation were reviewed at 1×. The current source is a taller native-calculator reference, while the implementation is the existing responsive web composition; the comparison target is the scientific-notation result behavior and its focused display region rather than full-page cloning.
- Primary interaction tested: pressed `9`, multiply, `1`, `0`, power, `1`, `8`, and equals against the live backend; the rendered result was `9e18` with no alert.
- Console check: Chrome DevTools Protocol reported no runtime exceptions during the completed calculation.

**Findings**

- Earlier [P1] Completed results could overflow instead of compacting.
  - Evidence: the source reference compacts an oversized `900… × 10` result to `9e18`; the previous implementation retained the parser-compatible full decimal string in the visual readout.
  - Impact: large results required horizontal scrolling and lost the instant legibility expected from a calculator.
  - Fix: measure the completed result against the live readout width and switch only the visual value to seven-significant-digit scientific notation when it does not fit. The full decimal value remains in calculator state for subsequent operations and is exposed through `aria-description`.
  - Post-fix evidence: `/tmp/sezzle-scientific-qa/mobile.png` shows the previous expression above a right-aligned `9e18` result with no clipping or overflow.

- Earlier [P1] Result glyph clipped at the lower edge.
  - Evidence: the source crop shows the lower curve of `0` cut by the readout's line box. The pre-fix CSS combined `line-height: 0.92` with a vertically scrollable overflow context.
  - Fix: increased the numeric line box to `1.04`, added explicit lower glyph padding, increased the readout minimum height, and prevented vertical overflow from creating a clipping viewport.
- Post-fix evidence: the focused display region in `/tmp/sezzle-qa.6ChPCG/mobile.png` shows the complete lower curve of `0` with clear space below it.

- Earlier [P1] Result glyph still felt visually clipped on the right.
  - Evidence: follow-up user capture showed that negative tracking reduced the final glyph's optical safety area even though the display card itself had outer padding.
  - Fix: removed negative tracking from submitted results, reduced it for expressions, and added up to 24 px of internal end padding plus matching scroll padding.
  - Post-fix evidence: `/tmp/sezzle-qa-right-safe/mobile.png` shows a complete result glyph with a clearly separated right-side safety area.

- Earlier [P2] Key content depended on browser-native button alignment.
  - Evidence: text and SVG controls used different intrinsic baselines, which could make otherwise centered content appear vertically inconsistent.
  - Fix: every calculator key now uses a shared grid centering rule with `place-items: center`; SVGs use block layout and inherit the same geometric center.
  - Post-fix evidence: the AC label, backspace SVG, percent sign, operators, digits, decimal point, and equals sign share consistent horizontal and vertical centers in `/tmp/sezzle-qa.6ChPCG/mobile.png`.

**Required Fidelity Surfaces**

- Fonts and typography: scientific notation uses the existing result typeface, optical weight, scale, line height, and tabular-number treatment; full results retain their safe glyph padding.
- Spacing and layout rhythm: the compact value remains right-aligned within the existing result bounds; display and key positions are preserved.
- Colors and visual tokens: unchanged.
- Image quality and asset fidelity: no raster assets are involved in the affected region; the backspace control remains the existing Phosphor vector icon.
- Copy and content: unchanged.
- Full-view evidence: the responsive calculator composition remains stable in `/tmp/sezzle-scientific-qa/mobile.png`; no controls overlap or clip at the captured viewport.
- Focused-region evidence: the display contains `9*10^18 =` and the compact `9e18` result, matching the behavior requested by the source reference.

**Comparison History**

- Pass 1: identified clipped result glyph (P1) and inconsistent intrinsic key alignment (P2) from the supplied crop and pre-fix CSS.
- Fix: added readout line-box safety space and a single geometric centering rule for all key content.
- Pass 2: captured the revised light-theme mobile implementation; the lower-edge clipping was resolved, but user review identified insufficient optical safety on the right.
- Pass 3: removed submitted-result tracking and added a dedicated right-side safety area; the revised capture shows no contact or apparent clipping at the glyph edge.
- Pass 4: added width-aware scientific notation, executed `9 × 10^18` through the live UI/backend path, and captured the resulting `9e18` state without runtime exceptions.

**Implementation Checklist**

- [x] Preserve the full lower curve of large result digits.
- [x] Preserve the complete right edge of the final result glyph.
- [x] Convert only completed results that exceed the available width to scientific notation.
- [x] Keep the full decimal value available for continued calculations and assistive context.
- [x] Center text and icon content with the same layout model.
- [x] Preserve responsive key sizing and the Sezzle display signature.

**Follow-up Polish**

- None required for the reported issue.

final result: passed

---

## Responsive Readout Typography QA — 2026-07-22

**Comparison Target**

- Source visual truth: current conversation attachment (698 × 266 px focused `99999` result surface). The attachment has no filesystem path.
- Primary implementation screenshots: `/tmp/sezzle-readout-density-qa/375x812-regular-5-dark.png`, `/tmp/sezzle-readout-density-qa/375x812-compact-9-dark.png`, `/tmp/sezzle-readout-density-qa/375x812-dense-14-dark.png`, and `/tmp/sezzle-readout-density-qa/375x812-ultra-19-dark.png`.
- Responsive implementation screenshots: `/tmp/sezzle-readout-density-qa/320x568-ultra-19-dark.png`, `/tmp/sezzle-readout-density-qa/475x631-regular-5-dark.png`, and `/tmp/sezzle-readout-density-qa/475x631-ultra-19-dark.png`.
- Viewports and density: 375 × 812, 320 × 568, and 475 × 631 CSS px at device scale factor 1; dark input state.

**Findings**

- No actionable P0/P1/P2 issue remains.
- The readout now scales from its own result-surface container rather than the browser viewport, so the number stays proportional to the calculator.
- Visible content moves through regular, compact, dense, and ultra density levels as character count increases.

**Required Fidelity Surfaces**

- Fonts and typography: `99999` renders at 47.36 px in the 375 px portrait implementation instead of retaining the oversized legacy scale. Nine, fourteen, and nineteen characters render at 39.96 px, 34.04 px, and 22.94 px respectively.
- Spacing and layout rhythm: right alignment, baseline, panel padding, scroll affordance, and result-panel height remain unchanged. The typography adapts inside that stable geometry.
- Colors and tokens: display ink, muted expression, dark/light theme contrast, and the four-color signature line are unchanged.
- Image quality and asset fidelity: no image or icon asset changed; typography remains browser-rendered and sharp at every tested size.
- Copy and content: numeric and mathematical content remains exact; the density system changes presentation only.

**Full-view and Focused Evidence**

- Full-view comparison: the 375 × 812 `99999` capture preserves the calculator composition while reducing the readout to a balanced proportion of the black panel.
- Focused comparison: computed typography moves through four explicit density states and every sampled value remains right-aligned without clipping.
- Responsive evidence: nineteen digits fit at 16.8 px in the 320 × 568 display, 22.94 px at 375 × 812, and 32.47 px in the wider 475 × 631 display.

**Interaction, Architecture, and Runtime Checks**

- Keyboard entry was used to exercise 5, 9, 14, and 19-character states.
- `Display` derives only a presentational density label; calculator expression state and evaluation behavior are unchanged.
- Completed oversized results retain the existing measured scientific-notation fallback.
- Console/runtime exceptions: 0.
- Automated verification: 47 tests passed; lint passed; production build passed.

**Comparison History**

- Pass 1 [P2]: readout size used viewport units, leaving `99999` visually oversized relative to the resized calculator. Fix: introduce result-surface container units and four content-density levels.
- Pass 2 [P2]: nineteen digits fit at 375 × 812 but overflowed the 320 × 568 readout by 25 px. Fix: activate ultra density from sixteen characters and allow its minimum size to follow the narrow container.
- Pass 3: all sampled values fit at 320, 375, and 475 px widths with no runtime errors or layout regression.

**Implementation Checklist**

- [x] Reduce the default readout scale.
- [x] Tie typography to the result panel rather than the viewport.
- [x] Add stepped shrinking for longer expressions.
- [x] Preserve scientific notation for oversized completed results.
- [x] Verify narrow portrait, standard portrait, and constrained wide layouts.

final result: passed

---

## Coupled Responsive Geometry and Native iOS QA — 2026-07-22

**Source and Normalization**

- Source visual truth: current conversation attachment showing the broken short-portrait state (950 × 1262 px, dark theme). The chat attachment is rendered inline and has no filesystem path exposed to the workspace.
- Matched web implementation: `/tmp/sezzle-cdp-responsive-qa/475x631-dark.png` at 475 × 631 CSS px, device scale factor 2, producing the same 950 × 1262 pixel dimensions.
- Native implementation: `/tmp/sezzle-ios-qa/04-native-responsive.png`, `/tmp/sezzle-ios-qa/07-native-result-pass.png`, and `/tmp/sezzle-ios-qa/08-native-dark.png` at 402 × 874 CSS px, device scale factor 3, producing 1206 × 2622 px iPhone 17 Pro captures.
- Additional web evidence: `/tmp/sezzle-cdp-responsive-qa/320x568-light.png`, `/tmp/sezzle-cdp-responsive-qa/402x874-light.png`, `/tmp/sezzle-cdp-responsive-qa/844x390-light.png`, and `/tmp/sezzle-cdp-responsive-qa/1440x900-light.png`.

**Findings**

- [P1] The broken source state allowed a wide calculator/display shell to surround a separately capped 250 px keypad.
  - Fix: short portrait now derives the calculator width from a height-led keypad width; short or squarer canvases use a 6 × 4 full-width composition selected by height and aspect ratio.
  - Post-fix evidence: at 475 × 631 the calculator is 444 px wide, screen and keypad are both 430 px wide, all 24 keys remain inside the calculator, and horizontal overflow is false.
- [P1] The first native pass placed the final key row too close to the iPhone home indicator.
  - Fix: add `viewport-fit=cover`, four-direction `safe-area-inset-*` padding, disable duplicate native scroll insets, and extend the compact portrait contract through 900 px available height.
  - Post-fix evidence: at 402 × 874 the calculator ends at y=719, the 24-key keypad ends at y=708, and the history begins below it; the Dynamic Island and home-indicator regions do not cover calculator controls.
- [P1] The first native submit reached the UI but was rejected by the WebView CORS boundary.
  - Fix: use Capacitor's native HTTP bridge for the iOS target instead of weakening the backend's exact-origin CORS allowlist.
  - Post-fix evidence: the simulator interaction `8 ÷ 2 =` returned `4` and added one history item.

**Required Fidelity Surfaces**

- Fonts and typography: SF-compatible system typography, numeric weights, truncation, and expression/result hierarchy are unchanged across web and native captures.
- Spacing and layout rhythm: screen and keypad share an exact inner width in every height/aspect-constrained capture; portrait retains circular controls, constrained canvases use capsule controls, and all 24 actions remain present.
- Colors and tokens: light and dark native captures preserve the black result surface, Sezzle signature line, neutral key hierarchy, and `#FEA500` operator rail.
- Image quality and asset fidelity: supplied Sezzle vector logos and Phosphor icons remain sharp at 2× and 3× densities; no placeholder or custom-drawn replacement was introduced.
- Copy and content: product title, calculator labels, status messages, and history content are unchanged; the native error/retry state was exercised before the HTTP bridge fix.

**Full-view and Focused Comparison Evidence**

- Full-view: the matched 475 × 631 capture replaces the broken narrow keypad/wide shell with one edge-aligned 6 × 4 instrument; the iPhone 17 Pro captures keep the full calculator above History in both themes.
- Focused: DOM measurements show exact screen/keypad width equality at 320 × 568, 402 × 874, 475 × 631, 844 × 390, and desktop verification sizes. Every key bounding box remains inside the calculator shell.
- Responsive matrix: 320 × 568, 402 × 874, 475 × 631 @2×, 844 × 390, and 1440 × 900 all report 24 keys and no horizontal document overflow.

**Interaction, Accessibility, and Runtime Checks**

- Native pointer sequence: `8`, divide, `2`, equals produced the result `4` against the live Go backend.
- Theme switch: light and dark native states rendered correctly and retained safe-area spacing.
- Native accessibility automation exposed the Capacitor application root and reported one non-critical generic root-trait warning; it did not enumerate WKWebView descendants, so full VoiceOver behavior remains a release-device verification gap. DOM semantics and keyboard behavior remain covered by frontend tests.
- Native build: Xcode 26.6, iOS Simulator 26.5 SDK, iPhone 17 Pro target, `BUILD SUCCEEDED`.
- Automated verification: 43 frontend tests passed; frontend lint passed; production and iOS Vite builds passed; all Go tests passed; `git diff --check` passed.

**Comparison History**

- Pass 1: recorded the source's independent 250 px keypad cap as a P1 geometry failure.
- Pass 2: coupled keypad and calculator geometry; browser measurements passed, while native capture revealed the home-indicator proximity issue.
- Pass 3: added native safe-area ownership and the 900 px compact portrait range; the visual layout passed, while submit exposed the WebView CORS boundary.
- Pass 4: enabled the native HTTP bridge without widening CORS; `8 ÷ 2 = 4`, light/dark, native build, and responsive matrix passed with no remaining P0/P1/P2 finding.

**Implementation Checklist**

- [x] Couple key size, keypad width, display width, and calculator width.
- [x] Select compact composition by available geometry rather than device name.
- [x] Preserve all 24 controls in portrait and constrained layouts.
- [x] Add iOS safe-area ownership without double insetting.
- [x] Keep the backend CORS policy narrow while enabling native requests.
- [x] Build, install, launch, interact with, and visually verify iPhone 17 Pro Simulator.

final result: passed

---

## Compact Viewport Cohesion QA — 2026-07-22

**Comparison Target**

- Source visual truth: current conversation attachment (950 × 1262 px, dark theme) showing the failed wide-shell/narrow-keypad state, together with the user's previously supplied Apple landscape reference for the intended wide-key behavior. The conversation attachment has no filesystem path.
- Primary implementation screenshot: `/tmp/sezzle-compact-responsive-qa/475x631-reported.png`.
- Supporting implementation screenshots: `/tmp/sezzle-compact-responsive-qa/320x568-compact.png`, `/tmp/sezzle-compact-responsive-qa/375x667-compact.png`, `/tmp/sezzle-compact-responsive-qa/375x768-compact.png`, `/tmp/sezzle-compact-responsive-qa/424x500-short.png`, `/tmp/sezzle-compact-responsive-qa/568x320-landscape.png`, `/tmp/sezzle-compact-responsive-qa/375x812-portrait.png`, and `/tmp/sezzle-compact-responsive-qa/1024x768-tablet.png`.
- Normalization: the 950 × 1262 source has a 0.7528 aspect ratio; the primary implementation uses the equivalent 475 × 631 CSS viewport at device scale factor 1. Both show the dark idle state.

**Findings**

- No actionable P0/P1/P2 issue remains.
- The reported viewport now uses the aspect-aware 6 × 4 composition: calculator, display, and keypad share the available width rather than leaving the keypad isolated in the middle of a wide card.
- Tall phone proportions remain 4 × 6; their key diameter is derived from available height and the calculator shell is derived from that same keypad width.

**Required Fidelity Surfaces**

- Fonts and typography: existing type family, optical weights, numeric scale, and operator hierarchy are unchanged; compact layouts only adjust available geometry.
- Spacing and layout rhythm: the primary 475 × 631 view measures 459 px for the calculator and 445 px for both display and keypad, producing a 0 px display/keypad width delta. Portrait checks at 320 × 568, 375 × 667, 375 × 768, and 375 × 812 also produce a 0 px delta.
- Colors and tokens: the black dark-mode canvas, graphite digits, pale functions, Sezzle orange operators, borders, and four-color display signature remain unchanged.
- Image quality and asset fidelity: the supplied Sezzle logo files and Phosphor icons remain vector-sharp; no replacement artwork or code-drawn icon was introduced.
- Copy and content: all 24 controls and their accessible names remain present in both 4 × 6 and 6 × 4 compositions.

**Full-view and Focused Evidence**

- Full-view comparison: the source's large empty gutters between its keypad and shell are removed. At the equivalent aspect ratio, wide capsule keys now fill the calculator's inner grid and history follows below without affecting the calculator fit.
- Focused comparison: measured display and keypad bounds are both x=15, width=445 px in the primary viewport; all 24 keys remain inside the 459 px calculator shell.
- Responsive evidence: all eight tested viewports have no horizontal overflow, a fitting header, a calculator within the viewport, and 24 keys inside the calculator.

**Interaction, Runtime, and Automated Checks**

- Primary interaction: `8 / 2 =` produced `4` at 475 × 631.
- Console/runtime exceptions across the matrix: 0.
- Automated verification: 42 tests passed; lint passed; production build passed.

**Comparison History**

- Pass 1 [P1]: the source exposed a wide calculator/display surrounding a 250 px keypad. Fix: replace the isolated keypad cap with a shared compact geometry contract.
- Pass 2 [P2]: the first shared-width portrait solution was cohesive but underused width at the squarer 475 × 631 ratio. Fix: add an aspect-aware 6 × 4 composition for constrained split-screen and zoom states.
- Pass 3 [P1]: the aspect rule initially inherited the portrait keypad width, leaving a 187.34 px display/keypad delta. Fix: explicitly reset both calculator and keypad to 100% width in the later constrained-layout rule.
- Pass 4: the primary viewport reached a 0 px width delta, preserved all controls, passed the interaction check, and introduced no P0/P1/P2 regression across the supporting matrix.

**Implementation Checklist**

- [x] Remove the isolated 250 px keypad behavior.
- [x] Couple portrait key size, keypad width, display width, and shell width.
- [x] Switch squarer constrained canvases to the existing 6 × 4 wide-key system.
- [x] Preserve standard portrait, landscape, tablet, and desktop behavior.
- [x] Verify geometry, interaction, runtime, tests, lint, and production build.

final result: passed

---

## Responsive Geometry System QA — 2026-07-22

**Comparison Target**

- Source visual truth: latest conversation attachment (2048 × 944 px Apple Calculator landscape), plus the previously supplied portrait calculator references.
- Implementation evidence: `/tmp/sezzle-responsive-integrity-qa/320x480-height-constrained.png`, `/tmp/sezzle-responsive-integrity-qa/375x812-phone-portrait.png`, `/tmp/sezzle-responsive-integrity-qa/568x320-small-landscape.png`, `/tmp/sezzle-responsive-integrity-qa/844x390-reference-landscape.png`, `/tmp/sezzle-responsive-integrity-qa/1024x768-tablet-landscape.png`, and `/tmp/sezzle-responsive-integrity-qa/1440x900-desktop.png`.
- State coverage: idle light theme at every size and an `8/2 = 4` interaction result at 568 × 320.

**Findings and Structural Fixes**

- Earlier [P1] compact-landscape rules compressed the portrait grid without preserving the relationship between display, calculator shell, and keypad.
  - Fix: introduce a height-constrained 6 × 4 layout with wide capsule keys. It keeps all 24 controls visible, gives each row one shared rhythm, and allows the calculator to fit above the fold.
- Earlier [P2] keypad-only maximum widths made the display appear wider than the controls at some breakpoints.
  - Fix: make the calculator shell the geometry owner. Display and keypad now consume the same inner width; the shell uses one portrait width token and switches as a unit in height-constrained layouts.
- During verification [P1], the first orientation-only landscape condition missed a 424 × 500 short viewport.
  - Fix: base the compact composition on available height (`max-height: 520px`) and bound key height by both viewport axes. This covers short portrait, split-screen, and landscape cases without relying on device names.

**Required Fidelity Surfaces**

- Fonts and typography: existing numeric and operator typography is preserved; responsive modes change available geometry rather than distorting glyphs.
- Spacing and layout rhythm: portrait keeps a 4-column circular grid; height-constrained screens use a 6-column capsule grid. Screen and keypad width deltas are 0 px at all short-layout test sizes.
- Colors and tokens: Sezzle orange, light/dark surfaces, display signature line, focus, hover, and pressed-state colors are unchanged.
- Image quality and asset fidelity: existing vector logo and Phosphor icons remain sharp at every tested scale.
- Copy and content: all 24 calculator functions and their accessible names remain available in both layouts.

**Responsive Matrix**

- Verified viewports: 320 × 480, 320 × 568, 375 × 812, 424 × 500, 568 × 320, 844 × 390, 932 × 430, 768 × 1024, 1024 × 768, 1366 × 768, 1440 × 900, and 2560 × 1440.
- No horizontal overflow was detected in any viewport.
- Header and calculator bounds stayed inside every viewport; all 24 keys stayed inside the calculator shell.
- Portrait: circular touch targets and the established Apple-inspired hierarchy remain intact.
- Height constrained: wide capsules reproduce the reference's landscape density while keeping the result panel and keypad visually unified.
- Tablet/desktop: calculator and history remain balanced columns; display and keypad share the same center axis.

**Interaction, Runtime, and Automated Checks**

- Pointer interaction: `8 / 2 =` produced `4` in the 568 × 320 layout.
- Keyboard, active-key feedback, theme switching, history, and expression behavior remain on the same component and hook boundaries.
- Console/runtime exceptions during the responsive matrix: 0.
- Automated verification: 42 tests passed; lint passed; production build passed.

**Comparison History**

- Pass 1: isolated keypad width caps created mismatched panel geometry.
- Pass 2: calculator-owned width aligned the display and keypad but the orientation-only condition missed short portrait/split-screen cases.
- Pass 3: height-driven composition plus dual-axis key sizing passed the complete viewport matrix without a P0/P1/P2 regression.

**Implementation Checklist**

- [x] Couple calculator shell, display, and keypad geometry.
- [x] Preserve every calculator action in compact landscape.
- [x] Support short portrait, landscape, tablet, desktop, and wide desktop.
- [x] Keep touch targets, content hierarchy, and existing interaction architecture intact.
- [x] Verify interaction, overflow, runtime, tests, lint, and production build.

final result: passed

## Compact Theme Switch QA — 2026-07-22

**Comparison Target**

- Source visual truth: latest conversation attachment showing the oversized two-state theme switch.
- Implementation evidence: `/tmp/sezzle-theme-switch-small-qa/320x568-light.png`, `/tmp/sezzle-theme-switch-small-qa/320x568-dark.png`, `/tmp/sezzle-theme-switch-small-qa/568x320-light.png`, and `/tmp/sezzle-theme-switch-small-qa/1024x768-light.png`.
- Captures use CSS viewport pixels at device scale factor 1; light and dark states were both inspected.

**Findings and Fix**

- Earlier [P2] The 181 × 44 px switch carried too much horizontal visual weight in the header.
  - Fix: reduced the switch to 132 × 44 px and reduced the Sun/Moon icons from 21/20 px to 19/18 px. The 44 px interaction height remains unchanged.
  - Post-fix evidence: the 320 px capture keeps the complete `Sezzle | Calculator` lockup, a 20 px gap before the switch, and the full calculator above the fold.

**Required Fidelity Surfaces**

- Typography and copy: unchanged; no truncation at 320 px.
- Spacing and layout: the switch is 27% narrower while header and calculator bounds remain unchanged.
- Colors and tokens: unchanged in both themes.
- Icon fidelity: existing Phosphor Sun and Moon icons retained at reduced sizes.
- Responsive behavior: passed at 320 × 568, 424 × 500, 568 × 320, and 1024 × 768 with no horizontal overflow.

**Comparison History**

- Pass 1: oversized switch identified from user feedback.
- Pass 2: 132 px implementation captured in light/dark and portrait/landscape states; no P0/P1/P2 issue remains.

final result: passed

---

## Responsive Reflow Audit — 2026-07-22

**Scope**

- Header, calculator, display, keypad, theme control, and history panel.
- Portrait, landscape, tablet, laptop, desktop, light/dark themes, empty/result/warning states.
- Accepted captures: `/tmp/sezzle-responsive-final/01-mobile-portrait.png` through `/tmp/sezzle-responsive-final/07-dark-landscape-warning.png`.

**Verified Viewports**

| Viewport | Layout | Result |
| --- | --- | --- |
| 320 × 568 | Compact portrait, 6 keypad rows | Pass — header and calculator fit; 52 px minimum keys |
| 375 × 667 | Compact portrait | Pass — no horizontal overflow |
| 424 × 500 | Short/split viewport boundary | Pass — 44.375 px minimum keys |
| 480 × 320 | Short landscape, 8 keypad columns | Pass — complete calculator fits |
| 568 × 320 | Short landscape | Pass — empty, warning, and long-result states fit |
| 667 × 375 | Short landscape | Pass — complete calculator fits |
| 812 × 375 | Split/tablet landscape | Pass — complete calculator fits |
| 932 × 430 | Wide landscape with side history | Pass — calculator and history fit |
| 768 × 1024 | Tablet portrait | Pass — single-column reflow |
| 1024 × 768 | Laptop/tablet landscape | Pass — two-column layout fits |
| 1366 × 768 | Laptop | Pass — no clipping or overflow |
| 1440 × 900 | Desktop | Pass |
| 2560 × 1440 | Wide desktop | Pass — ergonomic max-width retained |

**Findings and Fixes**

- [P1] Short landscape and split-screen windows previously showed only the first keypad row. The keypad now reflows from 4 × 6 to 8 × 3, preserving semantic DOM order and 44–58 px targets.
- [P1] Completed results increased the compact landscape display height. The previous expression is now positioned independently and readout padding is height-safe; long results remain fully visible in scientific notation.
- [P2] Long history values could compete for horizontal space. History results now truncate safely, while the calculator keeps the complete value in state.
- [P2] The header could become fragile under narrow reflow. The brand lockup can shrink and ellipsize, while the 44 px theme control never collapses.
- [P2] Landscape history could extend below short wide screens. Its height now follows the dynamic viewport and its content scrolls internally when required.

**Evidence Limits**

- Visual captures confirm reflow, clipping, target dimensions, and visible state behavior; they do not by themselves prove full WCAG compliance or screen-reader behavior.
- Keyboard behavior and semantic component tests are covered by the automated suite; physical-device safe-area behavior should still be checked during release-device QA.

final responsive result: passed

---

## Theme Switch Design QA — 2026-07-22

**Comparison Target**

- Source visual truth: conversation attachment `theme-toggle-reference.png` (156 × 128 px crop), showing the approved moon icon scale, circular selected surface, thin border, and soft neutral elevation.
- Implementation evidence: `/tmp/sezzle-theme-switch-qa/320x568-light-accepted.png`, `/tmp/sezzle-theme-switch-qa/320x568-dark-final.png`, `/tmp/sezzle-theme-switch-qa/568x320-light-final.png`, and `/tmp/sezzle-theme-switch-qa/1024x768-light-final.png`.
- Density normalization: source crop and implementation captures reviewed at 1×; the source is a focused control crop, so fidelity is judged on icon, selected surface, border, elevation, and tone rather than full-view proportions.
- Primary interaction tested: the switch was focused and activated; `aria-checked` changed from `false` to `true`, the thumb travelled 65 px at 320 px viewport width, the persisted theme changed to dark, and no console warning or runtime exception was recorded.

**Findings**

- Earlier [P1] Height media queries forced the new switch back to a 44 px circle.
  - Evidence: the first implementation capture measured the brand lockup at 140–181 px while the switch stayed 44 px wide.
  - Fix: height-specific queries now change only control height; the shared responsive width remains active.
  - Post-fix evidence: the brand lockup and switch both measure 140 px at 320 × 568 and 181 px at 424 × 500, 568 × 320, and 1024 × 768.
- Earlier [P2] The `Calculator` label truncated at the 320 px boundary.
  - Evidence: the first 320 px capture displayed `Calcula…`.
  - Fix: the mobile logo and internal lockup gap were reduced without changing the shared outer width.
  - Post-fix evidence: `/tmp/sezzle-theme-switch-qa/320x568-light-accepted.png` shows the complete `Sezzle | Calculator` lockup and equal-length switch without horizontal overflow.

**Required Fidelity Surfaces**

- Fonts and typography: existing Sezzle lockup typography is preserved; no new UI copy was introduced into the minimal control.
- Spacing and layout rhythm: brand and switch share the same responsive outer width, with a 12 px minimum separation at 320 px.
- Colors and tokens: the control uses the existing surface, muted-surface, line, ink, and shadow tokens in both themes.
- Image/icon fidelity: the reference moon is represented by the existing Phosphor Moon icon; the Sun icon comes from the same library and weight system. No custom SVG or CSS-drawn icon was added.
- Copy and content: the visible interface remains icon-only; the semantic name is `Dark mode` and the checked state communicates the current value.

**Responsive Evidence**

- 320 × 568: 140 px brand and switch, complete label, calculator still fits vertically, no horizontal overflow.
- 424 × 500: 181 px brand and switch, short-window 8 × 3 keypad reflow remains intact.
- 568 × 320: 181 px brand and switch, full compact landscape calculator remains visible.
- 1024 × 768: 181 px brand and switch, two-column calculator/history layout remains intact.

**Comparison History**

- Pass 1: identified the width override (P1) and mobile label truncation (P2).
- Pass 2: removed the width overrides and reduced only the mobile lockup internals; equal widths and complete copy were confirmed across all target viewports.

**Implementation Checklist**

- [x] Use real switch semantics and expose checked state.
- [x] Match the brand lockup width responsively.
- [x] Preserve a 44 px control height and keyboard focus.
- [x] Preserve the complete 320 px header and calculator layout.
- [x] Verify light/dark visual states and persistence.

final result: passed

---

## Theme Switch Size Revision 2 — 2026-07-22

**Comparison Target**

- Source truth: latest user direction to reduce the already compacted switch one additional step.
- Implementation evidence: `/tmp/sezzle-theme-switch-smaller-qa/320x568-light.png`, `/tmp/sezzle-theme-switch-smaller-qa/320x568-dark.png`, `/tmp/sezzle-theme-switch-smaller-qa/568x320-light.png`, and `/tmp/sezzle-theme-switch-smaller-qa/1024x768-light.png`.
- Captures use CSS viewport pixels at device scale factor 1.

**Finding and Fix**

- Earlier [P3] The 132 px switch still carried more header weight than requested.
  - Fix: reduced width to 116 px and icon sizes to 18/17 px while preserving the 44 px interaction height.
  - Post-fix: complete header copy remains visible; calculator bounds and responsive breakpoints are unchanged.

**Fidelity and Responsive Checks**

- Typography/copy: unchanged and untruncated.
- Spacing/layout: passed at 320 × 568, 568 × 320, and 1024 × 768.
- Colors/tokens: unchanged in light and dark themes.
- Icons: Phosphor Sun/Moon retained; only size changed.
- Runtime: no horizontal overflow, calculator remains above the fold, and no console issue was observed.

final result: passed

---

## Smart Parenthesis Preview QA — 2026-07-22

**Comparison Target**

- Source visual truth: latest conversation attachment (944 × 2048 px Apple Calculator scientific-mode screenshot), specifically the bright entered `(` and muted inferred `)` around `992.966`.
- Implementation evidence: `/tmp/sezzle-parenthesis-qa/320x568-preview.png`, `/tmp/sezzle-parenthesis-qa/320x568-result.png`, `/tmp/sezzle-parenthesis-qa/568x320-preview.png`, and `/tmp/sezzle-parenthesis-qa/1024x768-preview.png`.
- Density normalization: the source is a tall native screenshot and the implementation uses 1× CSS viewport captures; comparison is scoped to parenthesis state, tone, alignment, and behavior rather than full-screen cloning.
- Primary interaction tested: entered `(992.966`, observed one muted inferred `)`, submitted with Enter, and confirmed `(992.966)` in the completed expression and history. No console warning or runtime exception was recorded.

**Findings and Fixes**

- Earlier [P1] An unmatched opening parenthesis produced no completion preview and could submit an avoidable syntax error.
  - Fix: derive unmatched opening groups from the real expression, render inferred closings in the display only, and complete them immediately before API evaluation.
  - Post-fix evidence: the captured preview shows `(992.966` in white followed by a muted `)`; submit records `(992.966)` and removes the preview.
- Earlier [P2] A purely visual ghost would not explain itself to assistive technology.
  - Fix: the inferred glyph is hidden from duplicate announcement while the readout exposes `1 closing parenthesis will be added automatically` through `aria-description`.

**Required Fidelity Surfaces**

- Fonts and typography: inferred closings inherit the exact readout font, size, weight, line height, and baseline.
- Spacing and layout: the preview stays inline at the expression end without changing display or calculator bounds.
- Colors and tokens: inferred closings use the existing `--display-muted` token; entered characters remain white.
- Image/icon fidelity: no new image asset or substitute icon is involved.
- Copy and content: visible input remains symbol-only; accessible guidance describes the automatic completion.

**Responsive and Behavioral Evidence**

- 320 × 568, 568 × 320, and 1024 × 768: preview visible, calculator fits, and no horizontal page overflow occurs.
- Explicit `)` input removes one inferred closing instead of duplicating it.
- Nested openings render the matching number of inferred closings.
- `=` sends the balanced expression to the API and stores that balanced form in history.

**Comparison History**

- Pass 1: missing preview/auto-completion behavior identified from the reference.
- Pass 2: muted preview, accessible description, explicit-close behavior, nested groups, submission, and history were implemented and verified; no P0/P1/P2 issue remains.

final result: passed

---

## Sezzle Operator Rail QA — 2026-07-22

**Comparison Target**

- Source visual truth: conversation attachment (944 × 2048 px Apple Calculator reference), combined with the user's explicit revision to move division down one row and use a more vivid Sezzle orange.
- Implementation evidence: `/tmp/sezzle-operator-rail-qa/320x568-light.png`, `/tmp/sezzle-operator-rail-qa/320x568-dark.png`, `/tmp/sezzle-operator-rail-qa/568x320-light.png`, and `/tmp/sezzle-operator-rail-qa/1024x768-light.png`.
- Viewports and density: 320 × 568, 568 × 320, and 1024 × 768 CSS px; every implementation capture is the same pixel size as its viewport at device scale factor 1. The taller native source remains scoped reference material rather than a full-screen clone target.
- State: light and dark idle states plus a completed `8 ÷ 2 = 4` light-mode state.

**Findings**

- No actionable P0/P1/P2 mismatch remains. In the four-column layout, division now starts the uninterrupted right-hand arithmetic rail `÷ × − + =`; all five controls share the same x-coordinate, diameter, color, and typographic alignment.
- The short-landscape 8 × 3 reflow intentionally preserves semantic DOM order instead of forcing a vertical rail that would overflow the viewport. Every control remains 48 px and the complete calculator stays visible.

**Required Fidelity Surfaces**

- Fonts and typography: the existing SF-compatible system stack, optical sizes, weights, baselines, and centered operator glyphs are unchanged.
- Spacing and layout rhythm: portrait operator buttons align at x = 241 px on 320 px and x = 497 px on 1024 px; calculator and header remain inside each viewport with no horizontal overflow.
- Colors and tokens: operator fill is the existing Sezzle brand orange `#FEA500`, hover is `#FFB733`, and dark ink `#241600` provides a measured 8.91:1 contrast ratio in both themes.
- Image quality and asset fidelity: no image or logo asset changed; the existing Sezzle brand assets and Phosphor backspace icon remain intact.
- Copy and content: no visible copy changed; accessible names and keyboard tokens remain unchanged.

**Full-view and Focused Evidence**

- Full-view comparison: the 320 × 568 light/dark captures show the intended warm operator emphasis and the continuous five-button rail without changing the established Apple-inspired hierarchy.
- Focused comparison: button bounds and computed styles were inspected directly; portrait operator coordinates are identical per row and all operator fills resolve to `rgb(254, 165, 0)`.
- Responsive evidence: 320 × 568 and 1024 × 768 preserve the vertical rail; 568 × 320 uses the established 8-column compact layout and keeps the calculator above the fold.

**Interaction and Runtime Checks**

- Primary interaction: clicked `8`, `÷`, `2`, `=` with real event spacing; the display showed `8/2 =` and result `4`.
- Console/runtime exceptions: 0.
- Automated verification: 40 tests passed; lint passed; production build passed.

**Comparison History**

- Pass 1: division occupied the top row and the operator orange was the softer `#FF9558`.
- Pass 2: division and power positions were exchanged, the brand-orange token was applied, and responsive captures confirmed no new P0/P1/P2 issue.

**Implementation Checklist**

- [x] Move division down one row without changing its `/` input token.
- [x] Keep the portrait arithmetic rail in the natural `÷ × − + =` order.
- [x] Apply Sezzle orange consistently in light and dark themes.
- [x] Preserve short-landscape reflow, accessible names, keyboard input, and touch targets.

final result: passed

---

## Sign Toggle Key QA — 2026-07-22

**Comparison Target**

- Source visual truth: latest conversation attachments—the Apple Calculator full mobile view (944 × 2048 px) and the focused `±` button crop—plus the explicit request to place this control beside `0`.
- Implementation evidence: `/tmp/sezzle-sign-toggle-qa/320x568-light-negative.png`, `/tmp/sezzle-sign-toggle-qa/320x568-dark.png`, `/tmp/sezzle-sign-toggle-qa/568x320-light.png`, and `/tmp/sezzle-sign-toggle-qa/1024x768-light.png`.
- Viewports and density: 320 × 568, 568 × 320, and 1024 × 768 CSS px; implementation captures match their viewport pixel dimensions at device scale factor 1.
- States: `-55.465` entered by tapping `±`, light/dark idle states, short landscape, and desktop.

**Findings**

- No actionable P0/P1/P2 mismatch remains. The final portrait row is now four equal circular controls: `±`, `0`, decimal, and equals.
- The compact landscape layout now contains exactly 24 one-cell controls, producing a balanced 8 × 3 grid without special zero-key spanning.
- The closest matching existing icon-library asset, Phosphor `PlusMinusIcon`, reproduces the reference's diagonal slash with separated plus and minus marks without custom SVG or CSS drawing.

**Required Fidelity Surfaces**

- Fonts and typography: numeric typography is unchanged; the `±` icon uses a 32 px regular-weight Phosphor mark and remains geometrically centered by the shared key component.
- Spacing and layout rhythm: at 320 px all four final-row keys are 52 × 52 px circles; at short landscape they are 48 × 48 px; at desktop they are 76 × 76 px.
- Colors and tokens: the new control uses the existing digit-key surface, hover, ink, focus, and active-animation tokens in both themes.
- Image quality and asset fidelity: a real icon-library vector is used; existing Sezzle brand imagery and other icons are unchanged.
- Copy and content: visible copy remains symbol-only; the control exposes the accessible name `toggle sign`.

**Full-view and Focused Evidence**

- Full-view comparison: the 320 × 568 negative-value capture shows the requested `± 0 . =` sequence and the same six-row calculator height as the prior design.
- Focused comparison: measured bounds confirm identical final-row diameters, 50% radii, common y-coordinates, and a centered 32 × 32 px icon.
- Responsive evidence: calculator bottoms remain inside the viewport at 320 × 568, 568 × 320, and 1024 × 768; no horizontal overflow was detected.

**Interaction, Architecture, and Runtime Checks**

- Pointer interaction: `55.465` becomes `-55.465`; pressing the control again restores `55.465`.
- Operand behavior: `2+3` becomes `2+-3`, so only the active operand changes sign instead of negating the entire expression.
- Keyboard interaction: `F9` changes the sign and triggers one active key animation on the matching control.
- Architecture: calculation state and sign transformation remain in `useCalculator`; `Keypad` and `Key` remain presentational; the hardware-key mapping remains isolated in `keyboard.ts`; the injected `CalculatorApi` boundary is unchanged.
- Console/runtime exceptions: 0.
- Automated verification: 42 tests passed; lint passed; production build passed.

**Comparison History**

- Pass 1: the zero key spanned two columns and no sign-toggle control existed.
- Pass 2: zero became a standard circular digit key, the real `±` action filled the first final-row cell, and behavior/responsive captures passed without a P0/P1/P2 regression.

**Implementation Checklist**

- [x] Add a functional `±` button immediately before `0`.
- [x] Toggle only the current operand and support repeated reversal.
- [x] Preserve component responsibilities and API dependency direction.
- [x] Add `F9` keyboard support and matching feedback animation.
- [x] Verify light, dark, mobile, short-landscape, and desktop layouts.

final result: passed

---

## Key Spacing and Optical Icon Alignment QA — 2026-07-22

**Comparison Target**

- Source visual truth: latest conversation attachment (944 × 2048 px Apple Calculator screenshot), specifically its dense circular-key rhythm and optically centered icon treatment.
- Implementation evidence: `/tmp/sezzle-key-spacing-qa/375x812-light-negative.png`, `/tmp/sezzle-key-spacing-qa/320x568-light-negative.png`, `/tmp/sezzle-key-spacing-qa/568x320-light.png`, and `/tmp/sezzle-key-spacing-qa/1024x768-light.png`.
- Normalization: the 375 × 812 CSS px capture at device scale factor 1 closely matches the source's 0.461 aspect ratio; additional captures verify responsive behavior rather than full-screen source cloning.
- State: light theme with `-55.465` plus idle short-landscape and desktop states.

**Findings and Fixes**

- Earlier [P2] horizontal spacing was visibly looser than vertical spacing: approximately 20 px at 320 px and 45 px at the 1024 × 768 compact calculator.
  - Fix: constrain the keypad's maximum width per responsive mode while preserving the existing key diameters and centered grid.
  - Post-fix evidence: the reference-proportioned 375 × 812 capture has 77 px keys with equal 8 px horizontal and vertical gaps; 320 × 568 now uses 12 px horizontal / 6 px vertical gaps; short landscape uses 5 px in both directions; 1024 × 768 uses 8 px in both directions.
- Earlier [P3] SVG marks were geometrically centered but perceived as slightly low.
  - Fix: apply a shared 1 px upward optical correction only to SVGs inside calculator keys.
  - Post-fix evidence: both backspace and `±` resolve to a -1 px vertical center delta; numerals and mathematical text glyphs remain untouched to avoid overcorrection.

**Required Fidelity Surfaces**

- Fonts and typography: number and operator font metrics are unchanged; only library SVG artwork receives the optical correction.
- Spacing and layout rhythm: key diameters, row count, calculator height, panel padding, and touch targets remain unchanged; only unused horizontal track space is reduced.
- Colors and tokens: no color, theme, contrast, hover, focus, or pressed-state token changed.
- Image quality and asset fidelity: existing Phosphor vector icons remain sharp; no custom image, SVG, CSS drawing, or replacement asset was introduced.
- Copy and content: no visible or accessible copy changed.

**Full-view and Focused Evidence**

- Full-view comparison: the 375 × 812 implementation now reproduces the source's compact, even keypad cadence while retaining the project's extra function row.
- Focused comparison: DOM bounds confirm equal gap rhythm at the reference-proportioned viewport and the requested -1 px optical lift for both SVG controls.
- Responsive evidence: calculator bottoms remain within 375 × 812, 320 × 568, 568 × 320, and 1024 × 768; no horizontal overflow occurred.

**Interaction and Runtime Checks**

- `±` remains functional and produced `-55.465` in both portrait verification states.
- Button hit areas, keyboard animation, theme behavior, and calculator architecture remain unchanged.
- Console/runtime exceptions: 0.
- Automated verification: 42 tests passed; lint passed; production build passed.

**Comparison History**

- Pass 1: identified inconsistent horizontal/vertical keypad rhythm and the user's reported low optical icon position.
- Pass 2: applied responsive keypad width caps and an SVG-only optical correction; matched spacing and responsive captures showed no remaining P0/P1/P2 issue.

**Implementation Checklist**

- [x] Tighten keys without reducing their established touch-target sizes.
- [x] Preserve calculator and header fit at compact breakpoints.
- [x] Lift only SVG marks; leave centered numerals untouched.
- [x] Verify portrait, compact portrait, short landscape, and desktop.

final result: passed

---

## Unary Square Root QA — 2026-07-22

**Comparison Target**

- Source visual truth: current conversation attachments (944 × 2048 px full calculator and 553 × 326 px focused `√(9)` readout). The attachments have no filesystem path.
- Implementation screenshots: `/tmp/sezzle-square-root-qa/375x812-sqrt-expression-dark.png` and `/tmp/sezzle-square-root-qa/375x812-sqrt-result-dark.png`.
- Normalization: the 944 × 2048 source has a 0.461 aspect ratio; the implementation uses a matching 375 × 812 CSS viewport at device scale factor 1. Both are dark-theme portrait states.
- State: `9` entered, then square-root applied; follow-up state after equals.

**Findings**

- No actionable P0/P1/P2 mismatch remains.
- Square root is now a unary operation: it wraps the active operand instead of appending invalid parser text after it.
- Parser syntax remains `sqrt(9)` for the API, while the user-facing expression renders as `√(9)`.

**Required Fidelity Surfaces**

- Fonts and typography: the mathematical radical and parentheses use the existing display type scale and light optical weight; the expression remains right-aligned and fits without scrolling.
- Spacing and layout rhythm: the new expression uses the existing result surface, padding, baseline, and responsive sizing without moving the keypad or header.
- Colors and tokens: the expression keeps the existing high-contrast display ink in both themes; no palette token changed.
- Image quality and asset fidelity: no new raster asset or substitute icon was required; the radical is mathematical content rather than decorative artwork.
- Copy and content: `sqrt(` is no longer exposed to users. The visible prior expression after evaluation is `√(9) =`, while the API receives `sqrt(9)`.

**Full-view and Focused Evidence**

- Full-view comparison: the 375 × 812 dark capture preserves the established calculator composition and shows `√(9)` prominently in the result surface, matching the source interaction state.
- Focused comparison: DOM evidence confirms the display text is exactly `√(9)`, its content fits the readout width, and the clear control correctly shows `C` while content exists.
- Result evidence: pressing equals produces `3` and retains `√(9) =` as the previous expression.

**Interaction, Architecture, and Runtime Checks**

- `9 → √` creates internal expression `sqrt(9)` and visible expression `√(9)`.
- In a longer expression, `2 + 9 → √` becomes `2 + √(9)` rather than wrapping unrelated operands.
- The unary transformation remains in `useCalculator`; `Keypad` remains a presentational dispatcher and `Display` owns only parser-to-visual formatting.
- Console/runtime exceptions: 0.
- Automated verification: 46 tests passed; lint passed; production build passed.

**Comparison History**

- Pass 1 [P1]: square root behaved like raw text input, so `9 → √` produced invalid `9sqrt(` syntax and exposed implementation-oriented notation.
- Pass 2: introduced an explicit unary square-root action, active-operand wrapping, and a display-only mathematical formatter. The matching viewport then showed `√(9)`, evaluated to `3`, and produced no runtime errors.

**Implementation Checklist**

- [x] Apply square root to the current operand.
- [x] Preserve backend-compatible parser syntax.
- [x] Render mathematical notation in current and previous expressions.
- [x] Support square root within longer expressions.
- [x] Verify the source-proportioned viewport, result state, tests, lint, and build.

final result: passed
