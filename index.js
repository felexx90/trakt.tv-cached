const R = require('ramda')
const M = require('moment')
const crypto = require('crypto')

let cached = module.exports = {}
let Trakt
let ttl = 0
let debugEnabled = false
let memory = {}

function _debug (msg) {
  if (debugEnabled) {
    console.log('trakt.tv-cached | ' + msg)
  }
}

function collapse (k, obj) {
  let o = {}
  let ks = Object.keys(obj).sort()
  for (let kk of ks) {
    let p = obj[kk]
    if (R.is(Array, p)) {
      o[k + kk] = R.join(',', p)
    } else if (R.is(Date, p)) {
      o[k + kk] = p.getTime()
    } else if (R.is(Object, p) && !R.is(Date, p)) {
      o = R.merge(o, collapse(k + kk + '.', p))
    } else {
      o[k + kk] = p
    }
  }
  return o
}

function stringify (obj) {
  let str = []
  let ks = Object.keys(obj).sort()
  for (let k of ks) {
    str.push(k + ':' + obj[k])
  }
  return R.join('|', str)
}

function hash (str) {
  let h = crypto.createHash('md5')
  h.update(str)
  return h.digest('hex')
}

function hasExpired (a) {
  let expiry = R.clone(a).add(ttl, 'seconds')
  let now = M()
  return expiry.isBefore(now)
}

function get (key) {
  return memory[key]
}

function set (key, value) {
  memory[key] = value
}

function invalidate (key) {
  memory[key] = null
}

function isCached (key) {
  if (R.isNil(memory[key])) {
    _debug('key is not in memory: ' + key)
    return false
  }
  if (hasExpired(memory[key].date, ttl)) {
    invalidate(key)
    _debug('key removed after expiration: ' + key)
    return false
  }
  _debug('key is in memory: ' + key)
  return true
}

async function remember (key, fn) {
  let data = await fn()
  set(key, {
    value: data,
    date: M()
  })
  return R.clone(data)
}

cached.memory = memory

cached.ttl = function (seconds) {
  ttl = seconds
  return cached
}

cached.debug = function (enabled) {
  debugEnabled = enabled
  return cached
}

cached._call = function (method, params, enqueue) {
  _debug('method: ' + method.url + ', params: ' + R.toString(params))
  if (R.toUpper(method.method) !== 'GET') {
    _debug('method: ' + method.url + ' is not a GET request, forwarding...')
    return Trakt._call(method, params)
  }
  let key = hash(Trakt._settings.client_id + '|' + method.url + '|' + stringify(params))
  _debug('key generated: ' + key)
  if (isCached(key)) {
    _debug('returning data from memory (key: ' + key + ')')
    return Promise.resolve(R.clone(get(key).value))
  } else if (!R.isNil(enqueue)) {
    return remember(key, () => enqueue(() => Trakt._call(method, params)))
  } else {
    return remember(key, () => Trakt._call(method, params))
  }
}

cached.init = function (trakt) {
  Trakt = trakt
  trakt._construct.apply(cached)
}
