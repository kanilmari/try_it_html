/*
 * vkBeautify - javascript plugin to pretty-print or minify text (JSON, XML, CSS, SQL)
 * Author: Vadim Kiryukhin (http://www.eslinstructor.net/vkbeautify/)
 * License: MIT
 *
 * This file includes only the XML/HTML formatting helpers used by the HTML formatter tab.
 */
(function() {
  function createShiftArr(step) {
    var space = "";
    if (isNaN(parseInt(step))) {
      space = step;
    } else {
      space = new Array(step + 1).join(" ");
    }

    var shift = ["\n"]; // array of shifts
    for (var ix = 0; ix < 100; ix++) {
      shift.push(shift[ix] + space);
    }
    return shift;
  }

  function vkbeautify() {
    this.step = "  ";
    this.shift = createShiftArr(this.step);
  }

  vkbeautify.prototype.xml = function(text, step) {
    var ar = text
      .replace(/\r|\n/g, "")
      .replace(/>(\s{0,})</g, "><")
      .replace(/</g, "~::~<")
      .split("~::~");
    var len = ar.length,
      inComment = false,
      deep = 0,
      str = "",
      shift = step ? createShiftArr(step) : this.shift;

    for (var ix = 0; ix < len; ix++) {
      // start comment or <![CDATA[...]]> or <!DOCTYPE
      if (ar[ix].search(/<!/) > -1) {
        str += shift[deep] + ar[ix];
        inComment = true;
        if (ar[ix].search(/-->/) > -1 || ar[ix].search(/\]>/) > -1 || ar[ix].search(/!DOCTYPE/) > -1) {
          inComment = false;
        }
      } else if (ar[ix].search(/-->/) > -1 || ar[ix].search(/\]>/) > -1) {
        str += ar[ix];
        inComment = false;
      } else if (/^<\w/.test(ar[ix - 1]) && /^<\/\w/.test(ar[ix]) && /^<\/[\w\.:_-]+>/.test(ar[ix])) {
        str += ar[ix];
        if (!inComment) deep--;
      } else if (ar[ix].search(/^<\//) > -1) {
        str += shift[--deep] + ar[ix];
      } else if (ar[ix].match(/^<[^!?]([^>]*)?>$/)) {
        str += shift[deep++] + ar[ix];
      } else {
        str += shift[deep] + ar[ix];
      }
    }

    return str.trim();
  };

  vkbeautify.prototype.html = function(text, step) {
    // HTML is close enough to XML for indentation purposes here
    return this.xml(text, step);
  };

  window.vkbeautify = new vkbeautify();
})();
