# Veyra Demo Login Design

**Date:** 2026-07-25
**Status:** Approved for implementation planning
**Surface:** Login and authenticated dashboard routing
**Release:** Demo login v1

## 1. Goal

Add a login page in front of the existing fixture-powered dashboard. The page
should faithfully follow the login panel in the supplied `Design 1.png`, while
using a local demo session instead of real authentication.

This release validates the login experience, route flow, responsive behavior,
and visual continuity with the dashboard. It does not establish an identity or
authorization boundary.

## 2. Approved decisions

| Decision | Direction |
|---|---|
| Login route | `/` |
| Dashboard route | `/dashboard` |
| Route guard | Central Next.js `proxy.ts` |
| Session | HTTP-only browser-session cookie |
| Login methods | Telegram and email buttons use the same demo action |
| Logout | Small Sign out action in the dashboard account area |
| Artwork | Cyan line-art derivative of the approved dashboard portrait |
| Account backend | None |
| Real authentication | Deferred |

## 3. Scope

### Included

- Server-rendered login page at `/`
- Existing Overview dashboard moved to `/dashboard`
- Central redirect rules in `proxy.ts`
- One local demo-session cookie
- Shared login action for both visible login methods
- Sign-out action
- Cyan line-art login artwork derived from the existing approved portrait
- Responsive desktop and narrow-screen login layouts
- Keyboard, focus, text-scaling, and reduced-motion support
- Route, interaction, asset, responsive, and regression checks

### Excluded

- Telegram OAuth or Telegram Login Widget integration
- Email input, password input, magic links, or credential validation
- User records, account creation, account switching, and profile management
- Database-backed, encrypted, or signed sessions
- Authorization of financial data
- Terms of Service and Privacy Policy destinations
- Authentication libraries or new runtime dependencies
- Recovery, verification, multi-factor authentication, and rate limiting

The omitted account and legal links from the source design are not rendered
until their destinations exist.

## 4. Route architecture

The application has two product routes:

- `/` is the public login page.
- `/dashboard` is the fixture-powered Overview dashboard.

`proxy.ts` owns the optimistic route redirects:

| Requested route | Demo cookie | Result |
|---|---|---|
| `/` | Missing or invalid | Render login |
| `/` | Valid demo value | Redirect to `/dashboard` |
| `/dashboard` | Missing or invalid | Redirect to `/` |
| `/dashboard` | Valid demo value | Render dashboard |

The proxy checks the exact demo-cookie value, not merely the presence of a
cookie. Its matcher stays limited to the product routes needed by this release
and does not run for static assets.

This centralized proxy is intentionally selected over page-level guards because
future dashboard routes can join the protected route set without duplicating
redirect checks.

## 5. Demo session

Use one cookie named `veyra_demo_session`.

The login Server Action:

1. Sets the cookie to one fixed demo value.
2. Uses `httpOnly: true`, `sameSite: "lax"`, and `path: "/"`.
3. Uses `secure: true` only in production so local HTTP development remains
   usable.
4. Omits `maxAge` and `expires`, making it a browser-session cookie.
5. Redirects to `/dashboard`.

Both **Login with Telegram** and **Login with Email** submit native forms to
this same action. They are distinct visual entry points only; neither receives
or validates credentials.

The sign-out Server Action deletes the cookie and redirects to `/`.

The cookie is an experience prototype, not an authentication credential.
Because it can be reproduced by a user, the guarded dashboard must continue to
contain fixture data only.

## 6. Login page design

The source of truth is the left login panel in:

`/home/unmeii/.codex/attachments/a8cc8b95-8277-4eed-9e9d-3c9e3cfafd8a/Design 1.png`

### Composition

- Bright white primary surface
- Fine cyan technical-line accents
- Existing Veyra logo in the upper-left area
- Compact bordered login card aligned left of center
- Large cyan line-art Veyra figure occupying the right side
- Restrained border, shadow, and corner treatment consistent with the dashboard

### Login card

The card contains:

1. `Welcome to Veyra`
2. `Secure. Intelligent. Always in control.`
3. Primary **Login with Telegram** button
4. Divider copy: `or continue with`
5. Secondary **Login with Email** button

Use the existing Phosphor icon dependency for the Telegram and email symbols.
Both controls remain semantic submit buttons with visible keyboard focus.

