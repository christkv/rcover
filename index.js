var path = require('path')
  , fs = require('fs')
  , Instrumentor = require('./lib/instrument').Instrumentor;

var cover = function(fileRegex, ignore, debugDirectory) {    
  var originalRequire = require.extensions['.js'];
  var coverageData = {};
  var match = null;
  
  ignore = ignore || {};
  
  if(fileRegex instanceof RegExp) {
    match = regex;
  } else {
    match = new RegExp(fileRegex ? (fileRegex.replace(/\//g, '\\/').replace(/\./g, '\\.')) : ".*", '');
  }
      
  var pathToCoverageStore = path.resolve(path.resolve(__dirname), "coverage_store.js").replace(/\\/g, "/");
  var templatePath = path.resolve(path.resolve(__dirname), "templates", "instrumentation_header.js");
  var template = fs.readFileSync(templatePath, 'utf-8');
  
  require.extensions['.js'] = function(module, filename) {
      
      filename = filename.replace(/\\/g, "/");

      if(!match.test(filename)) return originalRequire(module, filename);
      if(filename === pathToCoverageStore) return originalRequire(module, filename);
      
      // If the specific file is to be ignored
      var full = path.resolve(filename); 
      if(ignore[full]) {
        return originalRequire(module, filename);
      }
      
      // If any of the parents of the file are to be ignored
      do {
        full = path.dirname(full);
        if (ignore[full]) {
          return originalRequire(module, filename);
        }
      } while(full !== path.dirname(full));

      var data = fs.readFileSync(filename, 'utf8').trim();
      // Remove byte order mark if present
      if(data.charCodeAt(0) === 0xFEFF) {
        data = data.slice(1);
      }

      data = data.replace(/^\#\!.*/, '');
      
      var instrumented = instrument(data);
      var coverage = coverageData[filename] = new CoverageData(filename, instrumented);
      
      var newCode = addInstrumentationHeader(template, filename, instrumented, pathToCoverageStore);

      if (debugDirectory) {
          var outputPath = path.join(debugDirectory, filename.replace(/[\/|\:|\\]/g, "_") + ".js");
          fs.writeFileSync(outputPath, newCode);
      }
      
      return module._compile(newCode, filename);
  };
  
  // Setup the data retrieval and release functions
  var coverage = function(ready) {
    ready(coverageData);
  };
  
  coverage.release = function() {
    require.extensions['.js'] = originalRequire;
  };
  
  return coverage;
};

var regExp = null;
var ignore = { '/Users/ck/coding/projects/rcover/test/noframework/node_modules': true }
var debugDirectory = null;
// Run cover
var coverage = cover(regExp, ignore, debugDirectory);

require('./test/noframework/main')













