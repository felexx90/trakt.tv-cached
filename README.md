# trakt.tv-cached v2
[![JavaScript Style Guide](https://cdn.rawgit.com/standard/standard/master/badge.svg)](https://github.com/standard/standard)<br /><br />
[![NPM](https://nodei.co/npm/trakt.tv-cached.png?downloads=true&stars=true)](https://nodei.co/npm/trakt.tv-cached/)
[![NPM](https://nodei.co/npm-dl/trakt.tv-cached.png?months=6)](https://nodei.co/npm/trakt.tv-cached/)

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

The cache doesn't remember data forever. It only keeps it in memory for a time called **TTL** (time to live). The TTL of the request above is **zero**, which means **forever**. That's because the *default* TTL is zero and you didn't set it to a different value.

To specify a different TTL *for this call only*, add a `system:ttl` parameter:

```js
let data = await trakt.cached.seasons.season({id: 'game-of-thrones', season: 4, 'system:ttl': 25})
```

The TTL is specified in seconds, so the data returned from that call will only have a 25 seconds lifetime. If you ask for the fourth season of Game of Thrones a second time before 25 seconds have passed, the data will be returned from memory instantly in the form of a resolved Promise.

If you want to set a default TTL for any request, you can (and should) do so:

```js
trakt.cached.setDefaultTTL(3600)
```

That's a TTL of one hour.

You can set a default TTL at construction time too:

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
      defaultTTL: 3600
    }
  }
})
```

Take note of where the options go!

**Only GET calls are cached.** Anything else will work normally. You **can** call `trakt.cached.checkin.add(...)`, it will work fine but nothing will be cached.


## Running out of space?

If your cache tends to grow over time it must be because some of the calls you make are never repeated. That means that expired data will remain in the cache, since it's only removed when attempting to retrieve it.

To free up memory you have two options. `clear` will empty the cache completely (this will also remove data with a zero TTL that would otherwise stay in memory permanently):

```js
await trakt.cached.clear() // resolves with undefined
```

A more expensive, but still pretty quick, option is `shrink`:

```js
await trakt.cached.shrink() // resolves with undefined
```

`shrink` will go through the entire cache and *remove expired data only*. This is your best option as long as you can run it on a timer or every X requests.


## Persisting the cache

By default `trakt.tv-cached` will store data in memory, but by the power of [Keyv](https://github.com/lukechilds/keyv) and [Keyv-shrink](https://github.com/MySidesTheyAreGone/keyv-shrink) if you want to persist the cache on a DB you can, as long as you specify the right options in `storageOptions`.

The option `handleError` is important when using any storage other than memory. It will be used to handle errors that would be thrown asynchronously and would destroy your app. It defaults to `console.error`, but please set it to something sane.

The option `namespace` is always available and can be used to make sure that key collisions do not happen when the same DB is used by more than one application. Just set it to something unique and anything you do will leave the rest of the DB intact, including `shrink()` and `clear()`.

### Redis

Install `@keyv/redis`:

```bash
npm i --save @keyv/redis
```

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
      defaultTTL: 3600,
      connection: 'redis://user:pass@localhost:6379',
      handleError: myHandler,
      storageOptions: {
        namespace: 'thisParticularApp',
        // any redis.createClient() options go here, e.g.:
        disable_resubscribing: true
      }
    }
  }
})
```
[`redis.createClient()` documentation](https://github.com/NodeRedis/node_redis#rediscreateclient)

Redis supports TTL natively, so `shrink()` is a no-op.


### MongoDB

Install `@keyv/mongo`:

```bash
npm i --save @keyv/mongo
```

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
      defaultTTL: 3600,
      connection: 'mongodb://user:pass@localhost:27017/dbname',
      handleError: myHandler,
      storageOptions: {
        namespace: 'thisParticularApp',
        collection: 'somecache' // default is 'keyv'
      }
    }
  }
})
```

MongoDB supports TTL natively, so `shrink()` is a no-op.


### SQLite

Install `keyv-sqlite-shrink`:

```bash
npm i --save keyv-sqlite-shrink
```

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
      defaultTTL: 3600,
      connection: 'sqlite://path/to/database.sqlite',
      handleError: myHandler,
      storageOptions: {
        namespace: 'thisParticularApp',
        // you can specify the table name:
        table: 'myappcache',
        // and the busyTimeout period:
        busyTimeout: 30000
      }
    }
  }
})
```
[`busyTimeout` documentation](https://sqlite.org/c3ref/busy_timeout.html)

### Postgres

Install `keyv-postgres-shrink`:

```bash
npm i --save keyv-postgres-shrink
```

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
      defaultTTL: 3600,
      connection: 'postgresql://user:pass@localhost:5432/dbname',
      handleError: myHandler,
      storageOptions: {
        namespace: 'thisParticularApp',
        // you can specify the table name:
        table: 'myappcache'
      }
    }
  }
})
```


### MySQL

Install `keyv-mysql-shrink`:

```bash
npm i --save keyv-mysql-shrink
```

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
      defaultTTL: 3600,
      connection: 'mysql://user:pass@localhost:3306/dbname',
      handleError: myHandler,
      storageOptions: {
        namespace: 'thisParticularApp',
        // you can specify the table name:
        table: 'myappcache',
        keySize: 255 // this is the default key column size
      }
    }
  }
})
```

If you get an error about the table key being too large, you can either create the table yourself before running your app or set `keySize` to 191 or lower (this setting is supported only by `keyv-mysql-shrink` version 1.1.1 or higher). This is what's being attempted behind the scenes:

```sql
CREATE TABLE `tablename` (
  `key` VARCHAR(255) PRIMARY KEY,
  `value` TEXT,
  `expiry` BIGINT
)
```

Change the `VARCHAR` size to fix the problem. If you're using `utf8m4` as the default encoding, then the limit is 191 characters. Depending on the encoding used it could be different.


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
