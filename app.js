(() => {
  "use strict";

  const MAX_FILE_BYTES = 30 * 1024 * 1024;
  const MAX_SOURCE_PIXELS = 60_000_000;
  const MAX_TARGET_DIMENSION = 10_000;

  const $ = (id) => document.getElementById(id);
  const els = {
    fileInput: $("fileInput"), dropZone: $("dropZone"), filePreview: $("filePreview"), previewImage: $("previewImage"),
    fileName: $("fileName"), fileDetails: $("fileDetails"), changeFileButton: $("changeFileButton"), fileMessage: $("fileMessage"),
    requirementInput: $("requirementInput"), detectButton: $("detectButton"), characterCount: $("characterCount"), clearRulesButton: $("clearRulesButton"),
    formatSelect: $("formatSelect"), sizeRuleSelect: $("sizeRuleSelect"), sizeControls: $("sizeControls"), minSizeWrap: $("minSizeWrap"),
    minSizeInput: $("minSizeInput"), maxSizeInput: $("maxSizeInput"), sizeUnitSelect: $("sizeUnitSelect"), rangeSeparator: $("rangeSeparator"),
    dimensionRuleSelect: $("dimensionRuleSelect"), dimensionControls: $("dimensionControls"), widthInput: $("widthInput"), heightInput: $("heightInput"), fitModeSelect: $("fitModeSelect"),
    analysisCard: $("analysisCard"), comparisonList: $("comparisonList"), statusPanel: $("statusPanel"), statusTitle: $("statusTitle"), statusText: $("statusText"), statusBadge: $("statusBadge"), fixButton: $("fixButton"),
    processingCard: $("processingCard"), progressRing: $("progressRing"), progressText: $("progressText"), processingText: $("processingText"),
    successCard: $("successCard"), successDetails: $("successDetails"), resultIcon: $("resultIcon"), resultEyebrow: $("resultEyebrow"), resultTitle: $("resultTitle"), downloadButton: $("downloadButton"), startOverButton: $("startOverButton"), toast: $("toast")
  };

  const MIME_TO_FORMAT = { "image/jpeg": "JPG", "image/png": "PNG", "image/webp": "WEBP" };
  const FORMAT_TO_MIME = { JPG: "image/jpeg", PNG: "image/png", WEBP: "image/webp" };

  const state = {
    file: null, sourceUrl: null, outputUrl: null, width: 0, height: 0, format: null,
    parseWarnings: []
  };

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.remove("hidden");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => els.toast.classList.add("hidden"), 3500);
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes)) return "—";
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
    return `${(bytes / 1024).toFixed(bytes >= 100 * 1024 ? 0 : 1)} KB`;
  }

  function normalizeThaiDigits(value) {
    const digits = "๐๑๒๓๔๕๖๗๘๙";
    return String(value ?? "").replace(/[๐-๙]/g, ch => String(digits.indexOf(ch)));
  }

  function parseToBytes(value, unit) {
    const n = Number.parseFloat(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(n * (String(unit).toUpperCase() === "MB" ? 1024 * 1024 : 1024));
  }

  function bytesToDisplay(bytes) {
    if (!bytes) return null;
    if (bytes >= 1024 * 1024 && bytes % (1024 * 1024) === 0) return { value: bytes / (1024 * 1024), unit: "MB" };
    return { value: Math.round(bytes / 1024), unit: "KB" };
  }

  // Defensive parser: arbitrary text is never used directly by processing.
  // It only proposes structured values that the user can edit before running the fixer.
  function parseRequirementText(rawText) {
    const result = { format: null, minBytes: null, maxBytes: null, width: null, height: null, warnings: [] };
    try {
      let text = normalizeThaiDigits(rawText).slice(0, 2000);
      text = text.replace(/\u00a0/g, " ").replace(/[–—−]/g, "-").replace(/[,，]/g, "").replace(/\s+/g, " ").trim();
      if (!text) return result;

      const upper = text.toUpperCase();
      const formats = [];
      if (/\bJPE?G\b/.test(upper) || /\.JPE?G\b/.test(upper)) formats.push("JPG");
      if (/\bPNG\b/.test(upper) || /\.PNG\b/.test(upper)) formats.push("PNG");
      if (/\bWEBP\b/.test(upper) || /\.WEBP\b/.test(upper)) formats.push("WEBP");
      if (/\bHEIC\b|\bHEIF\b/.test(upper)) result.warnings.push("HEIC/HEIF is mentioned, but V2 does not convert HEIC yet.");
      if (formats.length === 1) result.format = formats[0];
      if (formats.length > 1) result.warnings.push("Multiple accepted formats were found. Choose the one you want below.");

      const dimMatch = text.match(/(?:ขนาด(?:รูป|ภาพ)?\s*)?(\d{2,5})\s*[xX×*]\s*(\d{2,5})\s*(?:px|pixels?|พิกเซล)?/i);
      if (dimMatch) {
        const w = Number.parseInt(dimMatch[1], 10), h = Number.parseInt(dimMatch[2], 10);
        if (w > 0 && h > 0 && w <= MAX_TARGET_DIMENSION && h <= MAX_TARGET_DIMENSION) { result.width = w; result.height = h; }
      }

      const rangeMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:-|ถึง|to)\s*(\d+(?:\.\d+)?)\s*(KB|MB)\b/i);
      if (rangeMatch) {
        result.minBytes = parseToBytes(rangeMatch[1], rangeMatch[3]);
        result.maxBytes = parseToBytes(rangeMatch[2], rangeMatch[3]);
        if (result.minBytes && result.maxBytes && result.minBytes > result.maxBytes) [result.minBytes, result.maxBytes] = [result.maxBytes, result.minBytes];
      }

      const maxPatterns = [
        /(?:ไม่เกิน|ไม่มากกว่า|สูงสุด|ขนาดไฟล์สูงสุด|maximum|max(?:imum)?|up to|under|less than|at most)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(KB|MB)\b/i,
        /(\d+(?:\.\d+)?)\s*(KB|MB)\s*(?:หรือน้อยกว่า|หรือต่ำกว่า|or less|max(?:imum)?)/i
      ];
      const minPatterns = [
        /(?:ไม่น้อยกว่า|อย่างน้อย|ขั้นต่ำ|minimum|min(?:imum)?|at least)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(KB|MB)\b/i,
        /(\d+(?:\.\d+)?)\s*(KB|MB)\s*(?:ขึ้นไป|หรือมากกว่า|or more|min(?:imum)?)/i
      ];

      if (!result.maxBytes) {
        for (const pattern of maxPatterns) {
          const m = text.match(pattern);
          if (m) { result.maxBytes = parseToBytes(m[1], m[2]); break; }
        }
      }
      if (!result.minBytes) {
        for (const pattern of minPatterns) {
          const m = text.match(pattern);
          if (m) { result.minBytes = parseToBytes(m[1], m[2]); break; }
        }
      }

      if (!result.minBytes && !result.maxBytes) {
        const standalone = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(KB|MB)\b/gi)];
        if (standalone.length === 1) {
          result.maxBytes = parseToBytes(standalone[0][1], standalone[0][2]);
          result.warnings.push("A single file size was interpreted as the maximum. Please verify it below.");
        } else if (standalone.length > 1) {
          result.warnings.push("Several file sizes were found, so no automatic size rule was applied.");
        }
      }
      return result;
    } catch (error) {
      console.warn("Requirement parser safely stopped:", error);
      result.warnings.push("Could not fully understand the text. Please choose the rules manually.");
      return result;
    }
  }

  function getStructuredRules() {
    const format = els.formatSelect.value;
    const sizeRule = els.sizeRuleSelect.value;
    const unit = els.sizeUnitSelect.value;
    const dimensionRule = els.dimensionRuleSelect.value;

    let minBytes = null, maxBytes = null;
    if (sizeRule === "MAX") maxBytes = parseToBytes(els.maxSizeInput.value, unit);
    if (sizeRule === "RANGE") {
      minBytes = parseToBytes(els.minSizeInput.value, unit);
      maxBytes = parseToBytes(els.maxSizeInput.value, unit);
    }

    const width = dimensionRule === "EXACT" ? Number.parseInt(els.widthInput.value, 10) : null;
    const height = dimensionRule === "EXACT" ? Number.parseInt(els.heightInput.value, 10) : null;

    return {
      format,
      minBytes,
      maxBytes,
      width: Number.isFinite(width) && width > 0 ? width : null,
      height: Number.isFinite(height) && height > 0 ? height : null,
      fitMode: els.fitModeSelect.value
    };
  }

  function validateRules(rules, showMessage = true) {
    const problems = [];
    if (rules.minBytes && rules.maxBytes && rules.minBytes > rules.maxBytes) problems.push("Minimum file size is larger than maximum file size.");
    if (els.sizeRuleSelect.value !== "NONE" && !rules.maxBytes) problems.push("Enter a valid maximum file size.");
    if (els.sizeRuleSelect.value === "RANGE" && !rules.minBytes) problems.push("Enter a valid minimum file size.");
    if (els.dimensionRuleSelect.value === "EXACT") {
      if (!rules.width || !rules.height) problems.push("Enter both width and height.");
      if ((rules.width || 0) > MAX_TARGET_DIMENSION || (rules.height || 0) > MAX_TARGET_DIMENSION) problems.push(`Dimensions must be ${MAX_TARGET_DIMENSION}px or less.`);
    }
    if (showMessage && problems.length) showToast(problems[0]);
    return problems;
  }

  function setControlsFromParsed(parsed) {
    if (parsed.format) els.formatSelect.value = parsed.format;

    if (parsed.minBytes && parsed.maxBytes) {
      els.sizeRuleSelect.value = "RANGE";
      const maxD = bytesToDisplay(parsed.maxBytes);
      const minD = bytesToDisplay(parsed.minBytes);
      const useMB = maxD.unit === "MB" && minD.unit === "MB";
      els.sizeUnitSelect.value = useMB ? "MB" : "KB";
      els.minSizeInput.value = useMB ? parsed.minBytes / (1024 * 1024) : Math.round(parsed.minBytes / 1024);
      els.maxSizeInput.value = useMB ? parsed.maxBytes / (1024 * 1024) : Math.round(parsed.maxBytes / 1024);
    } else if (parsed.maxBytes) {
      els.sizeRuleSelect.value = "MAX";
      const d = bytesToDisplay(parsed.maxBytes);
      els.sizeUnitSelect.value = d.unit;
      els.maxSizeInput.value = d.value;
      els.minSizeInput.value = "";
    }

    if (parsed.width && parsed.height) {
      els.dimensionRuleSelect.value = "EXACT";
      els.widthInput.value = parsed.width;
      els.heightInput.value = parsed.height;
    }
    state.parseWarnings = parsed.warnings || [];
    updateControlVisibility();
    evaluateFile();
    if (state.parseWarnings.length) showToast(state.parseWarnings[0]);
  }

  function clearRules() {
    els.formatSelect.value = "KEEP";
    els.sizeRuleSelect.value = "NONE";
    els.dimensionRuleSelect.value = "NONE";
    els.minSizeInput.value = "";
    els.maxSizeInput.value = "";
    els.widthInput.value = "";
    els.heightInput.value = "";
    els.fitModeSelect.value = "CONTAIN";
    state.parseWarnings = [];
    updateControlVisibility();
    evaluateFile();
  }

  function updateControlVisibility() {
    const sizeMode = els.sizeRuleSelect.value;
    els.sizeControls.classList.toggle("hidden", sizeMode === "NONE");
    els.minSizeWrap.classList.toggle("hidden", sizeMode !== "RANGE");
    els.rangeSeparator.classList.toggle("hidden", sizeMode !== "RANGE");
    els.dimensionControls.classList.toggle("hidden", els.dimensionRuleSelect.value !== "EXACT");
  }

  async function decodeImage(url) {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Image decode failed"));
      img.src = url;
    });
  }

  async function loadImageFile(file) {
    try {
      els.fileMessage.textContent = "";
      if (!file) return;
      if (!MIME_TO_FORMAT[file.type]) {
        showToast("V2 รองรับ JPG, PNG และ WEBP เท่านั้น");
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        showToast("ไฟล์ใหญ่เกิน 30 MB สำหรับเวอร์ชันนี้");
        return;
      }

      const url = URL.createObjectURL(file);
      let img;
      try { img = await decodeImage(url); }
      catch (error) { URL.revokeObjectURL(url); showToast("อ่านรูปนี้ไม่ได้ กรุณาลองไฟล์อื่น"); return; }

      const pixelCount = img.naturalWidth * img.naturalHeight;
      if (!img.naturalWidth || !img.naturalHeight || pixelCount > MAX_SOURCE_PIXELS) {
        URL.revokeObjectURL(url);
        showToast("รูปมีความละเอียดสูงเกินไปสำหรับการประมวลผลอย่างปลอดภัย");
        return;
      }

      if (state.sourceUrl) URL.revokeObjectURL(state.sourceUrl);
      state.sourceUrl = url;
      state.file = file;
      state.width = img.naturalWidth;
      state.height = img.naturalHeight;
      state.format = MIME_TO_FORMAT[file.type];

      els.previewImage.src = url;
      els.fileName.textContent = file.name;
      els.fileDetails.textContent = `${formatBytes(file.size)} · ${state.width} × ${state.height} px · ${state.format}`;
      els.dropZone.classList.add("hidden");
      els.filePreview.classList.remove("hidden");
      evaluateFile();
    } catch (error) {
      console.error(error);
      showToast("เกิดข้อผิดพลาดขณะเปิดไฟล์ แต่แอปยังทำงานต่อได้");
    }
  }

  function evaluateFile() {
    try {
      if (!state.file) { els.analysisCard.classList.add("hidden"); return; }
      const rules = getStructuredRules();
      if (validateRules(rules, false).length) { els.analysisCard.classList.add("hidden"); return; }

      const hasAnyRule = rules.format !== "KEEP" || rules.maxBytes || rules.minBytes || (rules.width && rules.height);
      if (!hasAnyRule) { els.analysisCard.classList.add("hidden"); return; }

      const checks = [];
      if (rules.format !== "KEEP") checks.push({ label: "รูปแบบไฟล์", current: state.format, required: rules.format, pass: state.format === rules.format });
      if (rules.minBytes || rules.maxBytes) {
        const pass = (!rules.minBytes || state.file.size >= rules.minBytes) && (!rules.maxBytes || state.file.size <= rules.maxBytes);
        const required = rules.minBytes && rules.maxBytes ? `${formatBytes(rules.minBytes)} – ${formatBytes(rules.maxBytes)}` : `≤ ${formatBytes(rules.maxBytes)}`;
        checks.push({ label: "ขนาดไฟล์", current: formatBytes(state.file.size), required, pass });
      }
      if (rules.width && rules.height) checks.push({ label: "ขนาดรูปภาพ", current: `${state.width} × ${state.height} px`, required: `${rules.width} × ${rules.height} px`, pass: state.width === rules.width && state.height === rules.height });

      els.comparisonList.textContent = "";
      checks.forEach(check => {
        const row = document.createElement("div"); row.className = "comparison-row";
        const label = document.createElement("span"); label.className = "comparison-label"; label.textContent = check.label;
        const current = document.createElement("strong"); current.className = "comparison-current"; current.textContent = check.current;
        const icon = document.createElement("span"); icon.className = `result-icon ${check.pass ? "pass" : "fail"}`; icon.textContent = check.pass ? "✓" : "×";
        const required = document.createElement("span"); required.className = "comparison-required"; required.textContent = check.required;
        row.append(label, current, icon, required); els.comparisonList.append(row);
      });

      const failed = checks.filter(c => !c.pass);
      const passed = checks.length > 0 && failed.length === 0;
      els.analysisCard.classList.remove("hidden");
      els.statusPanel.classList.toggle("is-fail", !passed);
      els.statusPanel.classList.toggle("is-pass", passed);
      if (passed) {
        els.statusTitle.textContent = "ไฟล์นี้ผ่านเงื่อนไขแล้ว";
        els.statusText.textContent = "No processing is needed.";
        els.statusBadge.textContent = "PASS";
        els.fixButton.classList.add("hidden");
      } else {
        els.statusTitle.textContent = "ไฟล์ยังไม่ตรงตามข้อกำหนด";
        els.statusText.textContent = `${failed.length} รายการที่ต้องแก้ไข · ${failed.length} item${failed.length > 1 ? "s" : ""} need fixing`;
        els.statusBadge.textContent = `${failed.length} FIX`;
        els.fixButton.classList.remove("hidden");
      }
    } catch (error) {
      console.error("Evaluation stopped safely:", error);
      els.analysisCard.classList.add("hidden");
      showToast("ตรวจเงื่อนไขไม่ได้ กรุณาเลือกค่าเอง");
    }
  }

  function drawImageToCanvas(source, width, height, fitMode, transparent = false) {
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: transparent });
    if (!ctx) throw new Error("Canvas is unavailable");
    if (!transparent) { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, width, height); }
    const sw = source.naturalWidth, sh = source.naturalHeight;
    const scale = fitMode === "COVER" ? Math.max(width / sw, height / sh) : Math.min(width / sw, height / sh);
    const dw = sw * scale, dh = sh * scale;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, (width - dw) / 2, (height - dh) / 2, dw, dh);
    return canvas;
  }

  function canvasToBlob(canvas, mime, quality) {
    return new Promise((resolve, reject) => {
      try { canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Encoding failed")), mime, quality); }
      catch (error) { reject(error); }
    });
  }

  async function bestQualityUnder(canvas, mime, maxBytes, minBytes = null) {
    let low = 0.18, high = 0.98, best = null;
    for (let i = 0; i < 12; i++) {
      const quality = (low + high) / 2;
      const blob = await canvasToBlob(canvas, mime, quality);
      if (blob.size <= maxBytes) { best = blob; low = quality; }
      else high = quality;
    }
    if (!best) best = await canvasToBlob(canvas, mime, 0.12);
    if (minBytes && best.size < minBytes) {
      for (const q of [1, .99, .97, .95, .92]) {
        const candidate = await canvasToBlob(canvas, mime, q);
        if (candidate.size >= minBytes && candidate.size <= maxBytes) { best = candidate; break; }
      }
    }
    return best;
  }

  async function processImage() {
    try {
      if (!state.file || !state.sourceUrl) return;
      const rules = getStructuredRules();
      if (validateRules(rules, true).length) return;

      els.fixButton.disabled = true;
      els.processingCard.classList.remove("hidden");
      els.successCard.classList.add("hidden");
      els.processingCard.scrollIntoView({ behavior: "smooth", block: "center" });

      const progress = (n, text) => {
        els.progressRing.style.setProperty("--progress", n);
        els.progressText.textContent = `${n}%`;
        if (text) els.processingText.textContent = text;
      };

      progress(10, "Reading the image…");
      const source = await decodeImage(state.sourceUrl);

      const targetFormat = rules.format === "KEEP" ? state.format : rules.format;
      const mime = FORMAT_TO_MIME[targetFormat];
      if (!mime) throw new Error("Unsupported output format");

      let targetW = rules.width || state.width;
      let targetH = rules.height || state.height;
      const hasExactDims = Boolean(rules.width && rules.height);
      const transparent = mime !== "image/jpeg";
      let canvas = drawImageToCanvas(source, targetW, targetH, hasExactDims ? rules.fitMode : "CONTAIN", transparent);
      progress(34, "Applying format and dimensions…");

      let blob;
      if (mime === "image/png") {
        blob = await canvasToBlob(canvas, mime);
        progress(58, "Optimizing PNG…");
        if (rules.maxBytes && blob.size > rules.maxBytes && !hasExactDims) {
          let scale = .92;
          for (let i = 0; i < 14 && blob.size > rules.maxBytes; i++) {
            targetW = Math.max(1, Math.round(state.width * scale));
            targetH = Math.max(1, Math.round(state.height * scale));
            canvas = drawImageToCanvas(source, targetW, targetH, "CONTAIN", true);
            blob = await canvasToBlob(canvas, mime);
            scale *= .9;
          }
        }
      } else if (rules.maxBytes) {
        progress(58, "Finding the best quality under the size limit…");
        blob = await bestQualityUnder(canvas, mime, rules.maxBytes, rules.minBytes);
        if (blob.size > rules.maxBytes && !hasExactDims) {
          let scale = .9;
          for (let i = 0; i < 14 && blob.size > rules.maxBytes; i++) {
            targetW = Math.max(1, Math.round(state.width * scale));
            targetH = Math.max(1, Math.round(state.height * scale));
            canvas = drawImageToCanvas(source, targetW, targetH, "CONTAIN", false);
            blob = await bestQualityUnder(canvas, mime, rules.maxBytes, rules.minBytes);
            scale *= .9;
          }
        }
      } else {
        blob = await canvasToBlob(canvas, mime, mime === "image/png" ? undefined : .92);
      }

      progress(82, "Verifying the result…");
      if (!blob) throw new Error("No output blob");

      const sizePass = (!rules.minBytes || blob.size >= rules.minBytes) && (!rules.maxBytes || blob.size <= rules.maxBytes);
      const dimensionPass = (!rules.width || (targetW === rules.width && targetH === rules.height));
      const warnings = [];
      if (!sizePass) {
        if (rules.minBytes && blob.size < rules.minBytes) warnings.push("The output is smaller than the requested minimum. We avoid adding fake data just to inflate the file.");
        if (rules.maxBytes && blob.size > rules.maxBytes) warnings.push("The exact dimensions and format make the requested maximum size difficult to reach safely.");
      }
      if (!dimensionPass) warnings.push("The requested pixel dimensions could not be matched.");

      if (state.outputUrl) URL.revokeObjectURL(state.outputUrl);
      state.outputUrl = URL.createObjectURL(blob);
      const ext = targetFormat === "JPG" ? "jpg" : targetFormat.toLowerCase();
      const stem = state.file.name.replace(/\.[^.]+$/, "") || "image";
      els.downloadButton.href = state.outputUrl;
      els.downloadButton.download = `${stem}-ready.${ext}`;

      progress(100, "Done.");
      await new Promise(resolve => setTimeout(resolve, 220));
      els.processingCard.classList.add("hidden");
      els.successCard.classList.remove("hidden");
      const fullyPassed = warnings.length === 0;
      els.successCard.classList.toggle("needs-review", !fullyPassed);
      els.resultIcon.textContent = fullyPassed ? "✓" : "!";
      els.resultEyebrow.textContent = fullyPassed ? "READY TO UPLOAD" : "BEST RESULT — REVIEW NEEDED";
      els.resultTitle.textContent = fullyPassed ? "พร้อมอัปโหลด" : "กรุณาตรวจสอบอีกครั้ง";
      els.successDetails.textContent = `${formatBytes(blob.size)} · ${targetW} × ${targetH} px · ${targetFormat}${fullyPassed ? ". All selected rules matched." : `. ${warnings[0]}`}`;
      els.successCard.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (error) {
      console.error("Processing stopped safely:", error);
      els.processingCard.classList.add("hidden");
      showToast("ไม่สามารถประมวลผลไฟล์นี้ได้ แต่แอปไม่เสียหาย กรุณาลองไฟล์หรือเงื่อนไขอื่น");
    } finally {
      els.fixButton.disabled = false;
    }
  }

  function resetAll() {
    if (state.sourceUrl) URL.revokeObjectURL(state.sourceUrl);
    if (state.outputUrl) URL.revokeObjectURL(state.outputUrl);
    Object.assign(state, { file: null, sourceUrl: null, outputUrl: null, width: 0, height: 0, format: null, parseWarnings: [] });
    els.fileInput.value = ""; els.previewImage.removeAttribute("src"); els.filePreview.classList.add("hidden"); els.dropZone.classList.remove("hidden");
    els.requirementInput.value = ""; els.characterCount.textContent = "0 / 2000"; clearRules();
    els.analysisCard.classList.add("hidden"); els.processingCard.classList.add("hidden"); els.successCard.classList.add("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Tabs
  document.querySelectorAll(".mode-tab").forEach(tab => tab.addEventListener("click", () => {
    document.querySelectorAll(".mode-tab").forEach(t => { t.classList.toggle("active", t === tab); t.setAttribute("aria-selected", String(t === tab)); });
    document.querySelectorAll(".mode-panel").forEach(panel => panel.classList.add("hidden"));
    $(tab.dataset.panel).classList.remove("hidden");
  }));

  // File selection + drag/drop
  els.dropZone.addEventListener("click", () => els.fileInput.click());
  els.changeFileButton.addEventListener("click", () => els.fileInput.click());
  els.fileInput.addEventListener("change", e => loadImageFile(e.target.files?.[0]));
  ["dragenter", "dragover"].forEach(type => els.dropZone.addEventListener(type, e => { e.preventDefault(); els.dropZone.classList.add("dragging"); }));
  ["dragleave", "drop"].forEach(type => els.dropZone.addEventListener(type, e => { e.preventDefault(); els.dropZone.classList.remove("dragging"); }));
  els.dropZone.addEventListener("drop", e => loadImageFile(e.dataTransfer?.files?.[0]));

  // Requirement parsing. Parsing is only advisory; structured controls are authoritative.
  els.requirementInput.addEventListener("input", () => { els.characterCount.textContent = `${els.requirementInput.value.length} / 2000`; });
  els.detectButton.addEventListener("click", () => {
    const parsed = parseRequirementText(els.requirementInput.value);
    setControlsFromParsed(parsed);
    if (!parsed.format && !parsed.minBytes && !parsed.maxBytes && !parsed.width) showToast("ยังอ่านเงื่อนไขไม่ได้ กรุณาใช้แท็บ ‘เลือกเอง’");
  });

  els.clearRulesButton.addEventListener("click", clearRules);
  [els.formatSelect, els.sizeRuleSelect, els.minSizeInput, els.maxSizeInput, els.sizeUnitSelect, els.dimensionRuleSelect, els.widthInput, els.heightInput, els.fitModeSelect].forEach(el => {
    el.addEventListener("change", () => { updateControlVisibility(); evaluateFile(); });
    if (el.tagName === "INPUT") el.addEventListener("input", evaluateFile);
  });

  els.fixButton.addEventListener("click", processImage);
  els.startOverButton.addEventListener("click", resetAll);
  updateControlVisibility();
})();
