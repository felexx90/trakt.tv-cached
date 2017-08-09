const R = require('ramda')
const M = require('moment')
const crypto = require('crypto')

let Trakt
let sweepInterval
let sweepDelay = 60
let defaultTTL = 0
let debugEnabled = false
let metricsEnabled = false

let memory = Object.create(null)
let metrics = {hits: 0, misses: 0, xps: 0}

function _debug (msg) {
  if (debugEnabled) {
    console.log('trakt.tv-cached | ' + msg)
  }
}

function _metrics () {
  console.log('Metrics for this session:')
  console.log('Hits: ' + metrics.hits)
  console.log('Misses: ' + metrics.misses)
  console.log('Expirations: ' + metrics.xps)
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
    _debug('key removed after expiration: ' + key)
    metricsEnabled && metrics.xps++
    invalidate(key)
    return false
  }
  _debug('key is in memory: ' + key)
  return true
}

function sweep () {
  for (let key in memory) {
    if (!R.isNil(memory[key]) && hasExpired(key)) {
      _debug('key removed after expiration by automatic sweeper: ' + key)
      metricsEnabled && metrics.xps++
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

function setDefaultTTL (seconds) {
  defaultTTL = seconds
  return cached
}

function setSweepInterval (seconds) {
  sweepDelay = seconds
  return cached
}

function enableDebug () {
  debugEnabled = true
  return cached
}

function enableMetrics () {
  metricsEnabled = true
  return cached
}

function configure (options) {
  if (!R.isNil(options.defaultTTL)) {
    setDefaultTTL(options.defaultTTL)
  }
  if (!R.isNil(options.sweepInterval)) {
    setSweepInterval(options.sweepInterval)
  }
}

function start () {
  sweepInterval = setInterval(sweep, sweepDelay * 1000)
  return cached
}

function stop () {
  clearInterval(sweepInterval)
  if (metricsEnabled) {
    _metrics()
  }
  return cached
}

function _call (method, params) {
  let enqueue = params.enqueue
  let finalTTL = R.defaultTo(defaultTTL, params.ttl)
  let finalParams = R.omit(['enqueue', 'ttl'], params)
  _debug('method: ' + method.url + ', params: ' + R.toString(R.dissoc('enqueue', params)))
  let key = hash(Trakt._settings.client_id + '|' + method.url + '|' + stringify(collapse('', finalParams)))
  _debug('key generated: ' + key + ', ttl is ' + finalTTL)
  if (R.toUpper(method.method) === 'GET' && isCached(key)) {
    _debug('returning data from memory')
    metricsEnabled && metrics.hits++
    return Promise.resolve(R.clone(get(key).value))
  } else if (!R.isNil(enqueue)) {
    metricsEnabled && metrics.misses++
    _debug('calling enqueue function provided via "params"')
    return remember(finalTTL, key, () => enqueue(() => Trakt._call(method, finalParams)))
  } else {
    metricsEnabled && metrics.misses++
    _debug('forwarding API call to main trakt.tv module')
    return remember(finalTTL, key, () => Trakt._call(method, finalParams))
  }
}

let cached = module.exports = {
  setDefaultTTL,
  setSweepInterval,
  enableDebug,
  enableMetrics,
  start,
  stop,
  _call
}

cached.init = function (trakt, options) {
  Trakt = trakt
  trakt._construct.apply(cached)
  configure(options)
  cached.start()
}
