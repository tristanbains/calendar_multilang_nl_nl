/**
 * Home page — fully client-side rendered using browser Date + /data/{year}.json
 */

document.addEventListener('DOMContentLoaded', function () {
    if (!document.getElementById('home')) return;
    initHomePage();
});

function initHomePage() {
    var now = new Date();
    var year = now.getFullYear();
    var month = now.getMonth() + 1; // 1-indexed

    renderTodayWidget(now);
    renderMonthCalendar(year, month);
    updateNavLinks(year);
    renderUpcomingMoon(year);
}

/**
 * ISO 8601 week number
 */
function getISOWeek(d) {
    var date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
    var week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

/**
 * Pad number to 2 digits
 */
function pad(n) {
    return n < 10 ? '0' + n : '' + n;
}

/**
 * Format ISO date string from year, month, day
 */
function isoDate(y, m, d) {
    return y + '-' + pad(m) + '-' + pad(d);
}

/**
 * 1. Today widget
 */
function renderTodayWidget(now) {
    var t = window.CALENDAR_TRANSLATIONS;
    var cfg = window.HOME_CONFIG;
    if (!t) return;

    var monthKeys = ['january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december'];
    var weekdayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    var day = now.getDate();
    var monthName = t.months[monthKeys[now.getMonth()]];
    var year = now.getFullYear();
    var weekdayName = t.weekdays[weekdayKeys[now.getDay()]];
    var weekNum = getISOWeek(now);

    var labelEl = document.getElementById('home-today-label');
    var dateEl = document.getElementById('home-today-date');
    var weekdayEl = document.getElementById('home-today-weekday');
    var weekEl = document.getElementById('home-today-week');

    if (labelEl && cfg) labelEl.textContent = cfg.today_label;
    if (dateEl) dateEl.textContent = day + ' ' + monthName + ' ' + year;
    if (weekdayEl) weekdayEl.textContent = weekdayName;
    if (weekEl) weekEl.textContent = t.week_name + ' ' + weekNum;
}

/**
 * 2. Current month calendar (replicates month_card macro)
 */
async function renderMonthCalendar(year, month) {
    var cfg = window.HOME_CONFIG;
    var t = window.CALENDAR_TRANSLATIONS;
    if (!cfg || !t) return;

    var container = document.getElementById('home-calendar');
    if (!container) return;

    // Month info
    var monthKeys = ['january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december'];
    var monthName = t.months[monthKeys[month - 1]];
    var monthSlug = cfg.month_slugs[month - 1];

    // First weekday (Monday=0) and days in month
    var firstDay = new Date(year, month - 1, 1);
    var startWeekday = (firstDay.getDay() + 6) % 7; // Monday=0
    var daysInMonth = new Date(year, month, 0).getDate();
    var prevMonthDays = new Date(year, month - 1, 0).getDate();

    // Fetch day data
    var dayData = {};
    if (typeof getDayData === 'function') {
        // Pre-fetch the entire year
        try {
            var resp = await fetch('/data/' + year + '.json');
            if (resp.ok) {
                dayData = await resp.json();
                // Also populate the global cache used by calendar.js tooltips
                if (typeof dayDataCache !== 'undefined') dayDataCache[year] = dayData;
            }
        } catch (e) { /* ignore */ }
    }

    var today = new Date();
    var todayISO = isoDate(today.getFullYear(), today.getMonth() + 1, today.getDate());

    // Build week rows
    var weeks = [];
    var dayIndex = 1;
    var nextMonthDay = 1;

    // Calculate total cells needed
    var totalDays = startWeekday + daysInMonth;
    var totalWeeks = Math.ceil(totalDays / 7);

    for (var w = 0; w < totalWeeks; w++) {
        var weekDays = [];
        for (var wd = 0; wd < 7; wd++) {
            var cellIndex = w * 7 + wd;
            var cellDay, cellMonth, cellYear, isCurrentMonth;

            if (cellIndex < startWeekday) {
                // Previous month
                cellDay = prevMonthDays - startWeekday + cellIndex + 1;
                cellMonth = month - 1 || 12;
                cellYear = month === 1 ? year - 1 : year;
                isCurrentMonth = false;
            } else if (dayIndex > daysInMonth) {
                // Next month
                cellDay = nextMonthDay++;
                cellMonth = month + 1 > 12 ? 1 : month + 1;
                cellYear = month === 12 ? year + 1 : year;
                isCurrentMonth = false;
            } else {
                cellDay = dayIndex++;
                cellMonth = month;
                cellYear = year;
                isCurrentMonth = true;
            }

            var dateStr = isoDate(cellYear, cellMonth, cellDay);
            var dd = dayData[dateStr] || null;
            var isToday = dateStr === todayISO && isCurrentMonth;
            var isWeekend = (wd === 5 || wd === 6) && isCurrentMonth;
            var isHoliday = dd && dd.holidays && dd.holidays.some(function (h) { return h.type === 'public'; }) && isCurrentMonth;
            var isSchool = dd && dd.school && dd.school.length > 0 && isCurrentMonth;
            var moonEvent = dd && dd.moon && isCurrentMonth ? dd.moon : null;

            var cls = 'cal-day';
            if (!isCurrentMonth) cls += ' cal-day--other';
            if (isToday) cls += ' cal-day--today';
            if (isWeekend && !isToday) cls += ' cal-day--weekend';
            if (isHoliday) cls += ' cal-day--holiday';
            if (isSchool && !isToday) cls += ' cal-day--school';

            var weekdayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
            var cellDate = new Date(cellYear, cellMonth - 1, cellDay);
            var weekNumber = getISOWeek(cellDate);

            var moonHTML = '';
            if (moonEvent) {
                var moonEmojis = { new_moon: '\uD83C\uDF11', first_quarter: '\uD83C\uDF13', full_moon: '\uD83C\uDF15', last_quarter: '\uD83C\uDF17' };
                moonHTML = '<span class="cal-moon">' + (moonEmojis[moonEvent.phase] || '') + '</span>';
            }

            weekDays.push({
                html: '<div data-date="' + dateStr + '" data-weekday="' + weekdayKeys[wd] + '" data-week="' + weekNumber + '" class="' + cls + '">' + cellDay + moonHTML + '</div>',
                date: cellDate
            });
        }

        // Week number from first current-month day in this row, or from first day
        var refDate = weekDays[0].date;
        for (var i = 0; i < weekDays.length; i++) {
            var ci = w * 7 + i;
            if (ci >= startWeekday && ci < startWeekday + daysInMonth) {
                refDate = weekDays[i].date;
                break;
            }
        }
        var wn = getISOWeek(refDate);

        weeks.push({
            weekNumber: wn,
            cells: weekDays.map(function (d) { return d.html; }).join('')
        });
    }

    // Collect holiday names for footer
    var holidayNames = [];
    for (var d = 1; d <= daysInMonth; d++) {
        var ds = isoDate(year, month, d);
        var dd2 = dayData[ds];
        if (dd2 && dd2.holidays) {
            dd2.holidays.forEach(function (h) {
                if (h.type === 'public') {
                    holidayNames.push(h.name + ' (' + d + ')');
                }
            });
        }
    }

    // Build HTML
    var html = '<article class="card bg-base-200 shadow-md border-0 hover:shadow-soft-lg transition-shadow">';
    html += '<div class="card-body p-4">';

    // Title
    html += '<a href="/' + year + '/' + monthSlug + '/" class="card-title text-lg capitalize hover:text-primary transition-colors text-center w-full">';
    html += '<h3 class="text-center w-full">' + monthName + ' ' + year + '</h3></a>';

    // Weekday headers
    html += '<div class="grid grid-cols-8 gap-1 text-center text-xs font-semibold text-base-content/60 mb-2"><div></div>';
    cfg.weekdays_short.forEach(function (wd) {
        html += '<div>' + wd + '</div>';
    });
    html += '</div>';

    // Weeks
    weeks.forEach(function (week) {
        html += '<div class="grid grid-cols-8 gap-1 text-center text-sm">';
        html += '<div class="text-xs text-base-content/50 self-center pr-2 text-balance">' + cfg.week_prefix + week.weekNumber + '</div>';
        html += week.cells;
        html += '</div>';
    });

    // Holiday footer
    if (holidayNames.length > 0) {
        html += '<div class="mt-2 pt-2 border-t border-base-300">';
        html += '<p class="text-xs text-base-content/60">' + holidayNames.join(', ') + '</p>';
        html += '</div>';
    }

    html += '</div></article>';
    container.innerHTML = html;

    // Re-init tooltips for the new calendar cells
    if (typeof setupTooltips === 'function') setupTooltips();
}

/**
 * 3. Navigation links — set href and label with current year
 */
function updateNavLinks(year) {
    var cfg = window.HOME_CONFIG;
    if (!cfg) return;

    document.querySelectorAll('#home-nav [data-route]').forEach(function (el) {
        var route = el.dataset.route;
        var pattern = cfg.routes[route];
        if (pattern) {
            el.href = pattern.replace('{year}', year);
        }
    });

    document.querySelectorAll('#home-nav [data-nav-label]').forEach(function (el) {
        var key = el.dataset.navLabel;
        var label = cfg.nav_labels[key];
        if (label) {
            el.textContent = label.replace('{year}', year);
        }
    });
}

/**
 * 4. Upcoming moon phases from /data/{year}.json
 */
async function renderUpcomingMoon(year) {
    var t = window.CALENDAR_TRANSLATIONS;
    var cfg = window.HOME_CONFIG;
    if (!t || !cfg) return;

    var grid = document.getElementById('home-moon-grid');
    if (!grid) return;

    var dayData = {};
    try {
        var resp = await fetch('/data/' + year + '.json');
        if (resp.ok) {
            dayData = await resp.json();
            if (typeof dayDataCache !== 'undefined') dayDataCache[year] = dayData;
        }
    } catch (e) { /* ignore */ }

    var today = new Date();
    var todayISO = isoDate(today.getFullYear(), today.getMonth() + 1, today.getDate());

    var moonEmojis = { new_moon: '\uD83C\uDF11', first_quarter: '\uD83C\uDF13', full_moon: '\uD83C\uDF15', last_quarter: '\uD83C\uDF17' };
    var monthKeys = ['january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december'];

    // Helper: collect moon events from a data set
    function collectMoon(data, upcoming, limit) {
        var dates = Object.keys(data).sort();
        for (var i = 0; i < dates.length && upcoming.length < limit; i++) {
            var dateStr = dates[i];
            if (dateStr < todayISO) continue;
            var dd = data[dateStr];
            if (dd && dd.moon) {
                var parts = dateStr.split('-');
                var m = parseInt(parts[1], 10);
                var d = parseInt(parts[2], 10);
                var shortMonthName = t.months[monthKeys[m - 1]].substring(0, 3);
                upcoming.push({
                    date: d + ' ' + shortMonthName + ' ' + parts[0],
                    time: dd.moon.time || '',
                    emoji: moonEmojis[dd.moon.phase] || '',
                    name: dd.moon.name,
                    iso: dateStr
                });
            }
        }
    }

    // Collect upcoming moon events
    var upcoming = [];
    collectMoon(dayData, upcoming, 4);

    // If not enough in current year, try next year
    if (upcoming.length < 4) {
        var nextYear = year + 1;
        try {
            var resp2 = await fetch('/data/' + nextYear + '.json');
            if (resp2.ok) {
                var nextData = await resp2.json();
                if (typeof dayDataCache !== 'undefined') dayDataCache[nextYear] = nextData;
                collectMoon(nextData, upcoming, 4);
            }
        } catch (e) { /* ignore */ }
    }

    if (upcoming.length === 0) {
        grid.parentElement.style.display = 'none';
        return;
    }

    // Compute days difference from today
    var todayMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

    var html = '';
    upcoming.forEach(function (ev) {
        var evParts = ev.iso.split('-');
        var evMs = new Date(parseInt(evParts[0], 10), parseInt(evParts[1], 10) - 1, parseInt(evParts[2], 10)).getTime();
        var diffDays = Math.round((evMs - todayMs) / 86400000);

        var badge = '';
        if (diffDays === 0) {
            badge = t.relative.today;
        } else if (diffDays === 1) {
            badge = t.relative.day_from_now.replace('{count}', '1');
        } else {
            badge = t.relative.days_from_now.replace('{count}', diffDays);
        }

        var timeStr = ev.time ? ' \u00b7 ' + ev.time : '';

        html += '<div class="flex items-center gap-3 p-3 rounded-lg bg-base-200">';
        html += '<span class="text-2xl">' + ev.emoji + '</span>';
        html += '<div class="flex-1 min-w-0">';
        html += '<span class="font-medium">' + ev.name + '</span>';
        html += '<span class="text-sm text-base-content/60 ml-2">' + ev.date + timeStr + '</span>';
        html += '</div>';
        html += '<span class="badge badge-sm badge-ghost rounded-full whitespace-nowrap">' + badge + '</span>';
        html += '</div>';
    });
    grid.innerHTML = html;
}