Do not render **Create one**, **Switch Account**, **Terms of Service**, or
**Privacy Policy** because those actions are outside this release.

### Artwork

Create one transparent, optimized login asset from the existing approved
dashboard portrait. Preserve the same character interpretation and pose while
converting the rendering into restrained monochrome cyan line art.

The login artwork is decorative:

- It uses empty alternative text.
- It does not intercept pointer or keyboard interaction.
- Its absence must not hide or disable any login content.
- No second character interpretation or additional pose is introduced.

The existing full-color dashboard portrait remains unchanged.

## 7. Responsive behavior

### Desktop

- Preserve the source design's left-card/right-artwork relationship.
- Keep the login card comfortably readable without dominating the canvas.
- Scale and crop the artwork to remain secondary to the login action.

### Narrow screens and text scaling

- The login card becomes a single full-width content column with safe page
  padding.
- Artwork moves behind or beside the card at low visual emphasis and may be
  partially cropped.
- Decorative technical lines simplify naturally through CSS rather than
  introducing a second mobile asset.
- The page must not create horizontal scrolling at 320px width or at 200% text.
- Login controls remain fully visible and keep usable touch targets.

## 8. Dashboard change

Move the existing page implementation from `/` to `/dashboard` without
changing its financial behavior, data loader, period switching, empty states,
or error states.

Add one small **Sign out** submit action to the existing account identity area.
The action must remain reachable by keyboard and must not disrupt the sidebar's
responsive wrapping.

Page metadata should distinguish the two routes:

- Login: `Login · Veyra`
- Dashboard: `Overview · Veyra`

## 9. Error and loading behavior

The demo login has no external service, credential validation, or recoverable
provider error. Do not add simulated authentication failures or provider
loading states.

Native form navigation is sufficient for the local Server Action. No client
state library, optimistic UI, or custom loading component is needed.

If the decorative artwork fails to load, the logo, copy, and both login buttons
remain present and functional.

Invalid or missing demo-cookie values are treated as signed out.

## 10. Accessibility

- Use native forms and submit buttons.
- Maintain a logical heading hierarchy and document landmark structure.
- Give both buttons distinct accessible names.
- Keep visible focus treatment consistent with the existing cyan/navy focus
  ring.
- Do not communicate the primary/secondary distinction by color alone.
- Keep the artwork decorative and outside the accessibility tree.
- Preserve reduced-motion behavior.
- Support keyboard-only use and 200% text without content loss or two-dimensional
  scrolling.

## 11. Verification

### Route checks

- Missing cookie allows `/` and redirects `/dashboard` to `/`.
- Valid demo cookie redirects `/` to `/dashboard` and allows `/dashboard`.
- Invalid cookie values behave as signed out.
- Static assets bypass the proxy.

### Interaction checks

- Telegram login sets the demo session and reaches `/dashboard`.
- Email login produces the identical session and destination.
- Sign out deletes the session and returns to `/`.
- Direct navigation follows the approved redirect table.

### Regression checks

- Existing financial calculations and loader tests continue to pass.
- The dashboard retains current, previous-month, empty, partial-error, and
  complete-error behavior after the route move.
- Existing production build and static checks pass with updated paths.

### Visual and accessibility checks

- Compare the desktop login against the source panel.
- Inspect a narrow mobile viewport and 200% text.
- Confirm no page-level horizontal overflow.
- Confirm keyboard order, visible focus, button names, and decorative image
  semantics.
- Confirm no console warnings, page errors, or failed local requests.

### Asset check

- The line-art export has transparency.
- Its dimensions support the desktop placement without upscaling.
- The optimized file is used by the page.
- The existing full-color portrait remains unchanged.

## 12. Acceptance criteria

The demo login is ready when:

- `/` renders the approved login composition for signed-out visitors.
- Both login buttons create the same local demo session.
- `/dashboard` is inaccessible through normal navigation without that session.
- Signed-in visitors are redirected away from `/`.
- Sign out restores the signed-out state.
- The login uses a cyan line-art derivative of the approved portrait.
- Desktop, narrow-screen, keyboard, reduced-motion, and 200% text checks pass.
- The moved dashboard retains its current behavior and tests.
- No real credentials, user records, financial data, auth provider, or new
  dependency is introduced.
