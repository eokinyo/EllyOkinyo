# Deploy on Monday

Deploy from the site folder on your computer. That folder must already contain `config.js` and `elly.jpg`. Those two files are not in git. A fresh clone does not have them, and the deploy check will stop you rather than publish a broken site.

```bash
git checkout main
git pull
firebase login
firebase deploy --only hosting
```

`firebase login` is only needed if this machine is not already logged in. The deploy runs these steps before upload:

1. `node scripts/build-writing-index.js` — rebuilds `writing/index.json`, the Writing list, from the meta tags of every `writing/*.html` page. Stops and names the page if one lacks a tag or has a bad date or category (see "Writing list" below).
2. `node scripts/build-writing-index.js --check` — writes nothing. Stops if `writing/index.json` is missing, out of date, or lacks a `writing/*.html` page, or if a page is missing from `sitemap.xml`.
3. `node scripts/check-deploy.js` — stops if `config.js` or `elly.jpg` is missing or empty, or if the hosting ignore list does not contain `.git/**`.
4. `node scripts/test-public-surface.js` — stops if the homepage or any other file that hosting would upload contains owner-tool copy, or if `/owner-ui.js` would be uploaded.
5. `node scripts/publish-owner-ui.js` — writes `scripts/owner-ui.js` into the Firestore document `private/ownerUi` using the `firebase login` account. Hosting does not upload that file. If this step cannot sign in, the deploy stops so the live site is not left without editing tools.

Firestore rules already allow only the owner to read `private/**`. This deploy does not change rules and does not use Cloud Functions. Rules are published separately (see "Contact form" below). A machine that is not logged in (`firebase login`) cannot publish that document; do not deploy hosting from there.

## Writing list (`writing/index.json`)

