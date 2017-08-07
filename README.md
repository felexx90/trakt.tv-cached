# trakt.tv-cached

This plugin automatically caches any GET call fired by the main module `trakt.tv`

At the moment it depends on any version of Node.js that supports async/await.

If you'd like to also queue up your API calls in order to avoid hitting trakt.tv servers too often (e.g. "no more than 2 calls per second") check out the plugin `trakt.tv-queued`, which can be combined with this one.


## Usage

Install the plugin as a normal dependency:

```js
$ npm i trakt.tv-cached --save
```

When you create a trakt.tv instance, use the `plugins` field to require this module and pass it along:

```js
const Trakt = require('trakt.tv')
const trakt = new Trakt({
  client_id: 'YYY',
  client_secret: 'ZZZ',
  plugins: {
    cached: require('trakt.tv-cached')
  }
})
```

At this point you can make API calls in two ways. One is using the main module directly:

```js
let data = await trakt.seasons.season({id: 'game-of-thrones', season: 4})
```

This will work as usual and nothing will be cached.

The other way is to add `cached.` before the method you would normally use:

```js
let data = await trakt.cached.seasons.season({id: 'game-of-thrones', season: 4})
```

This would cache the data returned by trakt.tv so that a second identical request wouldn't hit the website a second time. **BUT!!**

The cache doesn't remember data forever. It only keeps it in memory for a time called **TTL** (time to live). The TTL of the request above is **zero**. That's because the *default* TTL is zero and you didn't set it to a different value.

To specify a TTL *for this call only*, add a `ttl` parameter:

```js
let data = await trakt.cached.seasons.season({id: 'game-of-thrones', season: 4, ttl: 25})
```

The TTL is specified in seconds, so the data returned from that call will have a 25 seconds lifetime. If you ask for the fourth season of Game of Thrones a second time before 25 seconds have passed, the data will be returned from memory instantly in the form of a resolved Promise.

Once per minute, `trakt.tv-cached` will automatically run a function that will remove any expired data, freeing up memory. I call this "sweeping".

**Only GET calls are cached.** Anything else will work normally. You **can** call `trakt.cached.checkin.add`, it will work fine but it won't cache anything.

Once you're done and you want to quit the app you created, call:

```js
trakt.cached.stop()
```

This will clear a few things, including an interval, and let the Node.js process quit gracefully.



## Settings


### Time-to-live

To set a default TTL for any call and save yourself the need to use a `ttl` parameter in each and every call you make, use the `setDefaultTTL` function. Remember that the value is in seconds.

```js
// data will always be cached for 20 seconds
trakt.cached.setDefaultTTL(20)
```

The `ttl` parameter overrides the default setting, so you can set a default that makes sense for most calls but still indicate a much lower one when you get a user's latest activities or a much longer one when you need the details of an episode.

```js
// data will generally be cached for 60 seconds...
trakt.cached.setDefaultTTL(60)

// but this data in particular will be cached for an entire hour! It's like magic!!
let data = await trakt.cached.seasons.season({id: 'game-of-thrones', season: 4, ttl: 3600})
```

Remember: unless you set a TTL, by default nothing will be cached.


### Sweeping

`trakt.tv-cached` will go through the entire cache every 60 seconds and remove any expired data. If you need to change this for any reason, you're in luck:

```js
trakt.cached.setSweepInterval(120) // every 2 minutes
```

I thought of everything!!1!


### Set everything up at once

You can configure the default TTL and sweep interval when you require `trakt.tv`:

```js
let Trakt = require('trakt.tv')
let trakt = new Trakt({
  client_id: 'YYY',
  client_secret: 'ZZZ',
  plugins: {
    cached: require('trakt.tv-cached')
  },
  options: {
    cached: {
      defaultTTL: 60,
      sweepInterval: 120
    }
  }
})
```

## Debugging

This is an extremely simple module and there aren't that many useful debugging tools.

```js
trakt.cached.enableDebug()
trakt.cached.enableMetrics()
```

`enableDebug` will make this module print a load of messages of dubious usefulness to the console.

`enableMetrics` will keep count of a few interesting things. It will print them when you call `trakt.cached.stop()`. If something is returned from the cache it's a "hit", if it isn't it's a "miss" and every time something is removed from the cache it's an "expiration". This should help you figure out if the cache is actually being used; e.g. if you get a ton of expirations and misses, you're not caching it long enough and should either increase the TTL or remove this plugin.


## LICENSE

The MIT License (MIT) - author: MySidesTheyAreGone <mysidestheyaregone@protonmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
