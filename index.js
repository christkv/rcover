var path = require('path')
  , fs = require('fs')
  , _ = require('underscore')
  , instrument = require('./lib/instrument')
  , Module = require('module').Module
  , crypto = require('crypto')
  , repl = require("repl");

/**************************************************************
 * Coverage Data
 *************************************************************/
var CoverageData = function CoverageData (filename, instrumentor) {
    this.instrumentor = instrumentor;
    this.filename = filename;
    this.nodes = {};
    this.visitedBlocks = {};
    this.source = instrumentor.source;
};

// Note that a node has been visited
CoverageData.prototype.visit = function(node) {
  // console.log("================ visit")
  var node = this.nodes[node.id] = (this.nodes[node.id] || {node:node, count:0})
  node.count++;
}

// Note that a node has been visited
CoverageData.prototype.visitBlock = function(blockIndex) {
  // console.log("================ visitBlock")
  var block = this.visitedBlocks[blockIndex] = (this.visitedBlocks[blockIndex] || {count:0})
  block.count++;
}

// Get all the nodes we did not see
CoverageData.prototype.missing = function() {
  // console.log("================ missing")
  // Find all the nodes which we haven't seen
  var nodes = this.nodes;
  var missing = this.instrumentor.filter(function(node) {
    return !nodes[node.id];
  });

  return missing;
}

// Get all the nodes we did see
CoverageData.prototype.seen = function() {  
  // console.log("================ seen")
  // Find all the nodes we have seen
  var nodes = this.nodes;
  var seen = this.instrumentor.filter(function(node) {
    return !!nodes[node.id];
  });
  
  return seen;
}

// Calculate node coverage statistics
CoverageData.prototype.blocks = function() {
  // console.log("================ blocks")
  var totalBlocks = this.instrumentor.blockCounter;
  var numSeenBlocks = 0;
  for(var index in this.visitedBlocks) {
    numSeenBlocks++;
  }
  var numMissingBlocks = totalBlocks - numSeenBlocks;
  
  var toReturn = {
    total: totalBlocks,
    seen: numSeenBlocks,
    missing: numMissingBlocks,
    percentage: totalBlocks ? numSeenBlocks / totalBlocks : 1
  };
  
  return toReturn;
}

// Explode all multi-line nodes into single-line ones.
var explodeNodes = function(coverageData, fileData) {  
  var missing = coverageData.missing(); 
  var newNodes = [];
  
  // Get only the multi-line nodes.
  var multiLineNodes = missing.filter(function(node) {
    return (node.loc.start.line < node.loc.end.line);
  });
  
  for(var i = 0; i < multiLineNodes.length; i++) {
    // Get the current node and delta
    var node = multiLineNodes[i];
    var lineDelta = node.loc.end.line - node.loc.start.line + 1;
    
    for(var j = 0; j < lineDelta; j++) {
      // For each line in the multi-line node, we'll create a 
      // new node, and we set the start and end columns
      // to the correct vlaues.
      var curLine = node.loc.start.line + j;
      var startCol = 0;
      var endCol = fileData[curLine - 1].length;
          
      if(curLine === node.loc.start.line) {
        startCol = node.loc.start.column;
      } else if(curLine === node.loc.end.line) {
        startCol = 0;
        endCol = node.loc.end.column;
      }
      
      var newNode = {
        loc: {
          start: {
            line: curLine,
            col: startCol
          },
          end: {
            line: curLine,
            col: endCol
          }
        }
      };
      
      newNodes.push(newNode);
    }
  }
  
  return newNodes;
}


