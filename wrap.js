module.exports = wrap;
wrap.unwrap = unwrap;
Function.prototype.wrap = function () { return wrap(this, null, Array.prototype.slice.call(arguments)); };
Object.defineProperty(Function.prototype, 'wrapped', {get: function () { return wrap(this); }});
var nextTick = process && process.nextTick || setTimeout;

function wrap(fn, context, args) {
  wrapped._isWrapped = true;
  wrapped._sync = false;
  wrapped._started = false;
  wrapped._fn = fn;
  wrapped._context = context;
  wrapped._args = args;
  wrapped._fail = {cb: []};
  wrapped._success = {cb: []};
  wrapped._done = [];
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

    function complete(err, result) {
      if (err && 'value' in wrapped._fail) {
        result = wrapped._fail.value;
        delete wrapped._fail.value;
        return complete(null, result);
      }

      if (err) {
        wrapped._results = [err];
        call(wrapped._fail.cb, err);
        call(wrapped._done, err);
        return;
      }

      unwrap([result], function (err, newResults) {
        if (err) return complete(err);
        if ('value' in wrapped._success) {
          var result = wrapped._success.value;
          delete wrapped._success.value;
          return complete(null, result);
        }
        wrapped._results = [null, newResults[0]];
        call(wrapped._success.cb, null, newResults[0]);
        call(wrapped._done, null, newResults[0]);
      });
    }

    function call(cb, err, result) { for (var kk = 0; kk < cb.length; kk ++) cb[kk](err, result); }
  }
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
function failValue(val) { this._fail.value = val; return this; }
function successValue(val) { this._success.value = val; return this; }
function done(val) { 
  if (this._results) val(this._results[0], this._results[1]);
  else this._done.push(val); 
  return this; 
}

function fail(val) { 
  if (this._results && this._results[0]) val(this._results[0], this._results[1]);
  else this._fail.cb.push(val); 
  return this; 
}
function success(val) { 
  if (this._results && !this._results[0]) val(this._results[0], this._results[1]);
  else this._success.cb.push(val); 
  return this; 
}
function sync(bool) { this._sync = bool; return this; }
function useWith(fn) { return wrap(fn, this, Array.prototype.slice.call(arguments, 1)); }
function getField(field) { return wrap(function (done) { return done(null, _getField(this, field)); }, this); }
function execSync() { return wrap(_execSync, this, Array.prototype.slice.call(arguments)).sync(true); }
function exec() { return wrap(_exec, this, Array.prototype.slice.call(arguments)).sync(true); }


function _getField(obj, field) { 
  var ret = obj && obj[field];
  if (typeof(ret) == 'function') ret = ret.bind(obj);
  return ret;
}
function _execSync(done) { return wrap(this, null, Array.prototype.slice.call(arguments)).sync(true); }
function _exec(done) { return wrap(this, null, Array.prototype.slice.call(arguments)); }
