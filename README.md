# syncwrap

This is yet another module to help manage async libraries.  There are two main differences between this and other modules:

* Promises are evaluated lazily.
* Promises can be passed to functions that are not aware of promises -- so it does not have to infect all the code everywhere.

Some other details (which other flow-control libraries may share):

* All callbacks are expected to be node-style two parameter contracts.
* If the result of a promise evaluation is another promise, it will be evaluated as well.
* The Function.prototype is modified for ease of use -- just calling 'wrapped' on any function will provide access.


[![NPM info](https://nodei.co/npm/syncwrap.png?downloads=true)](https://npmjs.org/package/syncwrap)

[![Travis build status](https://api.travis-ci.org/Like-Falling-Leaves/syncwrap.png?branch=master)](
https://travis-ci.org/Like-Falling-Leaves/syncwrap)

## TODO

This document is pretty sketchy. You can look at the unit tests to see more details.

## Install on Node

    npm install syncwrap

## Install on browser

   The module has no dependencies and should theoretically work on browsers but it has not been adapted to make this easy yet.

## API

   It is best to read the unit tests under test directory to understand how to use this.  The API is still under flux.

   All the examples assume the following functions:

```javascript

var wrap = require('syncwrap');
var assert = require('assert');

function test(x, y, done) { return done(null, x + y); }
function testFail(x, y, done) { return done('Failed'); }
function testSync(x, y) { return x + y; }
function join(x, y, z) { return [x, y, z].join(' '); }

```

### Example #1: Calling an series of async functions.

```javascript

  var wrapped = test.wrapped(5,
    test.wrapped(4,
      test.wrapped(3, 2)
    )
  );

  // because of lazy evaluation, none of the above functions are executed yet.
  // but with the next statement, they *all* will be.
  wrapped().done(function (err, val) {
    assert.ok(!err);
    assert.equal(val, 5 + 4 + 3 + 2);
  });

  // Notice also that the callback can be *before* or *after* the call to wrapped.
  wrapped.done(function (err, val) {
    assert.ok(!err);
    assert.equal(val, 5 + 4 + 3 + 2);
  })();

```

### Example #2: Failure handling

```javascript

  // failure handling can be done either via .fail which only gets called on failures
  testFail.wrapped(5, 3)
    .fail(function (err) { assert.equal(err, 'Failed'); });

  // Or, failures can be obtained via just done which gets called success or failure.
  testFail.wrapped(5, 3)
    .done(function (err) { assert.equal(err, 'Failed'); });

  // Failures can also be suppressed via errorValue which has the effect of replacing the 
  // value of the return on error to the one provided
  testFail.wrapped(5, 3)
    .failValue(23)
    .done(function (err, val) { assert.ok(!err); assert.equal(val, 23); })  

  // Similar mechanism also exists for changing the success value. It is also possible
  // to provide a promise to an error value in which case that promise will be evaluated
  // for the error code path and used.
  testFail.wrapped(5, 3)
    .failValue(test.wrapped(22, 11))
    .done(function (err, val) { assert.ok(!err); assert.equal(val, 33); })  

```

### Example #3: Sync functions

```javascript

  // if sync functions need to work on promises, it is useful to call the wrapped version which
  // can deal with this
  testSync.wrapped(test.wrapped(5,5), test.wrapped(3,3))
    .sync(true)
    .done(function (err, val) { assert.ok(!err); assert.equal(val, 16); });

  // Occasionally, you want the promise to be evaluated but if the promises fail, to not 
  // fail the whole call.  So, use ignoreErrors then (or use failValue)
  join.wrapped(testFail.wrapped(5,5).ignoreErrors(true), test.wrapped(3,3), 22)
    .sync(true)
    .done(function (err, val) { assert.ok(!err); assert.equal(val, ' 6 22'); });
```

### Example #4: Unwrapping

```javascript

  // it is sometimes useful to evaluate a bunch of promises in parallel and get the results.
  // unwrap is internally used to evaluate the parameters for any function that was wrapped.

  wrap.unwrap([test.wrapped(5,5), testSync.wrapped(3,3).sync(true)])
    .done(function (err, val) { 
      expect.ok(!err); assert.equal(val[0], 10); assert.equal(val[1], 6); 
    });  
```

### Other features

The wrapped method unfortunately does not have an associated 'context'.  So, if your underlying function expects to use the 'this' parameter, this needs to be explicitly bound by using the following mechanism:

```javascript

   wrapped = test.wrapped.set({context: context})(args);
   // or
   wrapped = wrap(test, context)(args);
```

Note that the context passed itself can be a promise which is useful for a scenario where the user object must be fetched and some instance method called:

```javascript
   function getHotels(userId, distance, done) {
     User.prototype.getHotels.wrap(getUserFromId.wrapped(userId), [distance])
       .done(done)
     ();
   }

   // instead of:
   function getHotels(userId, distance, done) {
     getUserFromId(userId, function (err, user) {
       if (err) return done(err);
       user.getHotels(distance, done);       
     });
   }

   // if you don't have access to the method via the prototype, you can still do this:
   // use a string as a function name and it will assume the function name is a property
   // of the context
   function getHotels(userId, distance, done) {
     wrap('getHotels', getUserFromId.wrapped(userId), [distance])
       .done(done)
     ();
   }

```

It is possible to have multiple callbacks passed via done and fail by calling them repeatedly.

There is no built-in support for serial execution of async functions but that isn't hard to do:

```javascript

   var funcs = [func1, func2, func3];
   serialize(funcs, done);

   function serialize(funcs, done) {
     var next = funcs.shift();
     if (!next) return done();
     next.wrapped().done(function () { serialize(funcs, done); });
   }
```
