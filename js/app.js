(function () {
    'use strict';

    var config = {};
    var currentPage = -1;

    // ── Parse config.md ──────────────────────────────
    function loadConfig() {
        return fetch('config.md')
            .then(function (r) { return r.text(); })
            .then(function (text) {
                var lines = text.split('\n');
                var section = null;
                config = { site: {}, menu: [], footer: [], protectedHash: null };

                for (var i = 0; i < lines.length; i++) {
                    var trimmed = lines[i].trim();
                    if (trimmed.indexOf('## ') === 0) {
                        section = trimmed.slice(3).trim().toLowerCase();
                    } else if (trimmed.indexOf('- ') === 0 && section) {
                        var content = trimmed.slice(2);
                        if (section === 'site') {
                            var colonIdx = content.indexOf(':');
                            if (colonIdx > -1) {
                                var key = content.slice(0, colonIdx).trim();
                                var val = content.slice(colonIdx + 1).trim();
                                config.site[key] = val;
                            }
                        } else if (section === 'menu') {
                            var parts = content.split('|');
                            if (parts.length >= 3) {
                                config.menu.push({
                                    label: parts[0].trim(),
                                    icon: parts[1].trim(),
                                    source: parts[2].trim()
                                });
                            }
                        } else if (section === 'footer') {
                            var parts2 = content.split('|');
                            if (parts2.length >= 2) {
                                config.footer.push({
                                    label: parts2[0].trim(),
                                    url: parts2[1].trim()
                                });
                            }
                        } else if (section === 'copyright') {
                            var parts3 = content.split('|');
                            if (parts3.length >= 2) {
                                config.site['copyright'] = config.site['copyright'] ? config.site['copyright'] + ' ' + parts3[1].trim() : parts3[1].trim();
                            }
                        } else if (section === 'protected') {
                            var colonIdx2 = content.indexOf(':');
                            if (colonIdx2 > -1) {
                                var pkey = content.slice(0, colonIdx2).trim();
                                var pval = content.slice(colonIdx2 + 1).trim();
                                if (pkey === 'hash') config.protectedHash = pval;
                            }
                        }
                    }
                }
                return config;
            });
    }

    // ── Build UI ─────────────────────────────────────
    function buildUI() {
        var siteName = config.site.title || 'Academic Profile';
        var nameParts = siteName.split(' ');
        var brandHTML = nameParts.length > 1
            ? nameParts.slice(0, -1).join(' ') + ' <span class="brand-accent">' + nameParts[nameParts.length - 1] + '</span>'
            : siteName;

        // Header brand
        var titleEl = document.getElementById('site-title');
        titleEl.innerHTML = brandHTML;
        titleEl.addEventListener('click', function () { navigateTo(0); });

        document.title = siteName;

        // Nav links
        var menu = document.getElementById('nav-menu');
        for (var i = 0; i < config.menu.length; i++) {
            (function (index) {
                var item = config.menu[index];
                var a = document.createElement('a');
                a.href = '#' + slugify(item.label);
                a.textContent = item.label;
                a.addEventListener('click', function (e) {
                    e.preventDefault();
                    navigateTo(index);
                    closeMobileMenu();
                });
                menu.appendChild(a);
            })(i);
        }

        // Footer
        var footerTitle = document.getElementById('footer-title');
        footerTitle.innerHTML = brandHTML;

        var footerCopy = document.getElementById('footer-copy');
        footerCopy.textContent = '\u00A9 ' + (config.site.copyright || new Date().getFullYear());

        var footerLinks = document.getElementById('footer-links');
        for (var j = 0; j < config.footer.length; j++) {
            var fl = config.footer[j];
            var fa = document.createElement('a');
            fa.href = fl.url;
            fa.target = '_blank';
            fa.rel = 'noopener';
            fa.textContent = fl.label;
            footerLinks.appendChild(fa);
        }
    }

    // ── Navigation ───────────────────────────────────
    function navigateTo(index) {
        if (currentPage === index) return;
        currentPage = index;

        var links = document.querySelectorAll('#nav-menu a');
        for (var i = 0; i < links.length; i++) {
            if (i === index) {
                links[i].classList.add('active');
            } else {
                links[i].classList.remove('active');
            }
        }

        var contentEl = document.getElementById('page-content');
        contentEl.innerHTML = '<div class="loading"><div class="loading-spinner"></div></div>';
        contentEl.style.animation = 'none';
        contentEl.offsetHeight;
        contentEl.style.animation = '';

        var item = config.menu[index];

        var promise;
        if (item.source.charAt(item.source.length - 1) === '/') {
            promise = loadBibFolder(item.source);
        } else if (endsWith(item.source, '.bib')) {
            promise = fetch(item.source)
                .then(function (r) { return r.text(); })
                .then(function (bib) { renderPublications(parseBib(bib)); });
        } else {
            promise = fetch(item.source)
                .then(function (r) { return r.text(); })
                .then(function (md) { renderMarkdown(md); });
        }

        promise.catch(function (err) {
            contentEl.innerHTML = '<p style="color:var(--secondary);">Erro ao carregar conteúdo.</p>';
            console.error(err);
        });

        history.pushState({ type: 'menu', index: index }, '', '#' + slugify(item.label));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ── Load bib folder ──────────────────────────────
    var bibSources = {};
    var bibFolder = '';

    function loadBibFolder(folder) {
        bibFolder = folder;
        return fetch(folder + '_index.md')
            .then(function (r) { return r.text(); })
            .then(function (indexText) {
                var files = [];
                var lines = indexText.split('\n');
                var section = null;
                bibSources = {};

                for (var i = 0; i < lines.length; i++) {
                    var trimmed = lines[i].trim();
                    if (trimmed.indexOf('## ') === 0) {
                        section = trimmed.slice(3).trim().toLowerCase();
                        continue;
                    }
                    if (trimmed.indexOf('- ') === 0) {
                        var content = trimmed.slice(2);
                        if (!section) {
                            var bibMatch = content.match(/^(.+\.bib)/);
                            if (bibMatch) files.push(bibMatch[1]);
                        } else if (section === 'sources') {
                            var parts = content.split('|');
                            if (parts.length >= 2) {
                                bibSources[parts[0].trim()] = parts[1].trim();
                            }
                        }
                    }
                }

                var promises = files.map(function (file) {
                    return fetch(folder + file).then(function (r) { return r.text(); });
                });

                return Promise.all(promises);
            })
            .then(function (results) {
                var allEntries = [];
                for (var i = 0; i < results.length; i++) {
                    allEntries = allEntries.concat(parseBib(results[i]));
                }
                return discoverAssets(allEntries);
            })
            .then(function (entries) {
                renderPublications(entries);
            });
    }

    // ── Autodiscover PDF & Slides ────────────────────
    function discoverAssets(entries) {
        var checks = [];

        for (var i = 0; i < entries.length; i++) {
            (function (entry) {
                var key = entry.key;

                var pdfCheck = fetch(bibFolder + 'pdf/' + key + '.pdf', { method: 'HEAD' })
                    .then(function (r) {
                        if (r.ok) entry._pdf = bibFolder + 'pdf/' + key + '.pdf';
                    })
                    .catch(function () {});

                var slidesCheck = fetch(bibFolder + 'slides/' + key + '.pdf', { method: 'HEAD' })
                    .then(function (r) {
                        if (r.ok) entry._slides = bibFolder + 'slides/' + key + '.pdf';
                    })
                    .catch(function () {});

                checks.push(pdfCheck);
                checks.push(slidesCheck);
            })(entries[i]);
        }

        return Promise.all(checks).then(function () { return entries; });
    }

    // ── BibTeX parser ────────────────────────────────
    function parseBib(text) {
        var entries = [];
        var i = 0;

        while (i < text.length) {
            var atIdx = text.indexOf('@', i);
            if (atIdx === -1) break;

            var braceIdx = text.indexOf('{', atIdx);
            if (braceIdx === -1) break;

            var type = text.substring(atIdx + 1, braceIdx).trim().toLowerCase();

            var commaIdx = text.indexOf(',', braceIdx);
            if (commaIdx === -1) break;

            var key = text.substring(braceIdx + 1, commaIdx).trim();

            var depth = 1;
            var j = braceIdx + 1;
            while (j < text.length && depth > 0) {
                if (text.charAt(j) === '{') depth++;
                else if (text.charAt(j) === '}') depth--;
                j++;
            }

            var body = text.substring(commaIdx + 1, j - 1);

            var entry = { type: type, key: key, fields: {} };
            var fieldRegex = /(\w+)\s*=\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g;
            var fieldMatch;
            while ((fieldMatch = fieldRegex.exec(body)) !== null) {
                entry.fields[fieldMatch[1].toLowerCase()] = fieldMatch[2].trim();
            }

            if (type !== 'comment' && type !== 'string' && type !== 'preamble') {
                entries.push(entry);
            }

            i = j;
        }

        return entries;
    }

    // ── Render publications ──────────────────────────
    function renderPublications(entries) {
        var byYear = {};
        for (var i = 0; i < entries.length; i++) {
            var year = entries[i].fields.year || 'S/D';
            if (!byYear[year]) byYear[year] = [];
            byYear[year].push(entries[i]);
        }

        var years = Object.keys(byYear).sort(function (a, b) { return b - a; });

        var html = '<div class="pub-header">';
        html += '<h1>Publications</h1>';
        html += '<p class="pub-stats"><strong>' + entries.length + '</strong> entries</p>';
        html += '</div>';

        for (var y = 0; y < years.length; y++) {
            var yr = years[y];
            var yearEntries = byYear[yr];

            html += '<div class="pub-year-group">';
            html += '<div class="pub-year-title">' + yr + ' <span class="pub-count">' + yearEntries.length + '</span></div>';

            for (var e = 0; e < yearEntries.length; e++) {
                var entry = yearEntries[e];
                var f = entry.fields;
                var title = f.title || 'Sem t\u00edtulo';
                var authors = f.author || '';
                var venue = f.booktitle || f.journal || f.school || '';
                var note = f.note
                    ? '<span class="pub-note"><span class="material-symbols-outlined" style="font-size:14px">emoji_events</span> ' + f.note + '</span>'
                    : '';
                var typeLabel = getTypeLabel(entry.type);
                var venueExtra = '';
                if (venue) {
                    venueExtra = venue;
                    if (f.volume) venueExtra += ', vol. ' + f.volume;
                    if (f.pages) venueExtra += ', pp. ' + f.pages;
                }

                html += '<div class="pub-entry">';
                html += '<div class="pub-title">' + title + '</div>';
                html += '<div class="pub-authors">' + formatAuthors(authors) + '</div>';
                if (venueExtra) html += '<div class="pub-venue">' + venueExtra + '</div>';
                html += '<div class="pub-meta">';
                html += '<span class="pub-type ' + entry.type + '">' + typeLabel + '</span>';
                html += note;
                html += '</div>';

                // Action links row
                var actions = [];
                if (entry._pdf) {
                    actions.push('<a href="' + entry._pdf + '" target="_blank" class="pub-action pub-action-pdf"><span class="material-symbols-outlined">picture_as_pdf</span> PDF</a>');
                }
                if (entry._slides) {
                    actions.push('<a href="' + entry._slides + '" target="_blank" class="pub-action pub-action-slides"><span class="material-symbols-outlined">slideshow</span> Slides</a>');
                }
                if (f.doi) {
                    actions.push('<a href="https://doi.org/' + f.doi + '" target="_blank" class="pub-action pub-action-doi"><span class="material-symbols-outlined">link</span> DOI</a>');
                } else if (f.url) {
                    actions.push('<a href="' + f.url + '" target="_blank" class="pub-action pub-action-url"><span class="material-symbols-outlined">open_in_new</span> URL</a>');
                }
                if (bibSources[entry.key]) {
                    actions.push('<a href="' + bibSources[entry.key] + '" target="_blank" class="pub-action pub-action-github"><span class="material-symbols-outlined">code</span> Code</a>');
                }
                if (actions.length > 0) {
                    html += '<div class="pub-actions">' + actions.join('') + '</div>';
                }

                html += '</div>';
            }

            html += '</div>';
        }

        document.getElementById('page-content').innerHTML = html;
    }

    function getTypeLabel(type) {
        var labels = {
            article: 'Journal',
            inproceedings: 'Conference',
            incollection: 'Chapter',
            mastersthesis: 'Thesis',
            phdthesis: 'PhD Thesis',
            preprint: 'Preprint',
            misc: 'Other'
        };
        return labels[type] || type;
    }

    function formatAuthors(authors) {
        return authors
            .replace(/\s+and\s+/g, '; ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // ── Render markdown ──────────────────────────────
    function renderMarkdown(md) {
        var contentEl = document.getElementById('page-content');
        contentEl.innerHTML = marked.parse(md);
        bindInternalLinks(contentEl);
    }

    // ── Auth session (in-memory only) ────────────────
    var authUnlocked = false;

    function sha256(message) {
        var msgBuffer = new TextEncoder().encode(message);
        return crypto.subtle.digest('SHA-256', msgBuffer).then(function (hashBuffer) {
            var hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
        });
    }

    function isProtectedPath(src) {
        return src.indexOf('pages/protected/') !== -1;
    }

    function showAuthModal(onSuccess) {
        var modal = document.getElementById('auth-modal');
        var input = document.getElementById('auth-password');
        var btn = document.getElementById('auth-submit');
        var err = document.getElementById('auth-error');

        modal.hidden = false;
        err.hidden = true;
        input.value = '';
        setTimeout(function () { input.focus(); }, 100);

        function attempt() {
            var pw = input.value;
            if (!pw) return;
            sha256(pw).then(function (hash) {
                if (hash === config.protectedHash) {
                    authUnlocked = true;
                    modal.hidden = true;
                    onSuccess();
                } else {
                    err.hidden = false;
                    input.value = '';
                    input.focus();
                }
            });
        }

        btn.onclick = attempt;
        input.onkeydown = function (e) { if (e.key === 'Enter') attempt(); };
    }

    function loadPage(src, skipHistory) {
        if (isProtectedPath(src) && !authUnlocked) {
            if (!config.protectedHash) {
                document.getElementById('page-content').innerHTML = '<p style="color:var(--secondary);">Acesso negado.</p>';
                return;
            }
            showAuthModal(function () { loadPage(src, skipHistory); });
            return;
        }

        var contentEl = document.getElementById('page-content');
        contentEl.innerHTML = '<div class="loading"><div class="loading-spinner"></div></div>';
        currentPage = -1;
        var links = document.querySelectorAll('#nav-menu a');
        for (var i = 0; i < links.length; i++) links[i].classList.remove('active');
        fetch(src)
            .then(function (r) {
                if (!r.ok) throw new Error('403');
                return r.text();
            })
            .then(function (md) { renderMarkdown(md); })
            .catch(function () {
                contentEl.innerHTML = '<p style="color:var(--secondary);">Erro ao carregar conteúdo.</p>';
            });
        if (!skipHistory) {
            history.pushState({ type: 'page', src: src }, '', '#page:' + src);
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function bindInternalLinks(container) {
        var links = container.querySelectorAll('a[href]');
        for (var i = 0; i < links.length; i++) {
            (function (link) {
                var href = link.getAttribute('href');
                if (endsWith(href, '.md') && href.indexOf('://') === -1) {
                    link.addEventListener('click', function (e) {
                        e.preventDefault();
                        loadPage(href);
                    });
                }
            })(links[i]);
        }
    }

    // ── Mobile menu ──────────────────────────────────
    function setupMobileMenu() {
        var toggle = document.getElementById('menu-toggle');
        var navLinks = document.getElementById('nav-menu');
        var overlay = document.getElementById('mobile-overlay');

        if (toggle) {
            toggle.addEventListener('click', function () {
                navLinks.classList.toggle('open');
                overlay.classList.toggle('active');
            });
        }

        if (overlay) {
            overlay.addEventListener('click', function () {
                closeMobileMenu();
            });
        }
    }

    function closeMobileMenu() {
        var navLinks = document.getElementById('nav-menu');
        var overlay = document.getElementById('mobile-overlay');
        if (navLinks) navLinks.classList.remove('open');
        if (overlay) overlay.classList.remove('active');
    }

    // ── Utilities ────────────────────────────────────
    function slugify(str) {
        return str.toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');
    }

    function endsWith(str, suffix) {
        return str.indexOf(suffix, str.length - suffix.length) !== -1;
    }

    // ── History ────────────────────────────────────────
    window.addEventListener('popstate', function (e) {
        var state = e.state;
        if (state && state.type === 'page') {
            loadPage(state.src, true);
        } else if (state && state.type === 'menu') {
            currentPage = -1;
            navigateTo(state.index);
        } else {
            resolveHash();
        }
    });

    function resolveHash() {
        var hash = window.location.hash.slice(1);
        if (hash.indexOf('page:') === 0) {
            loadPage(hash.slice(5), true);
        } else {
            var startIndex = 0;
            if (hash) {
                for (var i = 0; i < config.menu.length; i++) {
                    if (slugify(config.menu[i].label) === hash) {
                        startIndex = i;
                        break;
                    }
                }
            }
            currentPage = -1;
            navigateTo(startIndex);
        }
    }

    // ── Init ─────────────────────────────────────────
    function init() {
        setupMobileMenu();

        loadConfig().then(function () {
            buildUI();
            resolveHash();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
