var Lib = function Lib() {  
  this.value = true;
}

Lib.prototype.action = function action() {
  this.value2 = false;
  return this.value;
}

exports.Lib = Lib;