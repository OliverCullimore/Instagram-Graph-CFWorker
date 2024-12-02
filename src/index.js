export default {
	async fetch(request, env, ctx) {
		const appConfig = {
			id: typeof env.APP_ID === 'undefined' ? '' : env.APP_ID,
			secret: typeof env.APP_SECRET === 'undefined' ? '' : env.APP_SECRET,
		};
		const url = new URL(request.url);
		const searchParams = new URLSearchParams(url.search);
		const count = (searchParams.get('count') || 15) * 1;
		const callback = searchParams.get('callback') || null;
		const paths = url.pathname.split('/');
		if (paths.length < 2 || !paths[1]) {
			console.debug('Instagram Login Flow');
			try {
				if (searchParams.get('code')) {
					console.debug('We have a code', searchParams.get('code'));

					const secretExchange = await fetch(`https://api.instagram.com/oauth/access_token`, {
						method: 'POST',
						headers: {'Content-Type': 'application/x-www-form-urlencoded'},
						body: new URLSearchParams({
							client_id: appConfig.id,
							client_secret: appConfig.secret,
							grant_type: 'authorization_code',
							redirect_uri: `https://${url.host}/`,
							code: searchParams.get('code'),
						}),
					});
					console.debug('Got secret exchange data');

					const exchangeJson = await secretExchange.json();
					console.debug(exchangeJson);

					// Refresh the token
					const tokenExchange = await fetch(
						`https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(
							appConfig.secret
						)}&access_token=${encodeURIComponent(exchangeJson.access_token)}`
					);
					const tokenExchangeJson = await tokenExchange.json();
					const longLivedToken = tokenExchangeJson.access_token;
					const userProfile = await (
						await fetch(`https://graph.instagram.com/me?fields=id,username&access_token=${longLivedToken}`)
					).json();
					if (userProfile && userProfile.username) {
						await env.graphConfig.put(
							userProfile.username.toUpperCase(),
							JSON.stringify({
								...userProfile,
								...tokenExchangeJson,
								updated_at: new Date().getTime(),
							})
						);
					}
					return new Response(
						`<html><head><title>Instagram Graph</title><script>history.replaceState({}, document.title, '/')</script></head><body><h1>Everything is looking good!</h1><p>Your media endpoint is ready to be used and can be accessed through <a href="/${userProfile.username}">https://${url.host}/${userProfile.username}</a>!</p></body></html>`,
						{
							headers: {
								'Content-Type': 'text/html',
							},
						}
					);
				}
			} catch (e) {
				console.debug(e);
				return new Response(
					`<html><head><title>Instagram Graph</title><script>history.replaceState({}, document.title, '/')</script></head><body><h1>Uh oh. Something went wrong.</h1><p>Please try again later. If the issue persists, double check your application configuration and that your Instagram account is setup as a tester if your application is in development mode.</p></body></html>`,
					{
						headers: {
							'Content-Type': 'text/html',
						},
					}
				);
			}
			return new Response('', {
				headers: {
					Location: `https://www.instagram.com/oauth/authorize?client_id=${appConfig.id}&redirect_uri=${encodeURIComponent(
						`https://${url.host}/`
					)}&scope=instagram_business_basic&response_type=code`,
				},
				status: 302,
			});
		}
		const projectId = `token_${paths[1]}`.toUpperCase();

		console.debug(env);

		let token = (this && this[projectId]) || null;
		if (!token && typeof env.graphConfig !== 'undefined') {
			let config = null;
			try {
				console.debug('Config?');
				config = JSON.parse(await env.graphConfig.get(paths[1].toUpperCase()));
			} catch (e) {
				console.error('Error', e);
			}
			console.debug('Got config', config);
			token = config && config.access_token;
		}

		if (!token) {
			return new Response(
				JSON.stringify({
					status: 'error',
					message: 'Unknown token',
				}),
				{
					headers: {
						'Content-Type': 'application/json',
					},
					status: 400,
				}
			);
		}

		let cache = caches.default;

		const time = Math.floor(new Date().getTime() / (1000 * 10 * 60));
		const cacheUrl = new URL(request.url);
		cacheUrl.pathname = `/${paths[1]}/${time}`;
		const cacheKey = new Request(cacheUrl.toString(), request);
		let response = await cache.match(cacheKey);
		if (!response) {
			const instagramUrl = `https://graph.instagram.com/me/media?fields=id,username,media_url,timestamp,media_type,thumbnail_url,caption,permalink&access_token=${token}&limit=100`;
			const refreshUrl = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${token}`;
			const instagramData = await fetch(instagramUrl);
			const instagramJson = await instagramData.json();
			delete instagramJson.paging;
			instagramJson.fetch_time = new Date().getTime();
			instagramJson.cache_key = cacheUrl.pathname;
			response = new Response(JSON.stringify(instagramJson));
			response.headers.set('Access-Control-Allow-Origin', '*');
			response.headers.set('Content-Type', 'application/json; charset=utf-8');
			ctx.waitUntil(cache.put(cacheKey, response.clone()));
			ctx.waitUntil(fetch(refreshUrl));
		}
		const dataJson = await response.json();
		if (dataJson && dataJson.data && dataJson.data.length) {
			dataJson.data = dataJson.data.slice(0, count);
		}
		const resData = `${callback ? `${callback}(` : ''}${JSON.stringify(dataJson)}${callback ? ');' : ''}`;
		const dataResponse = new Response(resData);
		dataResponse.headers.set('Access-Control-Allow-Origin', '*');
		dataResponse.headers.set('Content-Type', callback ? 'text/javascript; charset=utf-8' : 'application/json; charset=utf-8');
		return dataResponse;
	},
};
