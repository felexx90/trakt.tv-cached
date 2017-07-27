const R = require('ramda')
const M = require('moment')

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
  if (memory[key] == null) {
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

cached.ttl = function (seconds) {
  ttl = seconds
  return cached
}

cached.debug = function (enabled) {
  debugEnabled = enabled
  return cached
}

cached._call = function (method, params) {
  _debug('method: ' + method.url + ', params: ' + R.toString(params))
  if (R.toUpper(method.method) !== 'GET') {
    _debug('method: ' + method.url + ' is not a GET request, forwarding...')
    return Trakt._call(method, params)
  }
  let key = Trakt._settings.client_id + '|' + method.url
  let paramkeys = R.keys(params).sort()
  for (let k of paramkeys) {
    key += '|' + k
    key += ':' + (R.is(String, params[k]) ? params[k] : R.toString(params[k]))
  }
  _debug('key generated: ' + key)
  if (isCached(key)) {
    _debug('returning data from memory (key: ' + key + ')')
    return Promise.resolve(R.clone(get(key).value))
  } else {
    _debug('forwarding... (key: ' + key + ')')
    return remember(key, () => Trakt._call(method, params))
  }
}

cached.init = function (trakt) {
  Trakt = trakt
  trakt._construct.apply(cached)
}
