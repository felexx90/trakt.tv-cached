const R = require('ramda')
const M = require('moment')
const crypto = require('crypto')

let cached = module.exports = {}
let Trakt
let sweepInterval
let sweepDelay = 60
let defaultTTL = 0
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

function hasExpired (key) {
  return memory[key].expiry.isBefore(M())
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
  if (hasExpired(key)) {
    invalidate(key)
    _debug('key removed after expiration: ' + key)
    return false
  }
  _debug('key is in memory: ' + key)
  return true
}

function sweep () {
  for (let key in memory) {
    if (!R.isNil(memory[key]) && hasExpired(key)) {
      _debug('key removed after expiration by automatic sweeper: ' + key)
      invalidate(key)
    }
  }
}

async function remember (ttl, key, fn) {
  let data = await fn()
  if (ttl > 0) {
    set(key, {
      expiry: M().add(ttl, 'seconds'),
      value: data
    })
  }
  return R.clone(data)
}

cached.memory = memory

cached.setDefaultTTL = function (seconds) {
  defaultTTL = seconds
  return cached
}

cached.setSweepInterval = function (seconds) {
  sweepInterval = seconds
  return cached
}

cached.debug = function (enabled) {
  debugEnabled = enabled
  return cached
}

cached._call = function (method, params) {
  let enqueue = params.enqueue
  let finalTTL = R.defaultTo(defaultTTL, params.ttl)
  let finalParams = R.omit(['enqueue', 'ttl'], params)
  _debug('method: ' + method.url + ', params: ' + R.toString(params))
  if (R.toUpper(method.method) !== 'GET') {
    _debug('this is not a GET request, forwarding...')
    return Trakt._call(method, params)
  }
  let key = hash(Trakt._settings.client_id + '|' + method.url + '|' + stringify(collapse('', finalParams)))
  _debug('key generated: ' + key)
  _debug('ttl is ' + finalTTL)
  if (isCached(key)) {
    _debug('returning data from memory')
    return Promise.resolve(R.clone(get(key).value))
  } else if (!R.isNil(enqueue)) {
    _debug('calling enqueue function provided via "params"')
    return remember(finalTTL, key, () => enqueue(() => Trakt._call(method, finalParams)))
  } else {
    _debug('forwarding API call to main trakt.tv module')
    return remember(finalTTL, key, () => Trakt._call(method, finalParams))
  }
}

cached.start = function () {
  sweepInterval = setInterval(sweep, sweepDelay * 1000)
  return cached
}

cached.stop = function () {
  clearInterval(sweepInterval)
  return cached
}

cached.init = function (trakt) {
  Trakt = trakt
  trakt._construct.apply(cached)
  cached.start()
}
