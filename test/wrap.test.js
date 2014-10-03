var assert = require('assert');
var wrap = require('../wrap.js');

function test(x, y, done) { setTimeout(function () { done(null, x + y);}, 200); }
function testFail(x, y, done) { return done('Failed'); }
function testSync(x, y) { return x + y; }
function ccc(x, y, z) { return [x, y, z].join(' '); }
function join(x, y, z) { return [x, y, z].join(' '); }

describe('Examples', function () {
  it ('Example 1.1', function (done) {
    var wrapped = test.wrap(5,
      test.wrap(4,
        test.wrap(3, 2)
      )
    );

    // because of lazy evaluation, none of the above functions are executed yet.
    // but with the next statement, they *all* will be.
    wrapped().done(function (err, val) {
      assert.ok(!err);
      assert.equal(val, 5 + 4 + 3 + 2);
      done();
    });    
  });

  it ('Example 1.2', function (done) {
    var wrapped = test.wrap(5,
      test.wrap(4,
        test.wrap(3, 2)
      )
    );

    // because of lazy evaluation, none of the above functions are executed yet.
    // but with the next statement, they *all* will be.
    wrapped.done(function (err, val) {
      assert.ok(!err);
      assert.equal(val, 5 + 4 + 3 + 2);
      done();
    })();
  });

  it ('Example 2.1', function (done) {
    testFail.wrapped(5, 3)
      .fail(function (err) { assert.equal(err, 'Failed'); done(); });
  });

  it ('Example 2.2', function (done) {
    testFail.wrapped(5, 3)
      .done(function (err) { assert.equal(err, 'Failed'); done(); });
  });

  it ('Example 2.3', function (done) {
    // Failures can also be suppressed via errorValue which has the effect of replacing the 
    // value of the return on error to the one provided
    testFail.wrapped(5, 3)
      .failValue(23)
      .fail(function () { assert.fail(); })
      .done(function (err, val) { assert.ok(!err); assert.equal(val, 23); done(); })  
  });  


  it ('Example 2.4', function (done) {
    testFail.wrapped(5, 3)
      .failValue(test.wrapped(22, 11))
      .done(function (err, val) { assert.ok(!err); assert.equal(val, 33); done(); })  
  });

  it ('Example 2.4 - replace error with error', function (done) {
    testFail.wrapped(5, 3)
      .failValue(testFail.wrapped(22, 11))
      .done(function (err, val) { assert.equal(err, 'Failed'); done(); })  
  });

  it ('Example 3.1', function (done) {
    testSync.wrapped(test.wrapped(5,5), test.wrapped(3,3))
      .sync(true)
      .done(function (err, val) { assert.ok(!err); assert.equal(val, 16); done(); });
  });

  it ('Example 3.2', function (done) {
    join.wrapped(testFail.wrapped(5,5).ignoreErrors(true), test.wrapped(3,3), 22)
      .sync(true)
      .done(function (err, val) { assert.ok(!err); assert.equal(val, ' 6 22'); done(); });
  });

  it ('Example 4.1', function (done) {
    wrap.unwrap([test.wrapped(5,5), testSync.wrapped(3,3).sync(true)])
      .done(function (err, val) { 
        assert.ok(!err); assert.equal(val[0], 10); assert.equal(val[1], 6); done(); 
      });  
  });
});

