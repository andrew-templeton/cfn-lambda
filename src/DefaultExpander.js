

const notObject = obj => Object(obj) !== obj
const oneKey = obj => Object.keys(obj).length === 1


const DefaultExpander = tree => {
  const expanded = {}
  const expandEach = obj => Object.keys(obj).forEach(key => expanded[key] = DefaultExpander(obj[key]))
  if (notObject(tree)) {
    return tree
  }
  if (Array.isArray(tree)) {
    return tree.map(DefaultExpander)
  }
  if (tree.__default__) {
    const defaults = DefaultExpander(JSONExpand(tree.__default__))
    if (notObject(defaults)) {
      if (oneKey(tree)) {
        // The only property was defaults and it had non-Object value
        // So it's a string
        return defaults
      }
    } else if (Array.isArray(defaults)) {
      if (oneKey(tree)) {
        // The only property was defaults and it had non-Object value
        // So it's a string
        return defaults.map(DefaultExpander)
      }
    } else {
      expandEach(defaults)
    }
    delete tree.__default__
  }
  expandEach(tree)
  return expanded
}

const JSONExpand = string => JSON.parse(new Buffer(string, 'base64').toString('utf8'))

module.exports = val =>DefaultExpander(JSON.parse(JSON.stringify(val)))
