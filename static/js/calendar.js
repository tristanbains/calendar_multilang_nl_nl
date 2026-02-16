/**
 * Calendar interactivity - Today highlight and date tooltips
 */

// Cache for lazy-loaded day data (keyed by year)
let dayDataCache = {};

document.addEventListener('DOMContentLoaded', function() {
    highlightToday();
    highlightCurrentWeek();
    highlightSunTableToday();
    populateHolidayRelativeText();
    setupTooltips();
    initRegionFilter();
    initYearMenuFilter();
});

/**
 * Add ring highlight to today's date
 * Only highlights dates in the current month (not greyed-out adjacent month dates)
 */
function highlightToday() {
    const today = new Date();
    const todayISO = today.toISOString().split('T')[0];

    document.querySelectorAll('[data-date="' + todayISO + '"]').forEach(el => {
        // Only highlight if not a greyed-out adjacent month date
        if (!el.classList.contains('text-base-content/30')) {
            el.classList.add('ring-2', 'ring-primary', 'ring-offset-1');
        }
    });
}

/**
 * Highlight current week row in week numbers table
 */
function highlightCurrentWeek() {
    const today = new Date();
    const currentYear = today.getFullYear();

    // Calculate ISO week number
    const jan4 = new Date(currentYear, 0, 4);
    const dayOfYear = Math.floor((today - new Date(currentYear, 0, 1)) / 86400000) + 1;
    const jan4Day = jan4.getDay() || 7;
    const week1Monday = new Date(currentYear, 0, 4 - jan4Day + 1);
    const currentWeek = Math.floor((today - week1Monday) / 604800000) + 1;

    const t = window.CALENDAR_TRANSLATIONS || {};
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    document.querySelectorAll('[data-week][data-year]').forEach(el => {
        const weekNum = parseInt(el.dataset.week, 10);
        const year = parseInt(el.dataset.year, 10);
        const isCurrentWeek = weekNum === currentWeek && year === currentYear;

        if (isCurrentWeek) {
            el.classList.add('bg-primary/10', 'font-semibold');
            // Add indicator to the week number cell
            const weekCell = el.querySelector('td:first-child');
            if (weekCell && !weekCell.querySelector('.current-week-indicator')) {
                weekCell.innerHTML = '<span class="flex items-center justify-center gap-1">' +
                    '<span class="w-2 h-2 rounded-full bg-primary animate-pulse"></span>' +
                    weekCell.textContent +
                    '</span>';
            }
        }

        // Populate relative time text
        const relCell = el.querySelector('.week-relative-text');
        if (!relCell) return;

        if (isCurrentWeek) {
            const label = t.current_week || 'Current week';
            relCell.innerHTML = '<span class="badge badge-primary badge-sm rounded-full">' + label + '</span>';
        } else if (el.dataset.startIso && t.relative) {
            const startDate = new Date(el.dataset.startIso + 'T00:00:00');
            const msPerDay = 86400000;
            const daysDiff = Math.round((startDate - todayMidnight) / msPerDay);
            let text;
            if (daysDiff === 0) text = t.relative.today;
            else if (daysDiff === 1) text = t.relative.tomorrow;
            else if (daysDiff === -1) text = t.relative.yesterday;
            else if (daysDiff < 0) {
                const abs = Math.abs(daysDiff);
                text = t.relative[abs === 1 ? 'day_ago' : 'days_ago'].replace('{count}', abs);
            } else {
                text = t.relative[daysDiff === 1 ? 'day_from_now' : 'days_from_now'].replace('{count}', daysDiff);
            }
            relCell.innerHTML = '<span class="text-base-content/40 text-xs group-hover/row:text-white/60">' +
                text + '</span>';
        }
    });
}

/**
 * Highlight today's row in sun/sunset table
 */
