/**
 * ICS Calendar Download — client-side .ics file generation.
 *
 * Reads holiday / school-holiday data embedded as JSON in the page,
 * filters by user checkbox selection, builds an RFC 5545 compliant
 * ICS string, and triggers a Blob download.
 */

(function () {
  "use strict";

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */

  /** YYYY-MM-DD → YYYYMMDD */
  function formatDate(dateStr) {
    return dateStr.replace(/-/g, "");
  }

  /** For all-day DTEND the spec requires the *next* day. */
  function nextDay(dateStr) {
    var d = new Date(dateStr + "T00:00:00");
    d.setDate(d.getDate() + 1);
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + m + day;
  }

  /** Slugify a string for use in UIDs. */
  function slugify(str) {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  /** Fold lines longer than 75 octets (RFC 5545 §3.1). */
  function foldLine(line) {
    if (line.length <= 75) return line;
    var parts = [];
    parts.push(line.substring(0, 75));
    var rest = line.substring(75);
    while (rest.length > 0) {
      parts.push(" " + rest.substring(0, 74));
      rest = rest.substring(74);
    }
    return parts.join("\r\n");
  }

  /* ------------------------------------------------------------------ */
  /*  ICS builder                                                        */
  /* ------------------------------------------------------------------ */

  function buildIcs(events, calendarName, domain) {
    var lines = [];
    lines.push("BEGIN:VCALENDAR");
    lines.push("VERSION:2.0");
    lines.push("PRODID:-//" + domain + "//Calendar//EN");
    lines.push("CALSCALE:GREGORIAN");
    lines.push("METHOD:PUBLISH");
    lines.push("X-WR-CALNAME:" + calendarName);

    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      lines.push("BEGIN:VEVENT");
      lines.push("UID:" + ev.uid + "@" + domain);
      lines.push("DTSTART;VALUE=DATE:" + ev.dtstart);
      lines.push("DTEND;VALUE=DATE:" + ev.dtend);
      lines.push(foldLine("SUMMARY:" + ev.summary));
      lines.push("CATEGORIES:" + ev.category);
      lines.push("TRANSP:TRANSPARENT");
      lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");
    return lines.join("\r\n");
  }

  /* ------------------------------------------------------------------ */
  /*  Download trigger                                                   */
  /* ------------------------------------------------------------------ */

  function downloadBlob(content, filename) {
    var blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /* ------------------------------------------------------------------ */
  /*  Form handling                                                      */
  /* ------------------------------------------------------------------ */

  function handleSubmit(form) {
    var dataEl = form.querySelector("[data-ics-json]");
    if (!dataEl) return;

    var data;
    try {
      data = JSON.parse(dataEl.textContent);
    } catch (e) {
      return;
    }

    var includeHolidays = form.querySelector('[name="include_holidays"]');
    var includeObservances = form.querySelector('[name="include_observances"]');
    var includeSchool = form.querySelector('[name="include_school_holidays"]');

    var events = [];

    // Public holidays
    if (includeHolidays && includeHolidays.checked && data.holidays) {
      for (var i = 0; i < data.holidays.length; i++) {
        var h = data.holidays[i];
        if (h.type === "public") {
          events.push({
            uid: formatDate(h.date) + "-" + slugify(h.name),
            dtstart: formatDate(h.date),
            dtend: nextDay(h.date),
            summary: h.name,
            category: "HOLIDAY",
          });
        }
      }
    }

    // Observances
    if (includeObservances && includeObservances.checked && data.holidays) {
      for (var i = 0; i < data.holidays.length; i++) {
        var h = data.holidays[i];
        if (h.type === "observance") {
          events.push({
            uid: formatDate(h.date) + "-" + slugify(h.name),
            dtstart: formatDate(h.date),
            dtend: nextDay(h.date),
            summary: h.name,
            category: "OBSERVANCE",
          });
        }
      }
    }

    // School holidays
    if (includeSchool && includeSchool.checked && data.school_holidays) {
      // Determine selected regions
      var selectedRegions = {};
      var regionCheckboxes = form.querySelectorAll('[name="region"]');
      if (regionCheckboxes.length > 0) {
        for (var i = 0; i < regionCheckboxes.length; i++) {
          if (regionCheckboxes[i].checked) {
            selectedRegions[regionCheckboxes[i].value] = true;
          }
        }
      } else {
        // No region checkboxes — include all
        for (var i = 0; i < data.school_holidays.length; i++) {
          var sh = data.school_holidays[i];
          for (var j = 0; j < sh.regions.length; j++) {
            selectedRegions[sh.regions[j]] = true;
          }
        }
      }

      // Build region name lookup
      var regionNames = {};
      if (data.regions) {
        for (var i = 0; i < data.regions.length; i++) {
          regionNames[data.regions[i].id] = data.regions[i].name;
        }
      }

      for (var i = 0; i < data.school_holidays.length; i++) {
        var sh = data.school_holidays[i];
        // Check if any of the holiday's regions are selected
        var matchedRegions = [];
        for (var j = 0; j < sh.regions.length; j++) {
          if (selectedRegions[sh.regions[j]]) {
            matchedRegions.push(sh.regions[j]);
          }
        }
        if (matchedRegions.length === 0) continue;

        var regionLabel = matchedRegions
          .map(function (r) { return regionNames[r] || r; })
          .join(", ");
        var summary = sh.name + " (" + regionLabel + ")";

        events.push({
          uid: formatDate(sh.start) + "-" + slugify(sh.name) + "-" + slugify(matchedRegions.join("-")),
          dtstart: formatDate(sh.start),
          dtend: nextDay(sh.end),
          summary: summary,
          category: "SCHOOL_HOLIDAY",
        });
      }
    }

    if (events.length === 0) return;

    var calendarName = data.calendar_name || "Calendar";
    var domain = data.domain || "calendar.local";
    var filename = (data.filename || "calendar") + ".ics";

    var icsContent = buildIcs(events, calendarName, domain);
    downloadBlob(icsContent, filename);
  }

  /* ------------------------------------------------------------------ */
  /*  Checkbox state management                                          */
  /* ------------------------------------------------------------------ */

  function updateFormState(form) {
    var contentBoxes = form.querySelectorAll(
      '[name="include_holidays"], [name="include_observances"], [name="include_school_holidays"]'
    );
    var anyChecked = false;
    for (var i = 0; i < contentBoxes.length; i++) {
      if (contentBoxes[i].checked) {
        anyChecked = true;
        break;
      }
    }

    var submitBtn = form.querySelector("[data-ics-submit]");
    var noSelMsg = form.querySelector("[data-ics-no-selection]");

    if (submitBtn) {
      submitBtn.disabled = !anyChecked;
      if (anyChecked) {
        submitBtn.classList.remove("btn-disabled");
      } else {
        submitBtn.classList.add("btn-disabled");
      }
    }
    if (noSelMsg) {
      noSelMsg.style.display = anyChecked ? "none" : "";
    }

    // Toggle region selector visibility
    var schoolCheckbox = form.querySelector('[name="include_school_holidays"]');
    var regionPanel = form.querySelector("[data-ics-regions]");
    if (regionPanel && schoolCheckbox) {
      regionPanel.style.display = schoolCheckbox.checked ? "" : "none";
    }
  }

  function handleAllRegions(form) {
    var allCheckbox = form.querySelector('[name="region_all"]');
    var regionBoxes = form.querySelectorAll('[name="region"]');
    if (!allCheckbox) return;

    allCheckbox.addEventListener("change", function () {
      for (var i = 0; i < regionBoxes.length; i++) {
        regionBoxes[i].checked = allCheckbox.checked;
      }
    });

    // Uncheck "all" if any individual region is unchecked
    for (var i = 0; i < regionBoxes.length; i++) {
      regionBoxes[i].addEventListener("change", function () {
        var allChecked = true;
        for (var j = 0; j < regionBoxes.length; j++) {
          if (!regionBoxes[j].checked) {
            allChecked = false;
            break;
          }
        }
        allCheckbox.checked = allChecked;
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Initialise                                                         */
  /* ------------------------------------------------------------------ */

  function initIcsDownload() {
    var forms = document.querySelectorAll("[data-ics-form]");

    for (var idx = 0; idx < forms.length; idx++) {
      (function (form) {
        // Attach submit handler
        form.addEventListener("submit", function (e) {
          e.preventDefault();
          handleSubmit(form);
        });

        // Attach checkbox change handlers
        var checkboxes = form.querySelectorAll(
          '[name="include_holidays"], [name="include_observances"], [name="include_school_holidays"]'
        );
        for (var i = 0; i < checkboxes.length; i++) {
          checkboxes[i].addEventListener("change", function () {
            updateFormState(form);
          });
        }

        // Region "all" toggle
        handleAllRegions(form);

        // Set initial state
        updateFormState(form);
      })(forms[idx]);
    }
  }

  // Run on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initIcsDownload);
  } else {
    initIcsDownload();
  }
})();
