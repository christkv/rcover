var Lib = function Lib() {  
  this.value = true;
}

Lib.prototype.do = function do() {
  this.value2 = false;
  return this.value;
}

exports.Lib = Lib;