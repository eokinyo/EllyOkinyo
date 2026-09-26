# Deploy on Monday

Deploy from the site folder on your computer. That folder must already contain `config.js` and `elly.jpg`. Those two files are not in git. A fresh clone does not have them, and the deploy check will stop you rather than publish a broken site.

```bash
git checkout main
git pull
firebase login
firebase deploy --only hosting
```

`firebase login` is only needed if this machine is not already logged in. The deploy runs `node scripts/check-deploy.js` first. If `config.js` or `elly.jpg` is missing or empty, it stops with a message and does not upload.

## After deploy

Check https://ellyokinyo.com/ on a computer and on a phone.

- Visitors do not see “sign in” or “cloud sync on”.
- https://ellyokinyo.com/?admin shows “sign in”.
- https://ellyokinyo.com/robots.txt is plain text, not the homepage.
- https://ellyokinyo.com/sitemap.xml is XML, not the homepage.
- Home, Writing, Research & Projects, CV, and Contact all render.
- A link preview (message or social post) shows the title, description, and image.
- https://ellyokinyo.com/theme-preview.html shows the homepage, not the theme preview.
