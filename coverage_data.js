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
  var node = this.nodes[node.id] = (this.nodes[node.id] || {node:node, count:0})
  node.count++;
}

// Note that a node has been visited
CoverageData.prototype.visitBlock = function(blockIndex) {
  var block = this.visitedBlocks[blockIndex] = (this.visitedBlocks[blockIndex] || {count:0})
  block.count++;
}

// Get all the nodes we did not see
CoverageData.prototype.missing = function() {
  // Find all the nodes which we haven't seen
  var nodes = this.nodes;
  var missing = this.instrumentor.filter(function(node) {
    return !nodes[node.id];
  });

  return missing;
}

// Get all the nodes we did see
CoverageData.prototype.seen = function() {  
  // Find all the nodes we have seen
  var nodes = this.nodes;
  var seen = this.instrumentor.filter(function(node) {
    return !!nodes[node.id];
  });
  
  return seen;
}

// Calculate node coverage statistics
CoverageData.prototype.blocks = function() {
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
  var store = require('./coverage_store').getStore(this.filename);
    
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

exports.CoverageData = CoverageData;