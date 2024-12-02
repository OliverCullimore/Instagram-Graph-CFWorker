# Multi-Tenant Instagram API with Instagram Login on Cloudflare Workers

> This repository uses the new [Instagram API with Instagram Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login) as the [Instagram Basic Display API](https://developers.facebook.com/docs/instagram-basic-display-api) was deprecated on 4th December 2024. See this [blog post](https://developers.facebook.com/blog/post/2024/09/04/update-on-instagram-basic-display-api/) for further info.

We've had to set up quite a few Instagram feed connectors for our clients.

We've reinvented the wheel a few times, and grew tired of it. So we made this multi-tenant CloudFlare Worker to handle Instagram feeds.

## Usage

Ensure you have [Node.js & NPM](https://nodejs.org/en/download) installed, then clone the repo locally and install the dependancies:

```
npm install
```

Then create a new KV namespace "IG-Worker" or a name of your choosing then copy the `id` that's shown:

```
npx wrangler kv namespace create "IG-Worker"
```

Copy the `wrangler.toml.example` file to `wrangler.toml` and replace `{ID}` under the `[[kv_namespaces]]` section with the `id` you copied above.

Deploy the initial app ready to configure:

```
npm run deploy
```

Next ensure you have a [Facebook Developer Business Type App](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/create-a-meta-app-with-instagram) set up with the `Instagram` product added (return to these instructions before the `Generate access tokens` step if following the linked Meta docs).

Then in the left sidebar, under `Products`, click on `Instagram`, then `API setup with Instagram business login`.

Copy your `Instagram app ID`, and set it up in your Worker as a secret:

```
npx wrangler secret put APP_ID
```

Do the same for the app secret:

```
npx wrangler secret put APP_SECRET
```

Then start the wizard within the `Set up Instagram business login` section below the App ID & Secret.

Enter your Worker's URL: `https://{WORKER_NAME}.{WORKER_SUBDOMAIN}.workers.dev` as the OAuth redirect URI when prompted.

Then head over the Worker's URL which will automatically redirect you to the Instagram login flow to set up your first tenant's connection.

Once you've gone through the login flow, (and assuming you were setup as a tester if the app is in development mode), you will be able to fetch their media through `https://{WORKER_NAME}.{WORKER_SUBDOMAIN}.workers.dev/{USERNAME}`, where `{USERNAME}` is their Instagram username.

## Development

Follow the Usage steps above except:

- Add the `--preview` flag to `npx wrangler kv namespace create "IG-Worker" --preview` command
- Replace `{PREVIEW_ID}` under the `[[kv_namespaces]]` section instead with the `preview_id` generated.

Add `https://localhost:8787` into the OAuth redirect URIs whitelist within the `Set up Instagram business login` section of the Facebook Developer App.

Run `npm run dev` to start a development server.

Open a browser to https://localhost:8787 to see the development server worker in action (accepting the self-signed certificate).
