const R = require('ramda')
const MD5 = require('md5.js')
const Keyv = require('react-native-keyv-shrink')

const enqueueField = 'system:enqueue'
const ttlField = 'system:ttl'
const keyField = 'system:key'

let Trakt
let defaultTTL = 0
let debugEnabled = false
let metricsEnabled = false

let cache
let metrics = {hits: 0, misses: 0}

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
  let h = new MD5()
  h.update(str)
  return h.digest('hex')
}

async function remember (ttl, key, fn) {
  let data = await fn()
  if (ttl > 0) {
    await cache.set(key, data, ttl * 1000)
  }
  return R.clone(data)
}

function forget (key) {
  return cache.delete(key)
}

function shrink () {
  return cache.shrink()
}

function clear () {
  return cache.clear()
}

function setDefaultTTL (seconds) {
  defaultTTL = seconds
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

function getMetrics () {
  return metrics
}

async function _call (method, params) {
  let enqueue = params[enqueueField]
  let finalParams = R.omit([enqueueField, ttlField, keyField], params)
  if (R.toUpper(method.method) !== 'GET') {
    if (R.isNil(enqueue)) {
      return Trakt._call(method, finalParams)
    } else {
      return enqueue(() => Trakt._call(method, finalParams))
    }
  }
  let finalTTL = R.defaultTo(defaultTTL, params[ttlField])
  let userDefKey = params[keyField]
  _debug('method: ' + method.url + ', params: ' + R.toString(finalParams))
  let keySource
  let key
  if (R.isNil(userDefKey)) {
    keySource = method.url + '|' + stringify(collapse('', finalParams))
    key = hash(keySource)
  } else {
    keySource = 'userdef'
    key = userDefKey
  }
  _debug('key source: ' + keySource + ' key generated: ' + key + ', ttl is ' + finalTTL)
  let data = await cache.get(key)
  if (!R.isNil(data)) {
    _debug('returning data from memory')
    metricsEnabled && metrics.hits++
    return Promise.resolve(data)
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
  enableDebug,
  enableMetrics,
  getMetrics,
  delete: forget,
  shrink,
  clear,
  _call
}

cached.init = function (trakt, options) {
  Trakt = trakt
  trakt._construct.apply(cached)

  if (!R.isNil(options.defaultTTL)) {
    setDefaultTTL(options.defaultTTL)
  }
  let uri = R.defaultTo(null, options.connection)
  let storageOpts = R.merge(options.storageOptions, {
    table: R.defaultTo('trakt.tv-cached', options.storageOptions.table)
  })
  let handleError = R.defaultTo(console.error, options.handleError)

  cache = new Keyv(uri, storageOpts)

  cache.on('error', handleError)
}