function highlightSunTableToday() {
    const today = new Date();
    const todayISO = today.toISOString().split('T')[0];
    const t = window.CALENDAR_TRANSLATIONS || {};

    document.querySelectorAll('[data-sun-date="' + todayISO + '"]').forEach(el => {
        el.classList.add('bg-primary/10', 'font-semibold', 'ring-1', 'ring-primary/30');

        const badge = el.querySelector('.sun-today-text');
        if (badge && t.relative && t.relative.today) {
            badge.innerHTML = '<span class="badge badge-primary badge-xs rounded-full ml-2">' +
                t.relative.today + '</span>';
        }
    });
}

/**
 * Populate relative time text for holiday table rows
 */
function populateHolidayRelativeText() {
    const t = window.CALENDAR_TRANSLATIONS || {};
    if (!t.relative) return;

    const today = new Date();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const msPerDay = 86400000;

    document.querySelectorAll('[data-holiday-date]').forEach(el => {
        const relCell = el.querySelector('.holiday-relative-text');
        if (!relCell) return;

        const dateStr = el.dataset.holidayDate;
        const parts = dateStr.split('-');
        const holidayDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        const daysDiff = Math.round((holidayDate - todayMidnight) / msPerDay);

        let text;
        if (daysDiff === 0) text = t.relative.today;
        else if (daysDiff === 1) text = t.relative.tomorrow;
        else if (daysDiff === -1) text = t.relative.yesterday;
        else if (daysDiff < 0) {
            const abs = Math.abs(daysDiff);
            text = t.relative[abs === 1 ? 'day_ago' : 'days_ago'].replace('{count}', abs);
        } else {
            text = t.relative[daysDiff === 1 ? 'day_from_now' : 'days_from_now'].replace('{count}', daysDiff);
        }

        relCell.innerHTML = '<span class="text-base-content/40 text-xs group-hover/row:text-white/60">' +
            text + '</span>';
    });
}

/**
 * Setup tooltip functionality for all date cells
 */
function setupTooltips() {
    const tooltip = document.getElementById('calendar-tooltip');
    if (!tooltip) return;

    let isPinned = false;
    let currentTarget = null;

    document.querySelectorAll('[data-date]').forEach(el => {
        // Show on hover (if not pinned)
        el.addEventListener('mouseenter', (e) => {
            if (!isPinned) {
                showTooltip(e, tooltip);
                currentTarget = el;
            }
        });

        // Hide on leave (if not pinned)
        el.addEventListener('mouseleave', () => {
            if (!isPinned) {
                hideTooltip(tooltip);
                currentTarget = null;
            }
        });

        // Click to pin
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isPinned && currentTarget === el) {
                // Click same element again - unpin
                isPinned = false;
                tooltip.classList.remove('pinned');
                hideTooltip(tooltip);
                currentTarget = null;
            } else {
                // Pin to this element
                showTooltip(e, tooltip);
                isPinned = true;
                tooltip.classList.add('pinned');
                currentTarget = el;
            }
        });
    });

    // Click outside to dismiss pinned tooltip
    document.addEventListener('click', (e) => {
        if (isPinned && !tooltip.contains(e.target)) {
            isPinned = false;
            tooltip.classList.remove('pinned');
            hideTooltip(tooltip);
            currentTarget = null;
        }
    });
}

/**
 * Show tooltip with date information
 */
