/* Cut It Out — client-side manual cutout tool.
 * 100% in-browser. No network calls, no uploads. All processing on <canvas>.
 *
 * Perf model:
 *  - Brush strokes read ImageData ONCE on pointerdown, mutate the buffer in place
 *    across the whole stroke, putImageData per move, and drop the buffer on pointerup.
 *    (Previous version re-read the full frame every mousemove — jank on large photos.)
 *  - Magic wand reads the current frame, works on a copy, and only commits + pushes
 *    undo if pixels actually changed.
 *  - Pointer Events used throughout to avoid touch->synthetic-mouse double-fire.
 *
 * NOT YET TESTED — verify flood-fill accuracy, hi-DPI/scaled coordinate mapping,
 * touch input, and large-image memory before shipping.
 */
(function () {
  "use strict";

  var canvas = document.getElementById("canvas");
  var ctx = canvas.getContext("2d", { willReadFrequently: true });
  var hint = document.getElementById("canvasHint");
  var fileInput = document.getElementById("fileInput");
  var dropzone = document.getElementById("dropzone");
  var toolButtons = document.getElementById("toolButtons");

  var toleranceEl = document.getElementById("tolerance");
  var brushSizeEl = document.getElementById("brushSize");

  var currentTool = "wand";
  var originalImageData = null;   // pristine copy for Restore + Reset
  var undoStack = [];             // ImageData snapshots (cap to limit memory)
  var UNDO_LIMIT = 15;

  var painting = false;
  var strokeData = null;          // live ImageData mutated during a brush stroke
  var activePointerId = null;

  document.getElementById("year").textContent = new Date().getFullYear();

  // ---- Load image ----
  function loadImageFile(file) {
    if (!file || !/^image\//.test(file.type)) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        undoStack = [];
        canvas.style.display = "block";
        hint.style.display = "none";
        toolButtons.hidden = false;
      };
      img.src = e.target.result; // data URL, stays local
    };
    reader.readAsDataURL(file);
  }

  fileInput.addEventListener("change", function () {
    if (fileInput.files[0]) loadImageFile(fileInput.files[0]);
  });

  ["dragenter", "dragover"].forEach(function (t) {
    dropzone.addEventListener(t, function (e) { e.preventDefault(); dropzone.classList.add("drag"); });
  });
  ["dragleave", "drop"].forEach(function (t) {
    dropzone.addEventListener(t, function (e) { e.preventDefault(); dropzone.classList.remove("drag"); });
  });
  dropzone.addEventListener("drop", function (e) {
    if (e.dataTransfer.files[0]) loadImageFile(e.dataTransfer.files[0]);
  });

  // ---- Tool selection ----
  document.querySelectorAll(".tool-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".tool-btn").forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      currentTool = btn.dataset.tool;
    });
  });

  // ---- Undo / Reset ----
  function pushUndo(snapshot) {
    // snapshot is the pre-change ImageData to be able to revert.
    undoStack.push(snapshot);
    if (undoStack.length > UNDO_LIMIT) undoStack.shift();
  }
  document.getElementById("undoBtn").addEventListener("click", function () {
    var prev = undoStack.pop();
    if (prev) ctx.putImageData(prev, 0, 0);
  });
  document.getElementById("resetBtn").addEventListener("click", function () {
    if (originalImageData) {
      pushUndo(ctx.getImageData(0, 0, canvas.width, canvas.height));
      ctx.putImageData(originalImageData, 0, 0);
    }
  });

  // ---- Coordinate mapping (CSS-scaled canvas -> pixel space) ----
  function eventToPixel(e) {
    var rect = canvas.getBoundingClientRect();
    var x = (e.clientX - rect.left) * (canvas.width / rect.width);
    var y = (e.clientY - rect.top) * (canvas.height / rect.height);
    return { x: Math.floor(x), y: Math.floor(y) };
  }

  // ---- Magic wand: flood-fill erase connected similar-color pixels.
  //      Mutates the passed ImageData; returns true if any pixel changed. ----
  function magicWand(imgData, startX, startY, tolerance) {
    var w = canvas.width, h = canvas.height;
    if (startX < 0 || startY < 0 || startX >= w || startY >= h) return false;
    var data = imgData.data;
    var start = (startY * w + startX) * 4;
    if (data[start + 3] === 0) return false; // already transparent -> no-op
    var r0 = data[start], g0 = data[start + 1], b0 = data[start + 2];
    var tol2 = tolerance * tolerance * 3; // squared-distance threshold across 3 channels
    var visited = new Uint8Array(w * h);
    var stack = [startX, startY];
    var changed = false;

    while (stack.length) {
      var y = stack.pop();
      var x = stack.pop();
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      var p = y * w + x;
      if (visited[p]) continue;
      visited[p] = 1;
      var i = p * 4;
      if (data[i + 3] === 0) continue;
      var dr = data[i] - r0, dg = data[i + 1] - g0, db = data[i + 2] - b0;
      if (dr * dr + dg * dg + db * db > tol2) continue;
      data[i + 3] = 0; // erase
      changed = true;
      stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
    }
    return changed;
  }

  // ---- Brush: mutate the live stroke buffer in a circular radius (no I/O here) ----
  function applyBrushTo(data, cx, cy, radius, mode) {
    var w = canvas.width, h = canvas.height;
    var orig = originalImageData ? originalImageData.data : null;
    var r2 = radius * radius;
    var x0 = Math.max(0, cx - radius), x1 = Math.min(w - 1, cx + radius);
    var y0 = Math.max(0, cy - radius), y1 = Math.min(h - 1, cy + radius);
    for (var y = y0; y <= y1; y++) {
      for (var x = x0; x <= x1; x++) {
        var dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy > r2) continue;
        var i = (y * w + x) * 4;
        if (mode === "erase") {
          data[i + 3] = 0;
        } else if (mode === "restore" && orig) {
          data[i] = orig[i]; data[i + 1] = orig[i + 1];
          data[i + 2] = orig[i + 2]; data[i + 3] = orig[i + 3];
        }
      }
    }
  }

  // ---- Pointer handling (single unified path, no mouse/touch double-fire) ----
  function onDown(e) {
    if (!canvas.width || canvas.style.display === "none") return;
    if (activePointerId !== null) return; // ignore secondary pointers
    e.preventDefault();
    activePointerId = e.pointerId;
    if (canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch (_) {} }

    var p = eventToPixel(e);
    var w = canvas.width, h = canvas.height;

    if (currentTool === "wand") {
      var before = ctx.getImageData(0, 0, w, h);
      // work on a copy so `before` stays intact for undo
      var working = new ImageData(new Uint8ClampedArray(before.data), w, h);
      var changed = magicWand(working, p.x, p.y, parseInt(toleranceEl.value, 10));
      if (changed) {
        pushUndo(before);
        ctx.putImageData(working, 0, 0);
      }
      // wand is a single click; release immediately
      endStroke(e);
    } else {
      // brush: snapshot for undo, then read the frame ONCE for the whole stroke
      pushUndo(ctx.getImageData(0, 0, w, h));
      painting = true;
      strokeData = ctx.getImageData(0, 0, w, h);
      applyBrushTo(strokeData.data, p.x, p.y, parseInt(brushSizeEl.value, 10) / 2, currentTool);
      ctx.putImageData(strokeData, 0, 0);
    }
  }

  function onMove(e) {
    if (!painting || strokeData === null || e.pointerId !== activePointerId) return;
    e.preventDefault();
    var p = eventToPixel(e);
    applyBrushTo(strokeData.data, p.x, p.y, parseInt(brushSizeEl.value, 10) / 2, currentTool);
    ctx.putImageData(strokeData, 0, 0);
  }

  function endStroke(e) {
    painting = false;
    strokeData = null;
    if (e && canvas.releasePointerCapture && activePointerId !== null) {
      try { canvas.releasePointerCapture(activePointerId); } catch (_) {}
    }
    activePointerId = null;
  }

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", endStroke);
  canvas.addEventListener("pointercancel", endStroke);

  // ---- Export ----
  function download(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  document.getElementById("exportPng").addEventListener("click", function () {
    if (!canvas.width) return;
    canvas.toBlob(function (b) { if (b) download(b, "cutout.png"); }, "image/png");
  });
  document.getElementById("exportWhite").addEventListener("click", function () {
    if (!canvas.width) return;
    var tmp = document.createElement("canvas");
    tmp.width = canvas.width; tmp.height = canvas.height;
    var tctx = tmp.getContext("2d");
    tctx.fillStyle = "#ffffff";
    tctx.fillRect(0, 0, tmp.width, tmp.height);
    tctx.drawImage(canvas, 0, 0);
    tmp.toBlob(function (b) { if (b) download(b, "cutout-white.png"); }, "image/png");
  });
})();