The pages in `writing/` are the source of truth for the Writing list. The Writing grid and "Latest writing" on the home page show the Firestore posts in `public/blog` merged with `/writing/index.json` by slug (team-ops #99):

- A page with no Firestore post is listed from its meta tags, with its description as the excerpt. Opening it goes to `/writing/<slug>.html`, and an old `#post/<slug>` link redirects there.
- A Firestore post with the same slug keeps its title and body, and gets the page's URL for its share link.
- If `/writing/index.json` cannot be loaded, the list falls back to the Firestore posts only.
- The owner tools still edit and save only `public/blog`; the merged list is never saved.

Each `writing/<slug>.html` must have these meta tags, as the existing pages do:

| Tag | Field | Rule |
|---|---|---|
| `<meta property="og:title">` | title | not empty |
| `<meta property="article:published_time">` | date | `YYYY-MM-DD` |
| `<meta property="article:section">` | category | `Economics` or `Notes` (stored lower case) |
| `<meta name="description">` | description | not empty |
| `<meta property="og:url">` | url | `https://ellyokinyo.com/writing/<slug>.html` |

**New article:** add `writing/<slug>.html` with those tags, its images in `writing/img/<slug>/` and its `sitemap.xml` entry, then run `node scripts/build-writing-index.js` and commit `writing/index.json` with the page. The deploy rebuilds the file anyway and stops if anything disagrees. `node scripts/add-article.js` is now optional: it only puts a full Markdown copy of the post in Firestore `public/blog` and creates the read counter field. Without that counter field, `firestore.rules` does not let visitors count reads of the new article (see "Read counts" below).

Tests: `node scripts/test-writing-index.js` (manifest fields, `--check` failures on temporary copies, the merge, and the `firebase.json` wiring).

## Contact form (`contact.js`, Firestore collection `contactMessages`)

The Contact page has a form instead of an email address. `contact.js` writes one document per message to `contactMessages` (fields: `name`, `email`, `message`, `createdAt`) with the same plain REST call as `counter.js`. The `contactMessages` block in `firestore.rules` lets visitors create such a document only, with size limits, and never read, update or delete one. You read the messages in the Firebase console (Firestore Database, `contactMessages`).

Decisions made on 9 Nov 2026 (https://github.com/eokinyo/team-ops/issues/87#issuecomment-6739718961):

- Notifications are manual Firebase console checks. No Blaze plan and no extension.
- Spam protection is none for now beyond the size caps, field checks and honeypot already in this change. No automatic deletion.
- Publishing order, on your PC: publish `firestore.rules` first, then `npm run build` if that script applies, then `firebase deploy --only hosting`.

Publish `firestore.rules` in the Firebase console (Firestore Database, Rules: paste the file and publish). `firebase.json` has no `firestore` entry, so `firebase deploy --only hosting` never touches rules. This repo has no `package.json`, so there is no `npm run build` step to run. Then, on your PC, run `firebase deploy --only hosting`. If hosting goes first, the form shows its "could not be sent" message and nothing is stored.

The privacy line says messages are kept only until they are no longer needed, and are reviewed once a year. `scripts/check-deploy.js` still stops the deploy if `index.html` contains a `[PLACEHOLDER` marker or a `data-placeholder` attribute. That check passes with the wording above in place. `scripts/test-public-surface.js` stops the deploy if any uploaded file contains a `mailto:` link with an address, a gmail.com address or an obfuscated address.

Rules tests (no sign-in, local emulator): `npm install --no-save firebase-tools@15 @firebase/rules-unit-testing@4 firebase@11`, then `npx firebase emulators:exec --config scripts/rules-test.firebase.json --only firestore --project demo-hub "node scripts/test-contact-rules.mjs"`.

## After deploy

Check https://ellyokinyo.com/ on a computer and on a phone.

- Visitors do not see “sign in” or “cloud sync on”.
- https://ellyokinyo.com/?admin and https://ellyokinyo.com/#admin do not show a sign-in control. To sign in on the live site, press Alt+Shift+E, then use the button that appears. Editing tools load only for the owner account.
- https://ellyokinyo.com/owner-ui.js is a 404 and its body has none of the owner-tool text.
- `curl -sL https://ellyokinyo.com/` has no match for `isn't the owner`, `Today's Tasks`, `Signed in, but`, or the owner user id.
- https://ellyokinyo.com/robots.txt is plain text, not the homepage.
- https://ellyokinyo.com/sitemap.xml is XML, not the homepage.
- Home, Writing, Research & Projects, CV, and Contact all render.
- A link preview (message or social post) shows the title, description, and image.
- https://ellyokinyo.com/theme-preview.html shows the homepage, not the theme preview.
- https://ellyokinyo.com/.git/config shows the homepage, not the git config.

```bash
curl -sL https://ellyokinyo.com/ | grep -E "isn't the owner|Today's Tasks|Signed in, but|Lm1lDi6wjRfPVbd6SfxfFZfa6RC3|#admin|wantsAdmin" && echo LEAK || echo clean
curl -sI https://ellyokinyo.com/owner-ui.js
curl -sL https://ellyokinyo.com/owner-ui.js | grep -E "isn't the owner|Today's Tasks|Signed in, but|Portfolio data" && echo LEAK || echo clean
curl -sI https://ellyokinyo.com/scripts/owner-ui.js
```

The first command should print `clean`. `/owner-ui.js` and `/scripts/owner-ui.js` should be `404`, and the body of `/owner-ui.js` should print `clean`. Local preview (`node scripts/preview-server.js`, then `http://127.0.0.1:4173/?owner`) still loads the editing tools. That server is not the live site.

## Tests

No packages, no network:

```bash
node scripts/test-writing-index.js
node scripts/test-public-surface.js
node scripts/test-share.js
node scripts/test-cv-sort.js
node scripts/build-posts.js --self-test
```

## Read counts and no analytics

The site is cookieless and runs no analytics. `node scripts/test-public-surface.js` (a predeploy step) stops the deploy if an uploaded file contains `googletagmanager`, `gtag(`, `google-analytics`, `firebase-analytics` or `getAnalytics(`.

`counter.js` counts article reads in the Firestore document `counters/site` (`total` plus one field per article slug). It counts after 15 seconds visible, skips reloads, back/forward visits and obvious bots, and stores nothing on the device. Counts show only from 50 reads per article and 500 for the site total. The `counters` block in `firestore.rules` lets visitors add only +1 to `total` and one existing article field, at most once every 6 seconds; concurrent reads inside that gap are retried once and otherwise dropped.

New article page: copy an existing page in `writing/` (and see "Writing list" above), keep the footer privacy line and set `<script src="/counter.js" data-slug="<slug>" defer></script>` to the new slug. Keep the `<script src="/share.js" defer></script>` line too: it adds the "Share this article" block (Share or Copy link, LinkedIn, X, email) at the end of the article, using the page's canonical URL and title. Writing posts on the home page get the same block automatically. `node scripts/add-article.js <post.json> --write` also creates the slug's counter field at 0 (never resets an existing count). `--counter-only` does just the counter field.
