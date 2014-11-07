module.exports = wrap;
wrap.unwrap = unwrap;
Function.prototype.wrap = function () { return wrap(this, null, Array.prototype.slice.call(arguments)); };
Object.defineProperty(Function.prototype, 'wrapped', {get: function () { return wrap(this); }});
var nextTick = process && process.nextTick || setTimeout;

function wrap(fn, context, args) {
  if (typeof(fn) == 'object') return wrap(function () { return this; }, fn).sync(true);

  wrapped._isWrapped = true;
  wrapped._sync = false;
  wrapped._started = false;
  wrapped._fn = fn;
  wrapped._context = context;
  wrapped._args = args;
  wrapped._fail = {cb: [], value: []};
  wrapped._success = {cb: [], value: []};
  wrapped._done = [];
  wrapped._complete = complete;
  wrapped.sync = sync;
  wrapped.fail = fail;
  wrapped.success = success;
  wrapped.done = done;
  wrapped.failValue = failValue;
  wrapped.successValue = successValue;
  wrapped.ignoreErrors = ignoreErrors;
  wrapped.set = set;

  wrapped.useWith = useWith;
  wrapped.get = getField;
  wrapped.exec = exec;
  wrapped.execSync = execSync;
  wrapped.method = method;
  wrapped.methodSync = methodSync;
  wrapped._ = doUnderscore;
  wrapped.lazyjs = doLazyJS;
  wrapped.applyTo = applyTo;
  wrapped.applyToSync = applyToSync;

  return wrapped;

  function wrapped() {
    if (wrapped._started) return wrapped;
    wrapped._started = true;
    var args = (wrapped._args || []).concat(Array.prototype.slice.call(arguments));
    args.push(wrapped._context);
    nextTick(function () { unwrap(args, onUnwrapped); });
    return wrapped;

    function onUnwrapped(err, newArgs) {
      if (err) return complete(err);
      var context = newArgs.pop();

      if (!wrapped._fn) return complete(null, context);
      if (typeof(wrapped._fn) == 'string') wrapped._fn = context[wrapped._fn];
      if (wrapped._sync) {
        var result;
        try {
          result = wrapped._fn.apply(context, newArgs);
        } catch (e) {
          err = e;
        }
        return complete(err, result);
      }
      newArgs.push(complete);
      wrapped._fn.apply(context, newArgs);
    }
  }
   
  function complete(err, result) {
    if (err && wrapped._fail.value.length) return complete(null, wrapped._fail.value.shift());
    if (err) {
      wrapped._results = [err];
      call(wrapped._fail.cb, err);
      call(wrapped._done, err);
      return;
    }
    
    unwrap([result], function (err, newResults) {
      if (err) return complete(err);
      if (wrapped._success.value.length) return complete(null, wrapped._success.value.shift());
      wrapped._results = [null, newResults[0]];
      call(wrapped._success.cb, null, newResults[0]);
      call(wrapped._done, null, newResults[0]);
    });
  }
  
  function call(cb, err, result) { while (cb.length) (cb.shift() || function () {})(err, result); }
}

function unwrap(array, done) {
  // if there is no callback, just return a wrapper!
  if (arguments.length === 1) return wrap(unwrap, null, [array])();

  var t = new Date().getTime();
  var needsWrappingCount = 1, notified = false;
  var ret = [];
  array.forEach(function (elt, index) { 
    ret[index] = elt;
    if (typeof(elt) != 'function') return;
    if (!elt._isWrapped) return;
    needsWrappingCount ++;
    elt.done(function (err, result) {
      needsWrappingCount --;
      if (!err || elt._ignoreErrors) ret[index] = result;
      else complete(err);
      if (needsWrappingCount === 0) complete(null, ret);
    })();
  });
  needsWrappingCount --;
  if (needsWrappingCount === 0) complete(null, ret);

  function complete(err, result) {
    if (notified) return;
    notified = true;
    return done && done(err, result);
  }
}

function set(key, val) {
  if (key == 'context') wrapped._context = val;
  else if (typeof(key) == 'string') this[key] = val;
  else for (var _key in key) set(_key, key[_key]);
  return this;
}

function ignoreErrors(bool) { this._ignoreErrors = bool; return this; }
function failValue(val) { this._fail.value.push(val); return this; }
function successValue(val) { this._success.value.push(val); return this; }
function done(val) { 
  this._done.push(val);
  if (this._results) this._complete(this._results[0], this._results[1]);
  return this; 
}

function fail(val) { 
  this._fail.cb.push(val);
  if (this._results) this._complete(this._results[0], this._results[1]);
  return this; 
}
function success(val) { 
  this._success.cb.push(val);
  if (this._results) this._complete(this._results[0], this._results[1]);
  return this; 
}
function sync(bool) { this._sync = bool; return this; }

function applyTo(fn) { return wrap(fn, this, [this].concat(Array.prototype.slice.call(arguments, 1))); }
function applyToSync(fn) { return wrap(fn, this, [this].concat(Array.prototype.slice.call(arguments, 1))).sync(true); }

function useWith(fn) { return wrap(fn, this, Array.prototype.slice.call(arguments, 1)); }
function getField(field) { return wrap(function (done) { return done(null, _getField(this, field)); }, this); }
function execSync() { return wrap(_execSync, this, Array.prototype.slice.call(arguments)).sync(true); }
function exec() { return wrap(_exec, this, Array.prototype.slice.call(arguments)).sync(true); }
function method() { return wrap(_exec, this.get(arguments[0]), Array.prototype.slice.call(arguments, 1)).sync(true); }
function methodSync() { return wrap(_execSync, this.get(arguments[0]), Array.prototype.slice.call(arguments, 1)).sync(true); }
function doUnderscore() { return wrap(_doUnderscore, this, Array.prototype.slice.call(arguments)).sync(true); }
function doLazyJS() { return wrap(_doLazyJS, this, Array.prototype.slice.call(arguments)).sync(true); }

function _getField(obj, field) { 
  var ret = obj && obj[field];
  if (typeof(ret) == 'function') ret = ret.bind(obj);
  return ret;
}
function _execSync() { return wrap(this, null, Array.prototype.slice.call(arguments)).sync(true); }
function _exec() { return wrap(this, null, Array.prototype.slice.call(arguments)); }
function _doUnderscore() {
  try {
    require.resolve('underscore');
    var _ = require('underscore');
    return _(this);
  } catch (e) {};
}
function _doLazyJS() {
  try {
    require.resolve('lazy.js');
    var _ = require('lazy.js');
    return _(this);
  } catch (e) {};
}

