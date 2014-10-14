# syncwrap

This is yet another module to help manage async libraries.  There are a few differences between this and other modules:

* Promises are evaluated lazily.
* Non-invasive, non-infectious: promises can be passed to functions that are not aware of promises and the fundamental style of programming does not need to change. No reason to also use complex flow control mechanisms that pervade all the code -- instead most functions continue to be written like before with very localized uses of this library.
* Very tiny footprint.  The module is about a 100 lines now.
* Nice syntactic sugar with use of Function.prototype to expose the wrapped methods on any function.

Some other details (which other flow-control libraries may share):

* All callbacks are expected to be node-style two parameter contracts.
* If the result of a promise evaluation is another promise, it will be evaluated as well.  Arguments to any wrapped function can be promises and the function is only evaluated after the promises are delivered.


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

### Example #1: Calling a series of async functions.

```javascript

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
     User.prototype.getHotels.wrap(distance)
       .set({context: getUserFromId.wrapped(userId)})
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

An alternate way is to rely on the fact that successValue can be chained

```javascript

   func1.wrapped(a, b, c)
     .successValue(func2.wrapped(d, e, f))
     .successValue(func3.wrapped(g, h, i))
     .done(allDoneSuccessfully);

    // you can do this in a loop if you are so inclined
```  

### Advanced features

### get

You can fetch fields off of a promise and return a promise back.  The example is if you want a user's name but the user object itself needs to be fetched, you could do this:

```javascript
   
   // Assume User.findById(id, done) returns a <user> object which has a Name property.

   function getUserName(userId, done) {
     User.findById.wrap(id)
       .get('Name')
       .done(done)
      (); // this is needed to actually execute as useWith provides a lazy evaluation object
   }
```

### useWith

You can use useWith to call functions on a promised value.  Example:

```javascript

   // Assume User.findById(id, done) returns a <user> object which has a getState method.
   // To get the state of a user for id <userId>, you can do this:

   function getUserState(userId, done) {
     User.findById.wrap(id)
       .useWith(function (cb) { return cb(null, this.getState()); })
       .done(done)
      (); // this is needed to actually execute as useWith provides a lazy evaluation object
   }
```

### exec and execSync

The above example can also be made more readable by fetching the getState method and calling it. This is where exec comes in -- it can call a promise.

```javascript

   // Assume User.findById(id, done) returns a <user> object which has a getState method.
   // To get the state of a user for id <userId>, you can do this:

   function getUserState(userId, done) {
     User.findById.wrap(id)
       .get('getState')
       .execSync() // we use execSync because the getState does not take a callback parameter
       .done(done)
      (); // this is needed to actually execute as useWith provides a lazy evaluation object
   }
```

Note that you can pass parameters to exec and execSync and they get passed on to the base function.

### method and methodSync

The above example can be simplified further via method which helps invoke methods easily.


```javascript

   // Assume User.findById(id, done) returns a <user> object which has a getState method.
   // To get the state of a user for id <userId>, you can do this:

   function getUserState(userId, done) {
     User.findById.wrap(id)
       .methodSync('getState') // you can pass parameters here if getState takes parameters
       .done(done)
      (); // this is needed to actually execute as useWith provides a lazy evaluation object
   }
```

### lazy.js and underscore

Sometimes you want to pipe the output to lazyjs and or _ (depending on your library of choice).  This module does not depend on either of those modules but if you have them installed, it will load them via 'require'.

Note that all parameters passed to the lazyjs methods will automatically be lazy-evaluated, so you can pass a bunch of user objects that have not been fetched for example (i.e. you can pass wrapped functions with the confidence that by the time the underscore/lazy.js library is called, all its parameters will be fully evaluated).

```javascript

   function someAsyncFunction(x, y, done) {
     return done(null, [x, y]);
   }

   someAsyncFunction.wrapped(1, 2).lazyjs()
     .methodSync('map', function (x) { return {x: x, x2: x * x}; })
     .methodSync('pluck', 'x2')
     .methodSync('value')
     .done(function (err, val) {
        console.log(val); // val == [1*1, 2*2] now!
     })
     ();
```