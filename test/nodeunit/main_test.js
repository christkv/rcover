var A = require('./library').A
  , B = require('./library').B
  // , C = require('./library2').C;

exports.setUp = function(callback) {
  return callback();
}

exports.tearDown = function(callback) {
  callback();
}

exports['Simple nodeunit test one'] = function(test) {
  // var a = new A(true);
  // a.run();
  // test.done();
  // var a = 1
  test.done();
}

exports['Simple nodeunit test two'] = function(test) {
  // var C = require('./library2').C
  // var c = new C();
  var b = new B(false);
  // var b = new B(a);
  // b.reset();
  test.done();
}

exports['Simple nodeunit test three'] = function(test) {
  // var C = require('./library2').C
  // var c = new C();
  // var b = new B(false);
  // var b = new B(a);
  // b.reset();
  test.done();
}