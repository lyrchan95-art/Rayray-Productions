# Instagram posting

`post.js` publishes a photo, carousel (2–10 photos) or reel through the Instagram Graph API. It needs Node 18+ and no npm packages.

## 1. Get a token (one time)

The Instagram account has to be a **Business or Creator** account.

1. Go to <https://developers.facebook.com/apps>, open your app or create one (type **Business**), and add the **Instagram** product.
2. Under **Instagram → API setup with Instagram login**, add your Instagram account and click **Generate token**. Make sure it has the `instagram_business_basic` and `instagram_business_content_publish` permissions.
3. Copy the token into `instagram/.env`. That file is git-ignored, so the token never gets committed:

   ```
   IG_ACCESS_TOKEN=IGAA...
   ```

If your account is linked through a Facebook Page instead (Facebook Login, token starts with `EAA`), also set:

```
IG_GRAPH_HOST=graph.facebook.com
IG_USER_ID=1784...        # the Instagram Business account id
```

## 2. Check the connection

```
node instagram/post.js --check
```

## 3. Post

Instagram downloads the media from a **public https URL**. A file committed to this repo is served by GitHub Pages at `https://lyrchan95-art.github.io/Rayray-Productions/<path>`. Images must be JPEG.

```
node instagram/post.js --image https://.../photo.jpg --caption "Hello from Rayray Productions"
node instagram/post.js --image URL1 --image URL2 --caption "Carousel"
node instagram/post.js --video https://.../reel.mp4 --caption "New reel"
```

Add `--dry-run` to print the API calls without sending them.
