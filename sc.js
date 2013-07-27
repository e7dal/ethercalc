(function(){
  var vm, fs, path, bootSC, argv, Worker, e, replace$ = ''.replace;
  vm = require('vm');
  fs = require('fs');
  path = require('path');
  bootSC = fs.readFileSync(path.dirname(fs.realpathSync(__filename)) + "/SocialCalcModule.js", 'utf8');
  global.SC == null && (global.SC = {});
  argv = (function(){
    try {
      return require('optimist').boolean(['vm', 'polling']).argv;
    } catch (e$) {}
  }()) || {};
  Worker = (function(){
    try {
      if (argv.vm) {
        throw 'vm';
      }
      console.log("Starting backend using webworker-threads");
      return require('webworker-threads').Worker;
    } catch (e$) {
      e = e$;
      console.log("Falling back to vm.CreateContext backend");
      return (function(){
        var prototype = constructor.prototype;
        function constructor(code){
          var vm, cxt, sandbox, this$ = this;
          vm = require('vm');
          cxt = {
            console: console,
            self: {
              onmessage: function(){}
            }
          };
          cxt.window = {
            setTimeout: function(cb, ms){
              return process.nextTick(cb);
            },
            clearTimeout: function(){}
          };
          this.postMessage = function(data){
            return sandbox.self.onmessage({
              data: data
            });
          };
          this.thread = cxt.thread = {
            nextTick: function(cb){
              return process.nextTick(cb);
            },
            eval: function(src, cb){
              var rv, e;
              try {
                rv = vm.runInContext(src, sandbox);
                return typeof cb === 'function' ? cb(null, rv) : void 8;
              } catch (e$) {
                e = e$;
                return typeof cb === 'function' ? cb(e) : void 8;
              }
            }
          };
          this.terminate = function(){};
          this.sandbox = sandbox = vm.createContext(cxt);
          sandbox.postMessage = function(data){
            return typeof this$.onmessage === 'function' ? this$.onmessage({
              data: data
            }) : void 8;
          };
          vm.runInContext("(" + code + ")()", sandbox);
        }
        return constructor;
      }());
    }
  }());
  this.include = function(){
    var DB;
    DB = this.include('db');
    SC._get = function(room, io, cb){
      var ref$, this$ = this;
      if ((ref$ = SC[room]) != null && ref$._snapshot) {
        return cb({
          snapshot: SC[room]._snapshot
        });
      }
      return DB.multi().get("snapshot-" + room).lrange("log-" + room, 0, -1).exec(function(arg$, arg1$){
        var snapshot, log;
        snapshot = arg1$[0], log = arg1$[1];
        if ((snapshot || log.length) && io) {
          SC[room] = SC._init(snapshot, log, DB, room, io);
        }
        return cb({
          log: log,
          snapshot: snapshot
        });
      });
    };
    SC._put = function(room, snapshot, cb){
      var this$ = this;
      if (!snapshot) {
        return typeof cb === 'function' ? cb() : void 8;
      }
      return DB.multi().set("snapshot-" + room, snapshot).del(["log-" + room, "chat-" + room, "ecell-" + room, "audit-" + room]).bgsave().exec(function(){
        return typeof cb === 'function' ? cb() : void 8;
      });
    };
    SC._init = function(snapshot, log, DB, room, io){
      var w, this$ = this;
      log == null && (log = []);
      if (SC[room] != null) {
        SC[room]._doClearCache();
        return SC[room];
      }
      w = new Worker(function(){
        return self.onmessage = function(arg$){
          var ref$, type, ref, snapshot, command, room, log, ref1$, csv, ss, parts, cmdstr, line;
          ref$ = arg$.data, type = ref$.type, ref = ref$.ref, snapshot = ref$.snapshot, command = ref$.command, room = ref$.room, log = (ref1$ = ref$.log) != null
            ? ref1$
            : [];
          switch (type) {
          case 'cmd':
            return window.ss.ExecuteCommand(command);
          case 'recalc':
            return SocialCalc.RecalcLoadedSheet(ref, snapshot, true);
          case 'clearCache':
            return SocialCalc.Formula.SheetCache.sheets = {};
          case 'exportSave':
            return postMessage({
              type: 'save',
              save: window.ss.CreateSheetSave()
            });
          case 'exportHTML':
            return postMessage({
              type: 'html',
              html: window.ss.CreateSheetHTML()
            });
          case 'exportCSV':
            csv = window.ss.SocialCalc.ConvertSaveToOtherFormat(window.ss.CreateSheetSave(), 'csv');
            return postMessage({
              type: 'csv',
              csv: csv
            });
          case 'exportCells':
            return postMessage({
              type: 'cells',
              cells: window.ss.cells
            });
          case 'init':
            SocialCalc.SaveEditorSettings = function(){
              return "";
            };
            SocialCalc.CreateAuditString = function(){
              return "";
            };
            SocialCalc.CalculateEditorPositions = function(){};
            SocialCalc.Popup.Types.List.Create = function(){};
            SocialCalc.Popup.Types.ColorChooser.Create = function(){};
            SocialCalc.Popup.Initialize = function(){};
            SocialCalc.RecalcInfo.LoadSheet = function(ref){
              ref = (ref + "").replace(/[^a-zA-Z0-9]+/g, '').toLowerCase();
              postMessage({
                type: 'load-sheet',
                ref: ref
              });
              return true;
            };
            window.setTimeout = function(cb, ms){
              return thread.nextTick(cb);
            };
            window.clearTimeout = function(){};
            window.ss = ss = new SocialCalc.SpreadsheetControl;
            ss.SocialCalc = SocialCalc;
            ss._room = room;
            if (snapshot) {
              parts = ss.DecodeSpreadsheetSave(snapshot);
            }
            ss.editor.StatusCallback.EtherCalc = {
              func: function(editor, status, arg){
                var newSnapshot;
                if (status !== 'doneposcalc') {
                  return;
                }
                newSnapshot = ss.CreateSpreadsheetSave();
                if (ss._snapshot === newSnapshot) {
                  return;
                }
                ss._snapshot = newSnapshot;
                return postMessage({
                  type: 'snapshot',
                  snapshot: newSnapshot
                });
              }
            };
            if (parts != null && parts.sheet) {
              ss.sheet.ResetSheet();
              ss.ParseSheetSave(snapshot.substring(parts.sheet.start, parts.sheet.end));
            }
            cmdstr = (function(){
              var i$, ref$, len$, results$ = [];
              for (i$ = 0, len$ = (ref$ = log).length; i$ < len$; ++i$) {
                line = ref$[i$];
                if (!/^re(calc|display)$/.test(line)) {
                  results$.push(line);
                }
              }
              return results$;
            }()).join("\n");
            if (cmdstr.length) {
              cmdstr += "\n";
            }
            return ss.context.sheetobj.ScheduleSheetCommands("set sheet defaulttextvalueformat text-wiki\n" + cmdstr + "recalc\n", false, true);
          }
        };
      });
      w._snapshot = snapshot;
      w.onSnapshot = function(newSnapshot){
        var this$ = this;
        io.sockets['in']("recalc." + room).emit('data', {
          type: 'recalc',
          snapshot: newSnapshot,
          force: true,
          room: room
        });
        w._snapshot = newSnapshot;
        return DB.multi().set("snapshot-" + room, newSnapshot).del("log-" + room).bgsave().exec(function(){
          return console.log("==> Regenerated snapshot for " + room);
        });
      };
      w.onerror = function(it){
        return console.log(it);
      };
      w.onmessage = function(arg$){
        var ref$, type, snapshot, html, csv, ref, parts, save;
        ref$ = arg$.data, type = ref$.type, snapshot = ref$.snapshot, html = ref$.html, csv = ref$.csv, ref = ref$.ref, parts = ref$.parts, save = ref$.save;
        switch (type) {
        case 'snapshot':
          return w.onSnapshot(snapshot);
        case 'save':
          return w.onSave(save);
        case 'html':
          return w.onHtml(html);
        case 'csv':
          return w.onCsv(csv);
        case 'load-sheet':
          return SC._get(ref, io, function(){
            if (SC[ref]) {
              return SC[ref].exportSave(function(save){
                return w.postMessage({
                  type: 'recalc',
                  ref: ref,
                  snapshot: save
                });
              });
            } else {
              return w.postMessage({
                type: 'recalc',
                ref: ref,
                snapshot: ''
              });
            }
          });
        }
      };
      w._doClearCache = function(){
        return this.postMessage({
          type: 'clearCache'
        });
      };
      w.ExecuteCommand = function(command){
        return this.postMessage({
          type: 'cmd',
          command: command
        });
      };
      w.exportHTML = function(cb){
        return w.thread.eval("window.ss.CreateSheetHTML()", function(arg$, html){
          return cb(html);
        });
      };
      w.exportCSV = function(cb){
        return w.thread.eval("window.ss.SocialCalc.ConvertSaveToOtherFormat(\n  window.ss.CreateSheetSave(), \"csv\"\n)", function(arg$, csv){
          return cb(csv);
        });
      };
      w.exportHTML = function(cb){
        var x, this$ = this;
        x = new Worker(function(){
          return this.onmessage = function(arg$){
            var ref$, snapshot, log, ref1$, parts, save, ss, Node, cmdstr, line, e;
            ref$ = arg$.data, snapshot = ref$.snapshot, log = (ref1$ = ref$.log) != null
              ? ref1$
              : [];
            try {
              parts = SocialCalc.SpreadsheetControlDecodeSpreadsheetSave("", snapshot);
              save = snapshot.substring(parts.sheet.start, parts.sheet.end);
              window.setTimeout = function(cb, ms){
                return thread.nextTick(cb);
              };
              window.clearTimeout = function(){};
              window.ss = ss = new SocialCalc.SpreadsheetControl;
              Node = (function(){
                Node.displayName = 'Node';
                var prototype = Node.prototype, constructor = Node;
                function Node(tag, attrs, style, elems, raw){
                  this.tag = tag != null ? tag : "div";
                  this.attrs = attrs != null
                    ? attrs
                    : {};
                  this.style = style != null
                    ? style
                    : {};
                  this.elems = elems != null
                    ? elems
                    : [];
                  this.raw = raw != null ? raw : '';
                }
                Object.defineProperty(prototype, 'id', {
                  set: function(id){
                    this.attrs.id = id;
                  },
                  configurable: true,
                  enumerable: true
                });
                Object.defineProperty(prototype, 'width', {
                  set: function(width){
                    this.attrs.width = width;
                  },
                  configurable: true,
                  enumerable: true
                });
                Object.defineProperty(prototype, 'height', {
                  set: function(height){
                    this.attrs.height = height;
                  },
                  configurable: true,
                  enumerable: true
                });
                Object.defineProperty(prototype, 'className', {
                  set: function($class){
                    this.attrs['class'] = $class;
                  },
                  configurable: true,
                  enumerable: true
                });
                Object.defineProperty(prototype, 'colSpan', {
                  set: function(colspan){
                    this.attrs.colspan = colspan;
                  },
                  configurable: true,
                  enumerable: true
                });
                Object.defineProperty(prototype, 'rowSpan', {
                  set: function(rowspan){
                    this.attrs.rowspan = rowspan;
                  },
                  configurable: true,
                  enumerable: true
                });
                Object.defineProperty(prototype, 'title', {
                  set: function(title){
                    this.attrs.title = title;
                  },
                  configurable: true,
                  enumerable: true
                });
                Object.defineProperty(prototype, 'innerHTML', {
                  set: function(raw){
                    this.raw = raw;
                  },
                  get: function(){
                    var e;
                    return this.raw || (function(){
                      var i$, ref$, len$, results$ = [];
                      for (i$ = 0, len$ = (ref$ = this.elems).length; i$ < len$; ++i$) {
                        e = ref$[i$];
                        results$.push(e.outerHTML);
                      }
                      return results$;
                    }.call(this)).join("\n");
                  },
                  configurable: true,
                  enumerable: true
                });
                Object.defineProperty(prototype, 'outerHTML', {
                  get: function(){
                    var tag, attrs, style, css, k, v;
                    tag = this.tag, attrs = this.attrs, style = this.style;
                    css = style.cssText || (function(){
                      var ref$, results$ = [];
                      for (k in ref$ = style) {
                        v = ref$[k];
                        results$.push(k + ":" + v);
                      }
                      return results$;
                    }()).join(";");
                    if (css) {
                      attrs.style = css;
                    } else {
                      delete attrs.style;
                    }
                    return "<" + tag + (function(){
                      var ref$, results$ = [];
                      for (k in ref$ = attrs) {
                        v = ref$[k];
                        results$.push(" " + k + "=\"" + v + "\"");
                      }
                      return results$;
                    }()).join('') + ">" + this.innerHTML + "</" + tag + ">";
                  },
                  configurable: true,
                  enumerable: true
                });
                prototype.appendChild = function(it){
                  return this.elems.push(it);
                };
                return Node;
              }());
              SocialCalc.document.createElement = function(it){
                return new Node(it);
              };
              ss.sheet.ResetSheet();
              ss.ParseSheetSave(save);
              if (log != null && log.length) {
                cmdstr = (function(){
                  var i$, ref$, len$, results$ = [];
                  for (i$ = 0, len$ = (ref$ = log).length; i$ < len$; ++i$) {
                    line = ref$[i$];
                    if (!/^re(calc|display)$/.test(line) && line !== "set sheet defaulttextvalueformat text-wiki") {
                      results$.push(line);
                    }
                  }
                  return results$;
                }()).join("\n");
                if (cmdstr.length) {
                  cmdstr += "\n";
                }
                ss.editor.StatusCallback.EtherCalc = {
                  func: function(editor, status, arg){
                    if (status !== 'doneposcalc') {
                      return;
                    }
                    return postMessage(ss.CreateSheetHTML());
                  }
                };
                return ss.context.sheetobj.ScheduleSheetCommands(cmdstr, false, true);
              } else {
                return postMessage(ss.CreateSheetHTML());
              }
            } catch (e$) {
              e = e$;
              return postMessage("ERROR: " + e);
            }
          };
        });
        x.onmessage = function(arg$){
          var data;
          data = arg$.data;
          x.thread.destroy();
          return cb(data);
        };
        DB.lrange("log-" + room, 0, -1, function(arg$, log){
          return x.thread.eval(bootSC, function(){
            return x.postMessage({
              snapshot: w._snapshot,
              log: log
            });
          });
        });
      };
      w.exportCSV = function(cb){
        var x, this$ = this;
        x = new Worker(function(){
          return this.onmessage = function(arg$){
            var ref$, snapshot, log, ref1$, parts, save, cmdstr, line, ss, e;
            ref$ = arg$.data, snapshot = ref$.snapshot, log = (ref1$ = ref$.log) != null
              ? ref1$
              : [];
            try {
              parts = SocialCalc.SpreadsheetControlDecodeSpreadsheetSave("", snapshot);
              save = snapshot.substring(parts.sheet.start, parts.sheet.end);
              if (log != null && log.length) {
                cmdstr = (function(){
                  var i$, ref$, len$, results$ = [];
                  for (i$ = 0, len$ = (ref$ = log).length; i$ < len$; ++i$) {
                    line = ref$[i$];
                    if (!/^re(calc|display)$/.test(line) && line !== "set sheet defaulttextvalueformat text-wiki") {
                      results$.push(line);
                    }
                  }
                  return results$;
                }()).join("\n");
                if (cmdstr.length) {
                  cmdstr += "\n";
                }
                window.setTimeout = function(cb, ms){
                  return thread.nextTick(cb);
                };
                window.clearTimeout = function(){};
                window.ss = ss = new SocialCalc.SpreadsheetControl;
                ss.sheet.ResetSheet();
                ss.ParseSheetSave(save);
                ss.editor.StatusCallback.EtherCalc = {
                  func: function(editor, status, arg){
                    var save;
                    if (status !== 'doneposcalc') {
                      return;
                    }
                    save = ss.CreateSheetSave();
                    return postMessage(SocialCalc.ConvertSaveToOtherFormat(save, 'csv'));
                  }
                };
                return ss.context.sheetobj.ScheduleSheetCommands(cmdstr, false, true);
              } else {
                return postMessage(SocialCalc.ConvertSaveToOtherFormat(save, 'csv'));
              }
            } catch (e$) {
              e = e$;
              return postMessage("ERROR: " + e);
            }
          };
        });
        x.onmessage = function(arg$){
          var data;
          data = arg$.data;
          x.thread.destroy();
          return cb(data);
        };
        DB.lrange("log-" + room, 0, -1, function(arg$, log){
          return x.thread.eval(bootSC, function(){
            return x.postMessage({
              snapshot: w._snapshot,
              log: log
            });
          });
        });
      };
      w.exportSave = function(cb){
        return w.thread.eval("window.ss.CreateSheetSave()", function(arg$, save){
          return cb(save);
        });
      };
      w.exportCell = function(coord, cb){
        return w.thread.eval("JSON.stringify(window.ss.sheet.cells[" + (replace$.call(JSON.stringify(coord), /\s/g, '')) + "])", function(arg$, cell){
          if (cell === 'undefined') {
            return cb('null');
          } else {
            return cb(cell);
          }
        });
      };
      w.exportCells = function(cb){
        return w.thread.eval("JSON.stringify(window.ss.sheet.cells)", function(arg$, cells){
          return cb(cells);
        });
      };
      w.thread.eval(bootSC, function(){
        return w.postMessage({
          type: 'init',
          room: room,
          log: log,
          snapshot: snapshot
        });
      });
      return w;
    };
    return SC;
  };
}).call(this);
