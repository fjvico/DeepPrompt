// ==UserScript==
// @name         DeepPrompt
// @namespace    http://tampermonkey.net/
// @version      0.0
// @description  Icono junto al botón "Share" de DeepSeek para marcar qué system prompt(s) añadir al primer mensaje de cada conversación nueva
// @author       Francisco Vico
// @homepageURL   https://fjvico.github.io
// @supportURL    mailto:fjvico@uma.es
// @contributionURL https://www.amazon.es/-/en/Cartas-Alias-pr%C3%B3ximo-inicio-sesi%C3%B3n-ebook/dp/B0GQJMRJ48
// @match        https://chat.deepseek.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // =========================================================
    // 1) DEFINE AQUÍ TUS PROMPTS (añade tantos como quieras)
    // =========================================================
    const PROMPTS = [
        {
            id: 'concision',
            name: 'Sé conciso',
            text: `Responde de forma extremadamente concisa, sin rodeos ni explicaciones innecesarias.`
        },
        {
            id: 'paso_a_paso',
            name: 'Explica paso a paso',
            text: `Explica tu razonamiento paso a paso, de forma clara y detallada, como si se lo explicaras a alguien sin conocimientos previos del tema.`
        },
        {
            id: 'lenguaje_sencillo',
            name: 'Lenguaje sencillo',
            text: `Usa un lenguaje sencillo y cercano, evitando tecnicismos y jerga innecesaria.`
        },
        // -> Añade más objetos aquí: { id: 'xxx', name: 'Nombre visible', text: '...' }
    ];

    // Cómo se combinan los prompts marcados entre sí (un único párrafo, separados por espacio)
    const PROMPT_JOIN = " ";
    // Cómo se separa el mensaje del usuario del bloque de prompts (una línea en blanco)
    const SEPARATOR = "\n\n";

    // =========================================================
    // 2) PERSISTENCIA (qué prompts están marcados)
    // =========================================================
    const STORAGE_KEY_SELECTED_IDS = 'ds_sysprompt_selected_ids';

    const hasGM = typeof GM_getValue === 'function' && typeof GM_setValue === 'function';

    function loadValue(key, def) {
        try {
            if (hasGM) {
                const v = GM_getValue(key, undefined);
                return v === undefined ? def : v;
            }
            const v = localStorage.getItem(key);
            return v === null ? def : JSON.parse(v);
        } catch (err) {
            console.error('[DeepSeek SystemPrompt] Error leyendo valor guardado:', err);
            return def;
        }
    }
    function saveValue(key, value) {
        try {
            if (hasGM) {
                GM_setValue(key, value);
            } else {
                localStorage.setItem(key, JSON.stringify(value));
            }
        } catch (err) {
            console.error('[DeepSeek SystemPrompt] Error guardando valor:', err);
        }
    }

    // Array de ids marcados. Por defecto, ninguno (nada se inyecta hasta que el usuario marque algo).
    let selectedIds = loadValue(STORAGE_KEY_SELECTED_IDS, []);

    function isSelected(id) {
        return selectedIds.includes(id);
    }
    function toggleSelected(id, checked) {
        if (checked && !selectedIds.includes(id)) {
            selectedIds.push(id);
        } else if (!checked) {
            selectedIds = selectedIds.filter(x => x !== id);
        }
        saveValue(STORAGE_KEY_SELECTED_IDS, selectedIds);
    }

    // =========================================================
    // 3) INYECCIÓN EN EL TEXTAREA
    // =========================================================
    // Guarda los ids de los prompts que estaban activos la última vez que se
    // tocó el mensaje en ESTE chat. Se resetea a [] al cambiar de conversación.
    let lastInjectedIds = [];

    function sameIdSet(a, b) {
        if (a.length !== b.length) return false;
        const setB = new Set(b);
        return a.every(id => setB.has(id));
    }

    function getTextarea() {
        return document.querySelector('textarea');
    }

    function setTextareaValue(textarea, value) {
        const nativeSetter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype,
            'value'
        ).set;
        nativeSetter.call(textarea, value);
        textarea.dispatchEvent(new Event('input', { bubbles: true }));

        // Mantener el scroll y el cursor arriba, para que el texto añadido
        // (que queda por debajo, tras el mensaje del usuario) no se vea al
        // insertarlo: no queremos que salte a mostrar el final del contenido.
        requestAnimationFrame(() => {
            try {
                textarea.setSelectionRange(0, 0);
                textarea.scrollTop = 0;
            } catch (err) {
                // Algunos navegadores/inputs pueden no soportar setSelectionRange en este momento
            }
        });
    }

    function tryInject() {
        const currentIds = PROMPTS.filter(p => isSelected(p.id)).map(p => p.id);
        console.log('[DeepSeek SystemPrompt] tryInject(). currentIds=', currentIds, 'lastInjectedIds=', lastInjectedIds);

        // Sin cambios respecto a la última vez que se aplicó en este chat -> no tocar nada
        if (sameIdSet(currentIds, lastInjectedIds)) {
            console.log('[DeepSeek SystemPrompt] Sin cambios respecto a la última vez, no se inyecta nada.');
            return;
        }

        const addedIds = currentIds.filter(id => !lastInjectedIds.includes(id));
        const removedIds = lastInjectedIds.filter(id => !currentIds.includes(id));
        console.log('[DeepSeek SystemPrompt] addedIds=', addedIds, 'removedIds=', removedIds);

        // Bloque con los prompts actualmente activos (todos, no solo los nuevos)
        let block = '';
        if (currentIds.length > 0) {
            block = PROMPTS.filter(p => currentIds.includes(p.id)).map(p => p.text).join(PROMPT_JOIN);
        }
        // Bloque "Forget about: ..." con los que se acaban de desactivar
        if (removedIds.length > 0) {
            const removedText = PROMPTS.filter(p => removedIds.includes(p.id)).map(p => p.text).join(PROMPT_JOIN);
            if (block) block += ' ';
            block += `IMPORTANT! The following instructions has been revoked, ONLY in what concerns them, reset to your default response from here: ${removedText}`;
        }
        console.log('[DeepSeek SystemPrompt] Bloque a insertar:', JSON.stringify(block));

        if (!block) {
            lastInjectedIds = currentIds;
            console.log('[DeepSeek SystemPrompt] Bloque vacío, no hay nada que insertar.');
            return;
        }

        const textarea = getTextarea();
        console.log('[DeepSeek SystemPrompt] textarea encontrado:', textarea, 'valor actual:', textarea ? JSON.stringify(textarea.value) : null);
        if (!textarea || !textarea.value.trim()) {
            console.log('[DeepSeek SystemPrompt] No se inyecta: no hay textarea o está vacío.');
            return;
        }

        const userText = textarea.value;
        // El mensaje del usuario va primero (visible), el bloque de prompts se
        // añade DESPUÉS, oculto por debajo del scroll.
        const combined = userText + SEPARATOR + block;
        setTextareaValue(textarea, combined);
        lastInjectedIds = currentIds;
        console.log('[DeepSeek SystemPrompt] Inyectado. Nuevo valor:', JSON.stringify(combined));
    }

    document.addEventListener(
        'keydown',
        (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                tryInject();
            }
        },
        true
    );

    document.addEventListener(
        'click',
        (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            const label = (btn.getAttribute('aria-label') || btn.textContent || '').toLowerCase();
            if (label.includes('send') || label.includes('enviar')) {
                tryInject();
            }
        },
        true
    );

    // Al cambiar de conversación (nueva URL), olvidamos lo aplicado hasta
    // ahora: en el chat nuevo, la primera vez que haya algo marcado se
    // considerará un cambio y se inyectará.
    let lastUrl = location.href;
    setInterval(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            lastInjectedIds = [];
        }
    }, 500);

    // =========================================================
    // 4) LOCALIZAR EL BOTÓN "SHARE" DE DEEPSEEK
    // =========================================================
    // Intenta varias estrategias porque el HTML exacto puede cambiar.
    function findShareButton() {
        const candidates = [
            'button[aria-label*="share" i]',
            'button[title*="share" i]',
            '[data-testid*="share" i]',
            'a[aria-label*="share" i]',
        ];
        for (const sel of candidates) {
            const el = document.querySelector(sel);
            if (el) return el;
        }
        // Fallback: buscar un botón cuyo texto visible sea "Share" / "Compartir"
        const buttons = Array.from(document.querySelectorAll('button, a'));
        return buttons.find(b => /^(share|compartir)$/i.test((b.textContent || '').trim())) || null;
    }

    // =========================================================
    // 5) ICONO REDONDO + DESPLEGABLE (Shadow DOM, aislado del CSS del sitio)
    // =========================================================
    // =========================================================
    // CONFIGURA AQUÍ la posición de emergencia (mientras no se localiza "Share")
    // =========================================================
    const FALLBACK_TOP = '12px';
    const FALLBACK_RIGHT = '64px'; // separación desde el borde derecho, para no pisar el icono "Share"

    // Debe coincidir con @contributionURL de la cabecera de metadatos
    const CONTRIBUTION_URL = 'https://www.amazon.es/-/en/Cartas-Alias-pr%C3%B3ximo-inicio-sesi%C3%B3n-ebook/dp/B0GQJMRJ48';

    const HOST_ID = 'ds-sysprompt-host';
    const PANEL_ID = 'ds-sysprompt-panel-host';
    let hostEl = null;      // icono, se inserta dentro de la barra junto a "Share"
    let panelHostEl = null; // panel desplegable, SIEMPRE flotante en <body>, posicionado por JS
    let panelDropdown = null;
    let iconEl = null;
    let checkboxEls = {}; // id -> input

    function buildWidget() {
        if (document.getElementById(HOST_ID)) return;

        // ---------- 1) ICONO ----------
        hostEl = document.createElement('div');
        hostEl.id = HOST_ID;
        // Posición de emergencia (SIEMPRE visible) mientras no se localiza "Share".
        hostEl.setAttribute(
            'style',
            'all: initial !important;' +
            'position: fixed !important;' +
            'z-index: 2147483647 !important;' +
            'pointer-events: auto !important;' +
            `top: ${FALLBACK_TOP} !important;` +
            `right: ${FALLBACK_RIGHT} !important;`
        );

        const shadow = hostEl.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = `
            :host { all: initial; }
            * { box-sizing: border-box; }
            .icon {
                width: 28px;
                height: 28px;
                border-radius: 50%;
                background: #2a2a2a;
                border: 1px solid #555;
                color: #eee;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                cursor: pointer;
                user-select: none;
                box-shadow: 0 1px 4px rgba(0,0,0,0.4);
            }
            .icon.active {
                border-color: #7aa2ff;
                box-shadow: 0 0 0 2px rgba(122,162,255,0.4);
            }
        `;

        iconEl = document.createElement('div');
        iconEl.className = 'icon';
        iconEl.textContent = '⚙️';
        iconEl.title = 'System prompts para DeepSeek';

        shadow.appendChild(style);
        shadow.appendChild(iconEl);
        document.body.appendChild(hostEl);

        // ---------- 2) PANEL DESPLEGABLE (independiente, flotante en <body>) ----------
        panelHostEl = document.createElement('div');
        panelHostEl.id = PANEL_ID;
        panelHostEl.setAttribute(
            'style',
            'all: initial !important;' +
            'position: fixed !important;' +
            'z-index: 2147483647 !important;' +
            'pointer-events: auto !important;' +
            'display: none !important;'
        );

        const panelShadow = panelHostEl.attachShadow({ mode: 'open' });
        const panelStyle = document.createElement('style');
        panelStyle.textContent = `
            :host { all: initial; }
            * { box-sizing: border-box; }
            .dropdown {
                font-family: system-ui, sans-serif;
                background: #1e1e1e;
                border: 1px solid #555;
                border-radius: 8px;
                padding: 8px;
                min-width: 220px;
                max-width: 280px;
                box-shadow: 0 4px 16px rgba(0,0,0,0.5);
                color: #eee;
                font-size: 12px;
            }
            .item {
                display: flex;
                align-items: flex-start;
                gap: 6px;
                padding: 4px 2px;
                cursor: pointer;
            }
            .item:hover { background: rgba(255,255,255,0.06); border-radius: 4px; }
            .item input { margin-top: 2px; cursor: pointer; }
            .item span { line-height: 1.3; }
            .empty-note {
                margin-top: 4px;
                padding-top: 6px;
                border-top: 1px solid #444;
                font-size: 11px;
                color: #999;
            }
            .support-line {
                margin-top: 6px;
                padding-top: 6px;
                border-top: 1px solid #444;
                font-size: 11px;
                color: #999;
            }
            .support-line a {
                color: #7aa2ff;
                text-decoration: none;
            }
            .support-line a:hover {
                text-decoration: underline;
            }
        `;

        panelDropdown = document.createElement('div');
        panelDropdown.className = 'dropdown';

        PROMPTS.forEach(p => {
            const item = document.createElement('label');
            item.className = 'item';

            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = isSelected(p.id);
            cb.addEventListener('change', () => {
                toggleSelected(p.id, cb.checked);
                updateIconState();
            });
            checkboxEls[p.id] = cb;

            const label = document.createElement('span');
            label.textContent = p.name;

            item.appendChild(cb);
            item.appendChild(label);
            panelDropdown.appendChild(item);
        });

        const note = document.createElement('div');
        note.className = 'empty-note';
        note.textContent = 'Si no marcas ninguno, no se añade nada.';
        panelDropdown.appendChild(note);

        const supportLine = document.createElement('div');
        supportLine.className = 'support-line';
        supportLine.append('Buy me a ');
        const bookLink = document.createElement('a');
        bookLink.href = CONTRIBUTION_URL;
        bookLink.target = '_blank';
        bookLink.rel = 'noopener noreferrer';
        bookLink.textContent = 'book';
        supportLine.appendChild(bookLink);
        supportLine.append('...');
        panelDropdown.appendChild(supportLine);

        panelShadow.appendChild(panelStyle);
        panelShadow.appendChild(panelDropdown);
        document.body.appendChild(panelHostEl);

        // ---------- 3) ABRIR / CERRAR con retraso (evita cierres al mover el cursor) ----------
        let closeTimer = null;
        let pinned = false; // true tras un click, se mantiene abierto hasta click fuera

        function openPanel() {
            if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
            positionPanel();
            panelHostEl.style.setProperty('display', 'block', 'important');
        }
        function scheduleClose() {
            if (pinned) return;
            if (closeTimer) clearTimeout(closeTimer);
            closeTimer = setTimeout(() => {
                panelHostEl.style.setProperty('display', 'none', 'important');
            }, 300);
        }
        function cancelClose() {
            if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
        }

        iconEl.addEventListener('mouseenter', () => { cancelClose(); openPanel(); });
        iconEl.addEventListener('mouseleave', scheduleClose);
        panelHostEl.addEventListener('mouseenter', cancelClose);
        panelHostEl.addEventListener('mouseleave', scheduleClose);

        iconEl.addEventListener('click', (e) => {
            e.stopPropagation();
            pinned = !pinned;
            if (pinned) {
                openPanel();
            } else {
                panelHostEl.style.setProperty('display', 'none', 'important');
            }
        });
        document.addEventListener('click', (e) => {
            if (pinned && !panelHostEl.contains(e.target) && e.target !== iconEl) {
                pinned = false;
                panelHostEl.style.setProperty('display', 'none', 'important');
            }
        });

        updateIconState();
        console.log('[DeepSeek SystemPrompt] Widget inyectado.');

        function updateIconState() {
            const anySelected = PROMPTS.some(p => isSelected(p.id));
            iconEl.classList.toggle('active', anySelected);
        }
    }

    // =========================================================
    // 5.5) POSICIONAR EL PANEL FLOTANTE justo debajo del icono, alineado a su derecha
    // =========================================================
    function positionPanel() {
        if (!hostEl || !panelHostEl) return;
        const rect = hostEl.getBoundingClientRect();
        const gap = 6;
        const top = rect.bottom + gap;
        const right = Math.max(4, window.innerWidth - rect.right);
        panelHostEl.style.setProperty('top', `${top}px`, 'important');
        panelHostEl.style.setProperty('right', `${right}px`, 'important');
        panelHostEl.style.setProperty('left', 'auto', 'important');
        panelHostEl.style.setProperty('bottom', 'auto', 'important');
    }

    // =========================================================
    // 6) INSERTAR EL ICONO JUNTO AL BOTÓN "SHARE" (en el propio DOM de la barra)
    // =========================================================
    // En vez de superponer un elemento con position:fixed (que puede quedar
    // tapado por elementos de la página con su propia capa de apilamiento),
    // insertamos el icono como un hermano más del botón "Share", dentro de
    // su mismo contenedor. Así hereda la misma visibilidad y alineación.
    let attachedInline = false;

    function attachNextToShare() {
        if (!hostEl) return false;
        const shareBtn = findShareButton();
        if (!shareBtn || !shareBtn.parentElement) return false;

        // Si ya está correctamente colocado justo antes del botón Share, no tocar nada
        if (hostEl.parentElement === shareBtn.parentElement && hostEl.nextElementSibling === shareBtn) {
            return true;
        }

        hostEl.style.setProperty('all', 'unset', 'important');
        hostEl.style.setProperty('position', 'static', 'important');
        hostEl.style.setProperty('display', 'inline-flex', 'important');
        hostEl.style.setProperty('align-items', 'center', 'important');
        hostEl.style.setProperty('margin-right', '6px', 'important');
        hostEl.style.setProperty('vertical-align', 'middle', 'important');
        hostEl.style.setProperty('z-index', '2147483647', 'important');

        shareBtn.parentElement.insertBefore(hostEl, shareBtn);
        console.log('[DeepSeek SystemPrompt] Icono insertado junto al botón "Share".');
        return true;
    }

    function repositionWidget() {
        if (!hostEl) return;
        attachedInline = attachNextToShare();
        if (!attachedInline) {
            console.log('[DeepSeek SystemPrompt] Botón "Share" no encontrado todavía; icono en posición de emergencia (arriba-derecha).');
        }
        if (panelHostEl && panelHostEl.style.display === 'block') {
            positionPanel();
        }
    }

    // Construir el widget y engancharlo junto al botón "Share" en cuanto exista.
    // Seguimos comprobando indefinidamente (baja frecuencia) porque una SPA puede
    // re-renderizar esa barra y desenganchar nuestro nodo del DOM.
    const initInterval = setInterval(() => {
        try {
            if (document.documentElement) {
                buildWidget();
                repositionWidget();
                // Mientras no hayamos podido engancharlo junto a "Share" (fallback fijo),
                // lo reinsertamos como último hijo de <body> para ganar cualquier empate
                // de z-index frente a overlays que la página añada después.
                if (!attachedInline && hostEl && hostEl.parentNode === document.body &&
                    hostEl.parentNode.lastElementChild !== hostEl) {
                    hostEl.parentNode.appendChild(hostEl);
                }
            }
        } catch (err) {
            console.error('[DeepSeek SystemPrompt] Error inicializando el widget:', err);
        }
    }, 1000);

    // También reposicionar en scroll/resize, por si el botón Share se mueve
    window.addEventListener('resize', repositionWidget, true);
    window.addEventListener('scroll', repositionWidget, true);
})();