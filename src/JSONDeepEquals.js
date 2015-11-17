module.exports = function JSONDeepEquals(a, b) {
  if (a == null || b == null) {
    return a === b;
  }
  var ka = Object.keys(a).sort();
  var kb = Object.keys(b).sort();
  return ka.length === kb.length && ka.every(function(k, i) {
    var av = a[k];
    var bv = b[kb[i]];
    var type = typeof av;
    return type == typeof bv && type == 'object'
      ? JSONDeepEquals(av, bv)
      : (av === bv || (isNaN(av) && isNaN(bv)));
  });
};