// Get per-line code coverage information
CoverageData.prototype.coverage = function() {  
  // console.log("================ coverage")
  var missingLines = this.missing();
  var fileData = this.instrumentor.source.split('\n');
  
  // Get a dictionary of all the lines we did observe being at least
  // partially covered
  var seen = {};
  
  this.seen().forEach(function(node) {
    seen[node.loc.start.line] = true;
  });
  
  // Add all the new multi-line nodes.
  missingLines = missingLines.concat(explodeNodes(this, fileData));
  
  var seenNodes = {};
  missingLines = missingLines.sort(function(lhs, rhs) {
    var lhsNode = lhs.loc;
    var rhsNode = rhs.loc;
    
    // First try to sort based on line
    return lhsNode.start.line < rhsNode.start.line ? -1 : // first try line
           lhsNode.start.line > rhsNode.start.line ? 1  :
           lhsNode.start.column < rhsNode.start.column ? -1 : // then try start col
           lhsNode.start.column > rhsNode.start.column ? 1 :
           lhsNode.end.column < rhsNode.end.column ? -1 : // then try end col
           lhsNode.end.column > rhsNode.end.column ? 1 : 
           0; // then just give up and say they are equal
  }).filter(function(node) {
    // If it is a multi-line node, we can just ignore it
    if(node.loc.start.line < node.loc.end.line) {
      return false;
    }
    
    // We allow multiple nodes per line, but only one node per
    // start column (due to how instrumented works)
    var okay = false;
    if(seenNodes.hasOwnProperty(node.loc.start.line)) {
      var isNew = (seenNodes[node.loc.start.line].indexOf(node.loc.start.column) < 0);
      if(isNew) {
        seenNodes[node.loc.start.line].push(node.loc.start.column);
        okay = true;
      }
    } else {
      seenNodes[node.loc.start.line] = [node.loc.start.column];
      okay = true;
    }
    
    return okay;
  });
  
  var coverage = {};
  
  missingLines.forEach(function(node) {
    // For each missing line, add some information for it
    var line = node.loc.start.line;
    var startCol = node.loc.start.column;
    var endCol = node.loc.end.column;
    var source = fileData[line - 1];
    var partial = seen.hasOwnProperty(line) && seen[line];
    
    if (coverage.hasOwnProperty(line)) {
      coverage[line].missing.push({startCol: startCol, endCol: endCol});
    } else {
      coverage[line] = {
        partial: partial,
        source: source,
        missing: [{startCol: startCol, endCol: endCol}]
      };
    }
  });
  
  return coverage;
}

CoverageData.prototype.prepare = function() {
  // console.log("================ prepare")
  var store = require('./coverage_store').getStore(this.filename);
  // console.dir(this.filename)
  // console.dir(store)
    
  for(var index in store.nodes) {
    if (store.nodes.hasOwnProperty(index)) {
      this.nodes[index] = {node: this.instrumentor.nodes[index], count: store.nodes[index].count};
    }
  }
  
  for(var index in store.blocks) {
    if (store.blocks.hasOwnProperty(index)) {
      this.visitedBlocks[index] = {count: store.blocks[index].count};
    }
  }
}

// Get statistics for the entire file, including per-line code coverage
// and block-level coverage
CoverageData.prototype.stats = function() {
  // console.log("================ stats")
  this.prepare();
  
  var missing = this.missing();
  var filedata = this.instrumentor.source.split('\n');
  
  var observedMissing = [];
  var linesInfo = missing.sort(function(lhs, rhs) {
    return lhs.loc.start.line < rhs.loc.start.line ? -1 :
       lhs.loc.start.line > rhs.loc.start.line ? 1  :
       0;
    }).filter(function(node) {
      // Make sure we don't double count missing lines due to multi-line
      // issues
      var okay = (observedMissing.indexOf(node.loc.start.line) < 0);
      if(okay) {
        observedMissing.push(node.loc.start.line);
      }
        
      return okay;
    }).map(function(node, idx, all) {
      // For each missing line, add info for it
      return {
        lineno: node.loc.start.line,
        source: function() { return filedata[node.loc.start.line - 1]; }
      };
    });
      
  var numLines = filedata.length;
  var numMissingLines = observedMissing.length;
  var numSeenLines = numLines - numMissingLines;
  var percentageCovered = numSeenLines / numLines;
      
  return {
    percentage: percentageCovered,
    lines: linesInfo,
    missing: numMissingLines,
    seen: numSeenLines,
    total: numLines,
    coverage: this.coverage(),
    source: this.source,
    blocks: this.blocks()
  };
}

