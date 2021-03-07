
module.exports = options => (...args) => {
  console.log('Using cfn-lambda SDKAlias to define an operation')
  const { method } = options
  switch (args.length) {
    // Create
    case 2:
      console.log('Aliasing method %s as CREATE operation.', method)
      return SimpleAlias({
        options,
        physicalId: null,
        params: args[0],
        reply: args[1]
      })
    // Delete
    case 3:
      console.log('Aliasing method %s as DELETE or NOOPUPDATE operation.', method)
      return SimpleAlias({
        options,
        physicalId: args[0],
        params: args[1],
        reply: args[2]
      })
    // Update
    case 4:
      console.log('Aliasing method %s as UPDATE operation.', method)
      return SimpleAlias({
        options,
        physicalId: args[0],
        params: args[1],
        reply: args[3]
      })
    default:
      throw new Error('Could not determine cfn-lambda SDKAlias method signature at runtime.')
  }
}

const SimpleAlias = ({
  options,
  options: {
    returnPhysicalId,
    api,
    method,
    ignoreErrorCodes
  },
  physicalId,
  params: { ServiceToken, ...params }={},
  reply
}) => {
  var usedParams = usableParams({ params, options, physicalId })
  var physicalIdFunction = 'function' === typeof returnPhysicalId
    ? returnPhysicalId
    : 'string' === typeof returnPhysicalId
      ? accessFunction(returnPhysicalId)
      : noop;
  api[method](usedParams, function(err, data) {
    if (!err || isIgnorable(ignoreErrorCodes, err)) {
      console.log('Aliased method succeeded: %j', data);
      return reply(null, physicalIdFunction(data, params),
        attrsFrom({ options, data }));
    }
    console.log('Aliased method had error: %j', err);
    reply(err.message);
  });
}

const attrsFrom = ({ options: { returnAttrs }, data }) => ((Array.isArray(returnAttrs) && returnAttrs.every(isString)
  ? keyFilter.bind(null, returnAttrs)
  : 'function' === typeof returnAttrs
    ? returnAttrs
    : noop)(data))


const forcePaths = (params, pathSet, translator) => {
  pathSet.forEach(path => {
    const pathTokens = path.split('.')
    const lastToken = pathTokens.pop()
    const intermediate = pathTokens.reduce((obj, key, index) => {
      if ('*' === key && obj != null) {
        return forcePaths(obj, Object.keys(obj).map(indexOrElement => [indexOrElement].concat(pathTokens.slice(index + 1)).concat(lastToken).join('.')), translator)
      }
      return obj == null
        ? undefined
        : obj[key]
    }, params)
    if (intermediate) {
      if (lastToken === '*') {
        if (Array.isArray(intermediate)) {
          intermediate.forEach((value, index) => intermediate[index] = translator(value))
        } else {
          Object.keys(intermediate).forEach(key => intermediate[key] = translator(intermediate[key]))
        }
      } else if (intermediate[lastToken] !== undefined) {
        intermediate[lastToken] = translator(intermediate[lastToken])
      }
    }
  })
  return params
}

const forceNum = (params, pathSet) => forcePaths(params, pathSet, value => +value)

const forceBoolean = (params, pathSet) => forcePaths(params, pathSet, value => ({
  '0': false,
  'false': false,
  '': false,
  'null': false,
  'undefined': false,
  '1': true,
  'true': true
})[value])


const chain = functors => starting => functors.reduce((current, functor) => functor(current), starting)
const defaultToObject = params => params || {}
const forceBoolsWithin = ({ forceBools }) => params => Array.isArray(forceBools) && forceBools.every(isString) ? forceBoolean(params, forceBools) : params
const forceNumsWithin = ({ forceNums }) => params => Array.isArray(forceNums) && forceNums.every(isString) ? forceNum(params, forceNums) : params
const maybeAliasPhysicalId = ({ physicalId, physicalIdAs }) => params => isString(physicalIdAs) ? addAliasedPhysicalId(params, physicalIdAs, physicalId) : params
const filterToKeys = ({ keys }) => params => Array.isArray(keys) && keys.every(isString) ? keyFilter(keys, params) : params
const mapWithKeys = ({ mapKeys }) => params => Object(mapKeys) === mapKeys ? useKeyMap(params, mapKeys) : params
const maybeDowncase = ({ downcase }) => params => downcase ? downcaseKeys(params) : params
const logWithMethod = ({ method }) => params => (console.log('Calling aliased method %s with params: %j', method, params) || params)

const usableParams = ({
  params,
  options: { forceBools, forceNums, physicalIdAs, keys, mapKeys, downcase, method },
  physicalId
}) => chain([
  defaultToObject,
  forceBoolsWithin({ forceBools }),
  forceNumsWithin({ forceNums }),
  maybeAliasPhysicalId({ physicalId, physicalIdAs }),
  filterToKeys({ keys }),
  mapWithKeys({ mapKeys }),
  maybeDowncase({ downcase }),
  logWithMethod({ method })
])(params)

const addAliasedPhysicalId = (params, physcialIdAlias, physicalId) => ({ ...params, [physcialIdAlias]: physicalId })

const downcaseKeys = hash => Object.keys(hash).reduce((dced, key) => ({ ...dced, [key[0].toLowerCase() + key.slice(1, key.length)]: hash[key] }), {})

const isString = obj => 'string' === typeof obj

const isIgnorable = (ignorableErrorCodes, errObject) => Array.isArray(ignorableErrorCodes) && !!~ignorableErrorCodes.indexOf(errObject.statusCode)


const accessFunction = key => {
  let actualKey = key
  const getDataSimple = data => data == null ? undefined : data[actualKey]
  const getDataRecursive = data => {
    if (actualKey.includes('.')) {
      const pathTokens = actualKey.split('.')
      const firstElem = pathTokens[0]
      const childData = data[firstElem]
      const childPath = pathTokens.slice(1).join('.')
      actualKey = childPath
      return getDataRecursive(childData)
    }
    return getDataSimple(data)
  }
  return getDataRecursive
}

const useKeyMap = (params, keyMap) => Object.keys(params).reduce((mapped, key) => ({ ...mapped, [keyMap[key] ? keyMap[key] : key]: params[key] }), {})

const noop = () => undefined

const keyFilter = (includedKeySet, hash) => includedKeySet.reduce((fHash, key) => ({ ...fHash, [key]: accessFunction(key)(hash) }), {})
