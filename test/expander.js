
var path = require('path');
var assert = require('assert');

var CfnLambda = require(path.resolve(__dirname, '..', 'index'));
var DefaultExpander = CfnLambda.DefaultExpander;
var JSONDeepEquals = CfnLambda.JSONDeepEquals;

function toBase64(json) {
  return new Buffer(JSON.stringify(json)).toString('base64');
}

function clone(json) {
  return JSON.parse(JSON.stringify(json));
}

function assertJSONEquality(fragment, inJSON, outJSON, expectedJSON) {
  assert(JSONDeepEquals(outJSON, expectedJSON), [
    'Debug: ',
    'FRAG: ' + JSON.stringify(fragment, null, 2),
    'IN: ' + JSON.stringify(inJSON, null, 2),
    'OUT: ' + JSON.stringify(outJSON, null, 2),
    'EXPECTS: ' + JSON.stringify(expectedJSON, null, 2)
  ].join('\n'));
}

describe('DefaultExpander', function() {
  it('should do nothing with no __default__', function(done) {
    var fragment = null;
    var inJSON = {
      foo: 'bar',
      baz: 'qux',
      deeper: {
        properties: 'exist'
      },
      supports: {
        arrays: ['in', 'deep', 'properties']
      }
    };
    var expectedJSON = inJSON;  
    var outJSON = DefaultExpander(inJSON);
    assertJSONEquality(fragment, inJSON, outJSON, expectedJSON);
    done();
  });
  it('should expand __default__ on root key', function(done) {
    var fragment = {
      Foo: 'Bar'
    };
    var inJSON = {
      __default__: toBase64(fragment),
      Baz: 'Qux'
    };
    var expectedJSON = {
      Foo: 'Bar',
      Baz: 'Qux'
    };
    var outJSON = DefaultExpander(inJSON);
    assertJSONEquality(fragment, inJSON, outJSON, expectedJSON);
    done();
  });
  it('should expand __default__ on and overwrite defined keys', function(done) {
    var fragment = {
      Foo: 'Bar',
      Overlap: 'Overwritten'
    };
    var inJSON = {
      __default__: toBase64(fragment),
      Baz: 'Qux',
      Overlap: 'NewValue'
    };
    var expectedJSON = {
      Foo: 'Bar',
      Baz: 'Qux',
      Overlap: 'NewValue'
    };
    var outJSON = DefaultExpander(inJSON);
    assertJSONEquality(fragment, inJSON, outJSON, expectedJSON);
    done();
  });
  it('should expand __default__ on non-root keys', function(done) {
    var fragment = {
      Foo: 'Bar'
    };
    var inJSON = {
      Baz: 'Qux',
      DeepExpansion: {
        __default__: toBase64(fragment)
      }
    };
    var expectedJSON = {
      Baz: 'Qux',
      DeepExpansion: {
        Foo: 'Bar'
      }
    };
    var outJSON = DefaultExpander(inJSON);
    assertJSONEquality(fragment, inJSON, outJSON, expectedJSON);
    done();
  });
  it('should expand __default__ and overwrite on non-root keys', function(done) {
    var fragment = {
      Foo: 'Bar',
      Overlap: 'Overwritten'
    };
    var inJSON = {
      Baz: 'Qux',
      DeepExpansion: {
        __default__: toBase64(fragment),
        Overlap: 'NewValue'
      }
    };
    var expectedJSON = {
      Baz: 'Qux',
      DeepExpansion: {
        Foo: 'Bar',
        Overlap: 'NewValue'
      }
    };
    var outJSON = DefaultExpander(inJSON);
    assertJSONEquality(fragment, inJSON, outJSON, expectedJSON);
    done();
  });
  it('should expand __default__ on Array values', function(done) {
    var fragment = {
      Foo: 'Bar'
    };
    var inJSON = {
      Baz: 'Qux',
      DeepExpansion: {
        Arr: [
          {
            Existing: 'Element'
          },
          {
            __default__: toBase64(fragment)
          }
        ]
      }
    };
    var expectedJSON = {
      Baz: 'Qux',
      DeepExpansion: {
        Arr: [
          {
            Existing: 'Element'
          },
          {
            Foo: 'Bar'
          }
        ]
      }
    };
    var outJSON = DefaultExpander(inJSON);
    assertJSONEquality(fragment, inJSON, outJSON, expectedJSON);
    done();
  });
  it('should expand __default__ and overwrite on Array values', function(done) {
    var fragment = {
      Foo: 'Bar',
      Overlap: 'Overwritten'
    };
    var inJSON = {
      Baz: 'Qux',
      DeepExpansion: {
        Arr: [
          {
            Existing: 'Element'
          },
          {
            __default__: toBase64(fragment),
            Overlap: 'NewValue'
          }
        ]
      }
    };
    var expectedJSON = {
      Baz: 'Qux',
      DeepExpansion: {
        Arr: [
          {
            Existing: 'Element'
          },
          {
            Foo: 'Bar',
            Overlap: 'NewValue'
          }
        ]
      }
    };
    var outJSON = DefaultExpander(inJSON);
    assertJSONEquality(fragment, inJSON, outJSON, expectedJSON);
    done();
  });
  it('should work with nesting', function(done) {
    var subfragment = {
      deepest: 'variable'
    };
    var fragment = {
      __default__: toBase64(subfragment),
      Foo: 'Bar',
      Overlap: 'Overwritten',
    };
    var inJSON = {
      Baz: 'Qux',
      DeepExpansion: {
        Arr: [
          {
            Existing: 'Element'
          },
          {
            __default__: toBase64(fragment),
            Overlap: 'NewValue'
          }
        ]
      }
    };
    var expectedJSON = {
      Baz: 'Qux',
      DeepExpansion: {
        Arr: [
          {
            Existing: 'Element'
          },
          {
            Foo: 'Bar',
            Overlap: 'NewValue',
            deepest: 'variable'
          }
        ]
      }
    };
    var outJSON = DefaultExpander(inJSON);
    assertJSONEquality(fragment, inJSON, outJSON, expectedJSON);
    done();
  });
  it('should work with Array __default__', function(done) {
    var fragment = [
      0,
      1
    ];
    var inJSON = {
      Baz: 'Qux',
      DeepExpansion: {
        Arr: [
          {
            Existing: 'Element'
          },
          {
            __default__: toBase64(fragment)
          }
        ]
      }
    };
    var expectedJSON = {
      Baz: 'Qux',
      DeepExpansion: {
        Arr: [
          {
            Existing: 'Element'
          },
          [
            0,
            1
          ]
        ]
      }
    };
    var outJSON = DefaultExpander(inJSON);
    assertJSONEquality(fragment, inJSON, outJSON, expectedJSON);
    done();
  });
  it('should work with Array __default__ being overwritten', function(done) {
    var fragment = [
      0,
      1
    ];
    var inJSON = {
      Baz: 'Qux',
      DeepExpansion: {
        Arr: [
          {
            Existing: 'Element'
          },
          {
            __default__: toBase64(fragment),
            NoLonger: 'Array'
          }
        ]
      }
    };
    var expectedJSON = {
      Baz: 'Qux',
      DeepExpansion: {
        Arr: [
          {
            Existing: 'Element'
          },
          {
            NoLonger: 'Array'
          }
        ]
      }
    };
    var outJSON = DefaultExpander(inJSON);
    assertJSONEquality(fragment, inJSON, outJSON, expectedJSON);
    done();
  });
  it('should work with primitive __default__', function(done) {
    var fragment = null;
    var inJSON = {
      Baz: 'Qux',
      DeepExpansion: {
        Arr: [
          {
            Existing: 'Element'
          },
          {
            __default__: toBase64(fragment),
          }
        ]
      }
    };
    var expectedJSON = {
      Baz: 'Qux',
      DeepExpansion: {
        Arr: [
          {
            Existing: 'Element'
          },
          null
        ]
      }
    };
    var outJSON = DefaultExpander(inJSON);
    assertJSONEquality(fragment, inJSON, outJSON, expectedJSON);
    done();
  });
  it('should work with primitive __default__ being overwritten', function(done) {
    var fragment = null;
    var inJSON = {
      Baz: 'Qux',
      DeepExpansion: {
        Arr: [
          {
            Existing: 'Element'
          },
          {
            __default__: toBase64(fragment),
            NoLonger: 'nullvalue'
          }
        ]
      }
    };
    var expectedJSON = {
      Baz: 'Qux',
      DeepExpansion: {
        Arr: [
          {
            Existing: 'Element'
          },
          {
            NoLonger: 'nullvalue'
          }
        ]
      }
    };
    var outJSON = DefaultExpander(inJSON);
    assertJSONEquality(fragment, inJSON, outJSON, expectedJSON);
    done();
  });

});
