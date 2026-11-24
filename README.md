# Uqdah

Hackathon prototype. Live at https://uqdah.vercel.app

`index.html` is the whole app. `build.js` rebuilds the in-browser model files (`dist/ai/`) from pinned npm packages and checks each file's sha1. Vercel runs `node build.js` on every push.

All data in the prototype is synthetic.