async function showTooltip(event, tooltip) {
    const el = event.currentTarget;
    const dateStr = el.dataset.date;
    const weekday = el.dataset.weekday;
    const weekNumber = el.dataset.week;

    if (!dateStr || !window.CALENDAR_TRANSLATIONS) return;

    const targetDate = parseISODate(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const t = window.CALENDAR_TRANSLATIONS;

    // Format full date: "vrijdag 1 juni 2025"
    const fullDateEl = tooltip.querySelector('[data-field="fulldate"]');
    if (fullDateEl) {
        fullDateEl.textContent = formatFullDate(targetDate, weekday, t);
    }

    // Week number
    const weekEl = tooltip.querySelector('[data-field="week"]');
    if (weekEl) {
        if (weekNumber) {
            weekEl.textContent = t.week_name + ' ' + weekNumber;
            weekEl.style.display = '';
        } else {
            weekEl.style.display = 'none';
        }
    }

    // Get all day data from lazy-loaded JSON (holidays, school, sun, moon)
    const year = targetDate.getFullYear();
    const dayData = await getDayData(year, dateStr);

    // Public holidays with 🎉 icon (lazy loaded)
    const publicHolidaysEl = tooltip.querySelector('[data-field="public-holidays"]');
    if (publicHolidaysEl) {
        if (dayData && dayData.holidays) {
            const publicHolidays = dayData.holidays.filter(h => h.type === 'public');
            if (publicHolidays.length > 0) {
                publicHolidaysEl.innerHTML = publicHolidays
                    .map(h => '🎉 ' + h.name)
                    .join('<br>');
                publicHolidaysEl.style.display = '';
            } else {
                publicHolidaysEl.style.display = 'none';
            }
        } else {
            publicHolidaysEl.style.display = 'none';
        }
    }

    // Observances with 💝 icon (lazy loaded)
    const observancesEl = tooltip.querySelector('[data-field="observances"]');
    if (observancesEl) {
        if (dayData && dayData.holidays) {
            const observances = dayData.holidays.filter(h => h.type === 'observance');
            if (observances.length > 0) {
                observancesEl.innerHTML = observances
                    .map(h => '💝 ' + h.name)
                    .join('<br>');
                observancesEl.style.display = '';
            } else {
                observancesEl.style.display = 'none';
            }
        } else {
            observancesEl.style.display = 'none';
        }
    }

    // School holidays with 🏫 icon and regions (lazy loaded)
    const schoolHolidaysEl = tooltip.querySelector('[data-field="school-holidays"]');
    if (schoolHolidaysEl) {
        if (dayData && dayData.school && dayData.school.length > 0) {
            schoolHolidaysEl.innerHTML = dayData.school
                .map(sh => {
                    const regionNames = sh.regions
                        .map(rid => window.SCHOOL_REGIONS && window.SCHOOL_REGIONS[rid] ? window.SCHOOL_REGIONS[rid] : rid)
                        .join(', ');
                    return '🏫 ' + sh.name + ' (' + regionNames + ')';
                })
                .join('<br>');
            schoolHolidaysEl.style.display = '';
        } else {
            schoolHolidaysEl.style.display = 'none';
        }
    }

    // Sun times with ☀️ icon (lazy loaded)
    const sunTimesEl = tooltip.querySelector('[data-field="sun-times"]');
    if (sunTimesEl) {
        if (dayData && dayData.sun && dayData.sun.length > 0) {
            sunTimesEl.innerHTML = dayData.sun
                .map(se => '☀️ ' + se.city + ': ' + se.rise + ' / ' + se.set)
                .join('<br>');
            sunTimesEl.style.display = '';
        } else {
            sunTimesEl.style.display = 'none';
        }
    }

    // Moon phase with icon (lazy loaded)
    const moonPhaseEl = tooltip.querySelector('[data-field="moon-phase"]');
    if (moonPhaseEl) {
        if (dayData && dayData.moon) {
            const icons = {
                'new_moon': '🌑',
                'first_quarter': '🌓',
                'full_moon': '🌕',
                'last_quarter': '🌗'
            };
            const icon = icons[dayData.moon.phase] || '';
            moonPhaseEl.textContent = icon + ' ' + dayData.moon.name;
            moonPhaseEl.style.display = '';
        } else {
            moonPhaseEl.style.display = 'none';
        }
    }

    // Relative date
    const relativeEl = tooltip.querySelector('[data-field="relative"]');
    if (relativeEl) {
        relativeEl.textContent = formatRelativeDate(targetDate, today, t.relative);
    }

    // Position tooltip (fixed positioning, no scroll offset needed)
    const rect = el.getBoundingClientRect();
    tooltip.style.left = rect.left + rect.width / 2 + 'px';
    tooltip.style.top = rect.top - 8 + 'px';
    tooltip.style.transform = 'translate(-50%, -100%)';

    // Adjust if tooltip goes off screen
    requestAnimationFrame(() => {
        const tooltipRect = tooltip.getBoundingClientRect();

        // Check if off left edge
        if (tooltipRect.left < 8) {
            tooltip.style.left = 8 + tooltipRect.width / 2 + 'px';
        }

        // Check if off right edge
        if (tooltipRect.right > window.innerWidth - 8) {
            tooltip.style.left = window.innerWidth - 8 - tooltipRect.width / 2 + 'px';
        }

        // Check if off top edge - show below instead
        if (tooltipRect.top < 8) {
            tooltip.style.top = rect.bottom + 8 + 'px';
            tooltip.style.transform = 'translate(-50%, 0)';
        }
    });

    tooltip.classList.add('visible');
}

/**
 * Get day data for a specific date (lazy loaded from JSON)
 */
async function getDayData(year, dateStr) {
    // Check cache first
    if (!dayDataCache[year]) {
        // Fetch year data from JSON
        try {
            const response = await fetch('/data/' + year + '.json');
            if (response.ok) {
                dayDataCache[year] = await response.json();
            } else {
                dayDataCache[year] = {};
            }
        } catch (e) {
            dayDataCache[year] = {};
        }
    }

    return dayDataCache[year][dateStr] || null;
}

/**
 * Hide tooltip
 */
function hideTooltip(tooltip) {
    tooltip.classList.remove('visible');
}

/**
 * Parse ISO date string to Date object (avoiding timezone issues)
 */
function parseISODate(dateStr) {
    const parts = dateStr.split('-');
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
}

/**
 * Format full date: "vrijdag 1 juni 2025" (weekday day month year)
 */
function formatFullDate(date, weekdayKey, t) {
    const weekdayName = t.weekdays[weekdayKey] || weekdayKey;
    const day = date.getDate();
    const monthNames = [
        'january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december'
    ];
    const monthKey = monthNames[date.getMonth()];
    const monthName = t.months && t.months[monthKey] ? t.months[monthKey] : monthKey;
    const year = date.getFullYear();

    return weekdayName + ' ' + day + ' ' + monthName + ' ' + year;
}

/**
 * Calculate accurate difference between two dates
 * Returns { years, months, weeks, days }
 */
function getDateDifference(date1, date2) {
    let earlier = date1 < date2 ? date1 : date2;
    let later = date1 < date2 ? date2 : date1;

    let years = later.getFullYear() - earlier.getFullYear();
    let months = later.getMonth() - earlier.getMonth();
    let days = later.getDate() - earlier.getDate();

    // Adjust for negative days (borrow from months)
    if (days < 0) {
        months--;
        const prevMonth = new Date(later.getFullYear(), later.getMonth(), 0);
        days += prevMonth.getDate();
    }

    // Adjust for negative months (borrow from years)
    if (months < 0) {
        years--;
        months += 12;
    }

    // Convert remaining days to weeks + days
    const weeks = Math.floor(days / 7);
    days = days % 7;

    return { years, months, weeks, days };
}

/**
 * Format relative date string
 */
function formatRelativeDate(targetDate, today, t) {
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysDiff = Math.round((targetDate - today) / msPerDay);

    if (daysDiff === 0) return t.today;
    if (daysDiff === -1) return t.yesterday;
    if (daysDiff === 1) return t.tomorrow;

    const absDays = Math.abs(daysDiff);
    const isPast = daysDiff < 0;

    // Simple format for <= 10 days
    if (absDays <= 10) {
        const key = isPast
            ? (absDays === 1 ? 'day_ago' : 'days_ago')
            : (absDays === 1 ? 'day_from_now' : 'days_from_now');
        return t[key].replace('{count}', absDays);
    }

    // Chunked format for > 10 days
    const diff = getDateDifference(today, targetDate);
    const parts = [];

    // Collect non-zero parts (unit names only, no direction suffix)
    if (diff.years > 0) {
        parts.push(formatUnit(diff.years, 'year', isPast, t));
    }
    if (diff.months > 0) {
        parts.push(formatUnit(diff.months, 'month', isPast, t));
    }
    if (diff.weeks > 0) {
        parts.push(formatUnit(diff.weeks, 'week', isPast, t));
    }
    if (diff.days > 0) {
        parts.push(formatUnit(diff.days, 'day', isPast, t));
    }

    // If no parts (shouldn't happen), fall back to days
    if (parts.length === 0) {
        const key = isPast ? 'days_ago' : 'days_from_now';
        return t[key].replace('{count}', absDays);
    }

    // Join parts and add direction
    return joinWithDirection(parts, isPast, t);
}

/**
 * Format a single unit (extracts just the number + unit part)
 */
function formatUnit(count, unit, isPast, t) {
    const key = isPast
        ? (count === 1 ? unit + '_ago' : unit + 's_ago')
        : (count === 1 ? unit + '_from_now' : unit + 's_from_now');

    let text = t[key].replace('{count}', count);

    // Extract just the number + unit (remove "over " prefix or " geleden" suffix)
    // Dutch: "over 2 weken" -> "2 weken", "2 weken geleden" -> "2 weken"
    // German: "vor 2 Wochen" -> "2 Wochen", "in 2 Wochen" -> "2 Wochen"
    text = text.replace(/^over\s+/i, '');
    text = text.replace(/^in\s+/i, '');
    text = text.replace(/^vor\s+/i, '');
    text = text.replace(/\s+geleden$/i, '');
    text = text.replace(/\s+ago$/i, '');

    return text;
}

/**
 * Join parts with commas and "and", then add direction prefix/suffix
 */
function joinWithDirection(parts, isPast, t) {
    let joined;
    if (parts.length === 1) {
        joined = parts[0];
    } else if (parts.length === 2) {
        joined = parts[0] + ' ' + t.and + ' ' + parts[1];
    } else {
        const last = parts.pop();
        joined = parts.join(', ') + ' ' + t.and + ' ' + last;
    }

    // Add direction - use the pattern from a simple translation to determine format
    // Check if language uses prefix (German "vor/in") or suffix (Dutch "geleden/over")
    const testPast = t.days_ago.replace('{count}', '').trim();
    const testFuture = t.days_from_now.replace('{count}', '').trim();

    if (testPast.startsWith('vor') || testPast.startsWith('vor ')) {
        // German style: "vor X" / "in X"
        return isPast ? 'vor ' + joined : 'in ' + joined;
    } else if (testFuture.startsWith('over') || testFuture.startsWith('in ')) {
        // Dutch style: "X geleden" / "over X"
        return isPast ? joined + ' geleden' : 'over ' + joined;
    } else {
        // English style fallback: "X ago" / "in X"
        return isPast ? joined + ' ago' : 'in ' + joined;
    }
}

/**
 * Filter year menu items based on browser's current date.
 * Shows years within [currentYear - pastYears, currentYear + futureYears].
 */
function initYearMenuFilter() {
    const header = document.querySelector('header[data-menu-future-years]');
    if (!header) return;

    const futureYears = parseInt(header.dataset.menuFutureYears, 10) || 3;
    const pastYears = parseInt(header.dataset.menuPastYears, 10) || 1;
    const currentYear = new Date().getFullYear();

    const minYear = currentYear - pastYears;
    const maxYear = currentYear + futureYears;

    // Find all year menu links
    const yearLinks = document.querySelectorAll('[data-menu-year]');
    yearLinks.forEach(link => {
        const year = parseInt(link.dataset.menuYear, 10);
        if (year < minYear || year > maxYear) {
            // Hide the link's immediate parent <li> if it exists (mobile nav),
            // otherwise hide just the link itself (desktop nav)
            const parentLi = link.parentElement;
            if (parentLi && parentLi.tagName === 'LI') {
                parentLi.style.display = 'none';
            } else {
                link.style.display = 'none';
            }
        }
    });

    // Recalculate grid rows for each dropdown after filtering
    document.querySelectorAll('.nav-dropdown__grid').forEach(grid => {
        // Count visible items (links not hidden, and parent LIs not hidden)
        const allLinks = grid.querySelectorAll('[data-menu-year]');
        let visibleCount = 0;
        allLinks.forEach(link => {
            const parentLi = link.parentElement;
            if (parentLi && parentLi.tagName === 'LI') {
                if (parentLi.style.display !== 'none') visibleCount++;
            } else {
                if (link.style.display !== 'none') visibleCount++;
            }
        });

        if (visibleCount > 0) {
            const rowCount = Math.ceil(visibleCount / 2);
            grid.style.setProperty('--grid-rows', rowCount);
        }
    });
}

/**
 * Initialize region filter for school holidays page
 */
function initRegionFilter() {
    const filterContainer = document.querySelector('[data-region-filter]');
    if (!filterContainer) return;

    const checkboxes = filterContainer.querySelectorAll('input[type="checkbox"]');
    const selectAllBtn = filterContainer.querySelector('[data-select-all-regions]');
    const selectNoneBtn = filterContainer.querySelector('[data-select-none-regions]');

    // Add change listeners to checkboxes
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', filterSchoolHolidays);
    });

    // Add click listener to select all button
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
            checkboxes.forEach(cb => cb.checked = true);
            filterSchoolHolidays();
        });
    }

    // Add click listener to select none button
    if (selectNoneBtn) {
        selectNoneBtn.addEventListener('click', () => {
            checkboxes.forEach(cb => cb.checked = false);
            filterSchoolHolidays();
        });
    }

    // Initial filter (all checked by default)
    filterSchoolHolidays();
}