describe('Sync Wrap Suite', function () {
  it ('should call the underlying async function', function (done) {
    var called = 0;
    test.wrapped(5, 3)
      .fail(function () { assert.fail(); })
      .success(function (err, val) { 
        assert.ok(!err);
        assert.equal(val, 8);
        called ++;
      }).done(function (err, val) {
        assert.ok(!err);
        assert.equal(val, 8);        
        assert.equal(called, 1);
        done();
      })
    ();
  });

  it ('should call the underlying async function on failure', function (done) {
    var called = 0;
    testFail.wrapped(5, 3)
      .fail(function (err) {
        assert.equal(err, 'Failed');
        called ++;
      }).success(function (err, val) { 
        assert.fail();
      }).done(function (err, val) {
        assert.equal(err, 'Failed');
        assert.equal(called, 1);
        done();
      })
    ();
  });

  it ('should call the underlying async function multiple times', function (done) {
    var called = 0;
    var wrapped = test.wrapped(5, 3)
      .fail(function () { assert.fail(); })
      .success(function (err, val) { 
        assert.ok(!err);
        assert.equal(val, 8);
        called ++;
      }).done(function (err, val) {
        assert.ok(!err);
        assert.equal(val, 8);        
        assert.equal(called, 1);
        done();
      });

    wrapped();
    wrapped();
  });


  it ('should adding callbacks after the results', function (done) {
    var called = 0;
    var wrapped = test.wrapped;

    wrapped(5, 3)
      .fail(function () { assert.fail(); })
      .success(function (err, val) { 
        assert.ok(!err);
        assert.equal(val, 8);
        called ++;
      }).done(function (err, val) {
        assert.ok(!err);
        assert.equal(val, 8);        
        assert.equal(called, 1);
        wrapped.done(function (err, val) {
          assert.ok(!err);
          assert.equal(val, 8);        
          assert.equal(called, 1);
          done();
        });
      });
  });

  it ('should adding callbacks after the results for failures too', function (done) {
    var called = 0;
    var wrapped = testFail.wrapped;
    wrapped(5, 3)
      .fail(function (err) {
        assert.equal(err, 'Failed');
        called ++;
      }).success(function (err, val) { 
        assert.fail();
      }).done(function (err, val) {
        assert.equal(err, 'Failed');
        assert.equal(called, 1);
        wrapped.done(function (err, val) {
          assert.equal(err, 'Failed');
          assert.equal(called, 1);
          done();
        });
      })
    ();
  });

  it ('should unwrap async functions', function (done) {
    wrap.unwrap([test.wrapped(5, 3), test.wrapped(5, 7)])
      .done(function (err, results) {
        assert.ok(!err);
        assert.ok(results);
        assert.equal(results.length, 2);
        assert.equal(results[0], 8);
        assert.equal(results[1], 12);
        done();
      })
    ();
  });

  it ('should work with sync functions that take async functions as params', function (done) {
    var called = 0;
    testSync.wrapped(test.wrapped(5, 3), 6)
      .sync(true)
      .fail(function () { assert.fail(); })
      .success(function (err, val) { 
        assert.ok(!err);
        assert.equal(val, 14);
        called ++;
      }).done(function (err, val) {
        assert.ok(!err);
        assert.equal(val, 14);        
        assert.equal(called, 1);
        done();
      })
    ();
  });

  it ('should work with sync functions that take async functions as params but allow ignoring errors', function (done) {
    var called = 0;
    ccc.wrapped(testFail.wrapped(5, 3).ignoreErrors(true), 6, 3)
      .sync(true)
      .fail(function () { assert.fail(); })
      .success(function (err, val) { 
        assert.ok(!err);
        assert.equal(val, ' 6 3');
        called ++;
      }).done(function (err, val) {
        assert.ok(!err);
        assert.equal(val, ' 6 3');        
        assert.equal(called, 1);
        done();
      })
    ();
  });

  it ('should work with sync functions that take async functions as params but allow replacing errors', function (done) {
    var called = 0;
    ccc.wrapped(
      testFail.wrapped(5, 3).ignoreErrors(true).failValue(22), 6, 3)
      .sync(true)
      .fail(function () { assert.fail(); })
      .success(function (err, val) { 
        assert.ok(!err);
        assert.equal(val, '22 6 3');
        called ++;
      }).done(function (err, val) {
        assert.ok(!err);
        assert.equal(val, '22 6 3');        
        assert.equal(called, 1);
        done();
      })
    ();
  });

});
