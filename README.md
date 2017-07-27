# trakt.tv-cached
Experimental plugin that automatically caches any GET call fired by the main module trakt.tv

At the moment it depends on any version of Node.js that supports async/await.

## Setup:
```bash
$ git clone https://github.com/MySidesTheyAreGone/trakt.tv-cached.git
$ cd trakt.tv-cached
$ npm i
```

## Try it out

Run this script (use your client id and secret):
```js
let Trakt = require('trakt.tv')
let trakt = new Trakt({
  client_id: 'XXX',
  client_secret: 'YYY',
  plugins: {
    cached: require('./index.js')
  }
})

trakt.cached.debug(true)

async function test () {
  try {
    console.time('first call')
    let data = await trakt.cached.ttl(15).seasons.season({id: 'game-of-thrones', season: 4})
    console.timeEnd('first call')
    console.log(data.length + ' episodes fetched')

    console.time('second call')
    data = await trakt.cached.ttl(15).seasons.season({id: 'game-of-thrones', season: 4})
    console.timeEnd('second call')
    console.log(data.length + ' episodes fetched')

    console.log('repeating call one last time with 0 ttl')
    console.time('third call')
    data = await trakt.cached.ttl(0).seasons.season({id: 'game-of-thrones', season: 4})
    console.timeEnd('third call')
    console.log(data.length + ' episodes fetched')
  }
  catch (e) {
    console.log(e)
  }
}

test()
```
Output:
```
trakt.tv-cached | method: /shows/:id/seasons/:season, params: {"id": "game-of-thrones", "season": 4}
trakt.tv-cached | key generated: accb57b88156718e7a9645b0b513dcb4e921f66912c846291ccbe4516ab53006|/shows/:id/seasons/:season|id:game-of-thrones|season:4
trakt.tv-cached | key is not in memory: accb57b88156718e7a9645b0b513dcb4e921f66912c846291ccbe4516ab53006|/shows/:id/seasons/:season|id:game-of-thrones|season:4
trakt.tv-cached | forwarding... (key: accb57b88156718e7a9645b0b513dcb4e921f66912c846291ccbe4516ab53006|/shows/:id/seasons/:season|id:game-of-thrones|season:4)
first call: 408.444ms
10 episodes fetched
trakt.tv-cached | method: /shows/:id/seasons/:season, params: {"id": "game-of-thrones", "season": 4}
trakt.tv-cached | key generated: accb57b88156718e7a9645b0b513dcb4e921f66912c846291ccbe4516ab53006|/shows/:id/seasons/:season|id:game-of-thrones|season:4
trakt.tv-cached | key is in memory: accb57b88156718e7a9645b0b513dcb4e921f66912c846291ccbe4516ab53006|/shows/:id/seasons/:season|id:game-of-thrones|season:4
trakt.tv-cached | returning data from memory (key: accb57b88156718e7a9645b0b513dcb4e921f66912c846291ccbe4516ab53006|/shows/:id/seasons/:season|id:game-of-thrones|season:4)
second call: 5.146ms
10 episodes fetched
repeating call one last time with 0 ttl
trakt.tv-cached | method: /shows/:id/seasons/:season, params: {"id": "game-of-thrones", "season": 4}
trakt.tv-cached | key generated: accb57b88156718e7a9645b0b513dcb4e921f66912c846291ccbe4516ab53006|/shows/:id/seasons/:season|id:game-of-thrones|season:4
trakt.tv-cached | key removed after expiration: accb57b88156718e7a9645b0b513dcb4e921f66912c846291ccbe4516ab53006|/shows/:id/seasons/:season|id:game-of-thrones|season:4
trakt.tv-cached | forwarding... (key: accb57b88156718e7a9645b0b513dcb4e921f66912c846291ccbe4516ab53006|/shows/:id/seasons/:season|id:game-of-thrones|season:4)
third call: 206.287ms
10 episodes fetched
```
