# Deploy on Monday

Deploy from the site folder on your computer. That folder must already contain `config.js` and `elly.jpg`. Those two files are not in git. A fresh clone does not have them, and the deploy check will stop you rather than publish a broken site.

```bash
git checkout main
git pull
firebase login
firebase deploy --only hosting
```

`firebase login` is only needed if this machine is not already logged in. The deploy runs three checks before upload:

1. `node scripts/check-deploy.js` — stops if `config.js` or `elly.jpg` is missing or empty, or if the hosting ignore list does not contain `.git/**`.
2. `node scripts/test-public-surface.js` — stops if the homepage or any other file that hosting would upload contains owner-tool copy, or if `/owner-ui.js` would be uploaded.
3. `node scripts/publish-owner-ui.js` — writes `scripts/owner-ui.js` into the Firestore document `private/ownerUi` using the `firebase login` account. Hosting does not upload that file. If this step cannot sign in, the deploy stops so the live site is not left without editing tools.

Firestore rules already allow only the owner to read `private/**`. This deploy does not change rules and does not use Cloud Functions. A machine that is not logged in (`firebase login`) cannot publish that document; do not deploy hosting from there.

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

## Read counts and no analytics

The site is cookieless and runs no analytics. `node scripts/test-public-surface.js` (a predeploy step) stops the deploy if an uploaded file contains `googletagmanager`, `gtag(`, `google-analytics`, `firebase-analytics` or `getAnalytics(`.

`counter.js` counts article reads in the Firestore document `counters/site` (`total` plus one field per article slug). It counts after 15 seconds visible, skips reloads, back/forward visits and obvious bots, and stores nothing on the device. Counts show only from 50 reads per article and 500 for the site total. The `counters` block in `firestore.rules` lets visitors add only +1 to `total` and one existing article field, at most once every 6 seconds; concurrent reads inside that gap are retried once and otherwise dropped.

New article page: copy an existing page in `writing/`, keep the footer privacy line and set `<script src="/counter.js" data-slug="<slug>" defer></script>` to the new slug. `node scripts/add-article.js <post.json> --write` also creates the slug's counter field at 0 (never resets an existing count). `--counter-only` does just the counter field.