/**************************************************************
 * Helper methods
 *************************************************************/
var addInstrumentationHeader = function(template, filename, instrumented, coverageStorePath) {
    var template = _.template(template);
    var renderedSource = template({
        instrumented: instrumented,
        coverageStorePath: coverageStorePath,
        filename: filename,
        source: instrumented.instrumentedSource
    });
    
    // console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%% LOAD") 
    // console.log(renderedSource)
    return renderedSource
};

/**************************************************************
 * Cover method
 *************************************************************/
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
      // console.log("=========================== LOAD " + filename)
      
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

      // console.log("------------------------------ data START")
      // console.log(data)
      // console.log("------------------------------ data END")

      // console.dir(filename)
      var instrumented = instrument(data);

      // console.log("------------------------------ instrumented START")
      // console.log(instrumented)
      // console.log("------------------------------ instrumented END")

      var coverage = coverageData[filename] = new CoverageData(filename, instrumented);

      // console.dir(pathToCoverageStore)
      
      var newCode = addInstrumentationHeader(template, filename, instrumented, pathToCoverageStore);

      if(debugDirectory) {
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

/**************************************************************
 * Save the coverage data
 *************************************************************/
var saveCoverageData = function(coverageData, configs, noPrecombine) {
  // if (!noPrecombine) {
  //   savePrecombinedCoverageData(coverageData, configs);
  // }
  
  // Setup the information we're going to save
  var files = {};
  var toSave = {
    // version: pkg.version,
    files: files
  };
  
  _.each(coverageData, function(fileData, fileName, lst) {
    // For each file, we hash the source to get a "version ID" 
    // for it
    var stats = fileData.stats();
    var fileSource = stats.source;
    var md5 = crypto.createHash('md5');
    md5.update(fileSource);
    var hash = md5.digest('hex');
    
    // We also save the stats and the hash,
    // which is everything we need in order
    // to be able to generate reports
    files[fileName] = {
      stats: stats,
      hash: hash
    }
  });

  // Turn it into JSON and write it out
  var data = JSON.stringify(toSave, 2, 2);
  // console.log(data)
  
  // Get the ID for this data (md5 hash)
  var dataMd5 = crypto.createHash('md5');
  dataMd5.update(data);
  var dataHash = dataMd5.digest('hex');
  
  // Make the directory
  var dataDirectory = path.join(path.resolve(process.cwd()), configs.dataDirectory);
  if(!fs.existsSync(dataDirectory)) {
    fs.mkdirSync(dataDirectory, "0755");
  }
  
  // Write out the file
  var dataFilename = path.join(dataDirectory, configs.prefix + dataHash);
  fs.writeFileSync(dataFilename, data);
};


/**************************************************************
 * Execute cover
 *************************************************************/
var config = {
    debugDirectory: null
  , ignore: { '/Users/ck/coding/projects/rcover/test/noframework/node_modules': true }
  , regexp: null
  , dataDirectory: ".coverage_data"
  , prefix: "rcover_"
}

// Run cover
var coverage = cover(config.regexp, config.ignore, config.debugDirectory);
var file = "/Users/ck/coding/projects/rcover/test/noframework/main.js"

process.nextTick(function() {
  try {
    // console.log("======================  TICK =========")
    // Load up the new argv
    var options = [];
    process.argv = ["node", file].concat(options)
    // Load the file as the main module
    Module.runMain(file, null, true)
  }
  catch(ex) {
    console.log(ex.stack);
  }
});

// Setup the on exit listener
process.on(
    "exit", 
    function() {
      coverage(function(coverageData) {
        // console.log("============== DONE")

        try {
          saveCoverageData(coverageData, config);
        } catch(e) {
          console.log(e.stack);
        }
      });
    });














