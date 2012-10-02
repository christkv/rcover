console.log("============================================ REQUIRE")

var A = function A(value) {  
  if(value) {
    this.value = true;
  } else {
    this.value = false;    
  }
}

A.prototype.run = function run() {  
  this.value = true;
}

var B = function B(a) {  
  this.a = a;
}

B.prototype.reset = function reset() {
  this.a = null
}

exports.A = A;
exports.B = B;