/**
 * Filter school holidays based on selected regions
 */
function filterSchoolHolidays() {
    const filterContainer = document.querySelector('[data-region-filter]');
    if (!filterContainer) return;

    // Get checked regions
    const checkedRegions = new Set();
    filterContainer.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
        checkedRegions.add(cb.value);
    });

    // Filter table rows
    document.querySelectorAll('[data-regions]').forEach(el => {
        const regions = el.dataset.regions.split(',');
        const hasMatch = regions.some(r => checkedRegions.has(r.trim()));

        if (hasMatch || checkedRegions.size === 0) {
            el.style.display = '';
        } else {
            el.style.display = 'none';
        }
    });

    // Filter cards (if using card layout)
    document.querySelectorAll('[data-card-regions]').forEach(el => {
        const regions = el.dataset.cardRegions.split(',');
        const hasMatch = regions.some(r => checkedRegions.has(r.trim()));

        if (hasMatch || checkedRegions.size === 0) {
            el.style.display = '';
        } else {
            el.style.display = 'none';
        }
    });

    // Update button visibility based on selection state
    const selectAllBtn = filterContainer.querySelector('[data-select-all-regions]');
    const selectNoneBtn = filterContainer.querySelector('[data-select-none-regions]');
    const allCheckboxes = filterContainer.querySelectorAll('input[type="checkbox"]');
    const allChecked = [...allCheckboxes].every(cb => cb.checked);
    const noneChecked = [...allCheckboxes].every(cb => !cb.checked);

    if (selectAllBtn) {
        selectAllBtn.style.opacity = allChecked ? '0.5' : '1';
    }
    if (selectNoneBtn) {
        selectNoneBtn.style.opacity = noneChecked ? '0.5' : '1';
    }
}
