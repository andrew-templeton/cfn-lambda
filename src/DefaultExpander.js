
module.exports = function(val) {
  return DefaultExpander(JSON.parse(JSON.stringify(val)));
};

function DefaultExpander(tree) {
  var expanded = {};
  var defaults;
  if (Object(tree) !== tree) {
    return tree;
  }
  if (Array.isArray(tree)) {
    return tree.map(DefaultExpander);
  }
  if (tree.__default__) {
    defaults = DefaultExpander(JSONExpand(tree.__default__));
    if (Object(defaults) !== defaults) {
      if (Object.keys(tree).length === 1) {
        // The only property was defaults and it had non-Object value
        // So it's a string
        return defaults;
      }
    } else if (Array.isArray(defaults)) {
      if (Object.keys(tree).length === 1) {
        // The only property was defaults and it had non-Object value
        // So it's a string
        return defaults.map(DefaultExpander);
      }
    } else {
      Object.keys(defaults).forEach(function(defaultedKey) {
        expanded[defaultedKey] = DefaultExpander(defaults[defaultedKey]);
      });
    }
    delete tree.__default__;
  }
  Object.keys(tree).forEach(function(key) {
    expanded[key] = DefaultExpander(tree[key]);
  });
  return expanded;
};

function JSONExpand(string) {
  return JSON.parse(new Buffer(string, 'base64').toString('utf8'));
}
