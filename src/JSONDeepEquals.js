module.exports = function JSONDeepEquals(a, b) {
  if (a == null || b == null) {
    return a === b;
  }
  var ka = Object.keys(a).sort();
  var kb = Object.keys(b).sort();
  if (Object(a) !== a) {
    return a === b;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(b) && Array.isArray(a) &&
      a.length === b.length && a.every(function(av, i) {
        return JSONDeepEquals(av, b[i]);
      });
  }
  return ka.length === kb.length && ka.every(function(k, i) {
    var av = a[k];
    var bv = b[kb[i]];
    var type = typeof av;
    return type === typeof bv && type === 'object'
      ? JSONDeepEquals(av, bv)
      : (av === bv || (type === 'number' && isNaN(av) && isNaN(bv)));
  });
};
