import { icon } from './icons.js';

/**
 * Recibe el objeto `data` (site.json parseado) e inyecta el contenido
 * en los nodos del DOM. Cada función es idempotente: puede llamarse de nuevo
 * si el JSON cambia en caliente (ej. modo CMS).
 */

export function renderNav(nav, site) {
  const logoEl = document.querySelector('.nav-logo');
  if (logoEl) {
    logoEl.innerHTML = '';
    if (site?.logo) {
      const img = document.createElement('img');
      img.src       = site.logo;
      img.alt       = site.brandName ?? 'Logo';
      img.className = 'nav-logo-img';
      logoEl.appendChild(img);
    }
    // Nombre de marca siempre visible junto al logo
    const name = document.createElement('span');
    name.className   = 'nav-brand-name';
    name.textContent = site?.brandName ?? '';
    logoEl.appendChild(name);
  }

  const list = document.querySelector('.nav-links');
  if (!list) return;
  list.innerHTML = nav.links
    .map(l => `<li><a href="${l.href}">${l.label}</a></li>`)
    .join('');
}

export function renderHero(hero) {
  // Badge
  const badge = document.querySelector('.hero-badge');
  if (badge) {
    badge.innerHTML = '';
    badge.appendChild(icon('flame', 'sicon'));
    badge.append(` ${hero.badge}`);
  }

  // Título
  const title = document.querySelector('.hero-title');
  if (title) {
    title.innerHTML = hero.titleLines
      .map((line, i) => {
        const cls = hero.titleClasses[i];
        const span = cls ? `<span class="${cls}">${line}</span>` : line;
        return i < hero.titleLines.length - 1 ? span + '<br>' : span;
      })
      .join('\n');
  }

  // Subtítulo
  const sub = document.querySelector('.hero-sub');
  if (sub) sub.innerHTML = hero.subtitle;

  // Badge de scroll
  const badge2 = document.querySelector('.tickets-badge');
  if (badge2) {
    badge2.innerHTML = '';
    const chevron = icon('chevronDown', 'sicon');
    badge2.appendChild(chevron);
    badge2.append(` \u00a0 ${hero.scrollBadge} \u00a0 `);
    badge2.appendChild(chevron.cloneNode(true));
  }

  // CTAs
  const cta = document.querySelector('.hero-cta');
  if (cta) {
    const primary   = cta.querySelector('a.btn-fire');
    const secondary = cta.querySelector('a.btn-ghost');
    if (primary) {
      primary.href = hero.ctaPrimary.href;
      primary.innerHTML = '';
      primary.appendChild(icon('ticket', 'sicon'));
      primary.append(` ${hero.ctaPrimary.label}`);
    }
    if (secondary) {
      secondary.href      = hero.ctaSecondary.href;
      secondary.textContent = hero.ctaSecondary.label;
    }
  }
}

export function renderPrizes(prizes) {
  const row = document.querySelector('.prizes-row');
  if (!row) return;
  row.innerHTML = '';
  prizes.forEach(p => {
    const chip = document.createElement('div');
    chip.className = 'prize-chip';

    const place = document.createElement('span');
    place.className = 'place';
    place.appendChild(icon(p.medal, 'sicon prize-icon'));
    place.append(` ${p.place}`);

    const amount = document.createElement('span');
    amount.className = 'amount';
    amount.textContent = p.amount;

    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = p.label;

    chip.appendChild(place);
    chip.appendChild(amount);
    chip.appendChild(label);
    row.appendChild(chip);
  });
}

export function renderTicketSection(ticket) {
  // Precio
  const label = document.querySelector('.price-label');
  const tag   = document.querySelector('.price-tag');
  if (label) label.textContent  = ticket.priceLabel;
  if (tag)   tag.innerHTML      = `${ticket.price} <small>${ticket.currency}</small>`;

  // Eyebrow + título sección
  const eyebrow = document.querySelector('.ticket-section .section-eyebrow');
  const title   = document.querySelector('.ticket-section .section-title');
  if (eyebrow) eyebrow.textContent = ticket.sectionEyebrow;
  if (title)   title.innerHTML     = ticket.sectionTitle.replace(
    /NÚMERO/, '<span class="g">NÚMERO</span>'
  );

  // Tabs
  const tabs = document.querySelectorAll('.mode-tab');
  if (tabs[0]) {
    tabs[0].innerHTML = '';
    tabs[0].appendChild(icon('dice', 'sicon'));
    tabs[0].append(` ${ticket.randomTabLabel}`);
  }
  if (tabs[1]) {
    tabs[1].innerHTML = '';
    tabs[1].appendChild(icon('pencil', 'sicon'));
    tabs[1].append(` ${ticket.manualTabLabel}`);
  }

  // Texto panel aleatorio
  const hint = document.querySelector('.rand-hint');
  if (hint) hint.textContent = ticket.randHint;

  const btnRand = document.getElementById('btn-genrand');
  if (btnRand) {
    btnRand.innerHTML = '';
    btnRand.appendChild(icon('dice', 'sicon'));
    btnRand.append(` ${ticket.randButtonLabel}`);
  }

  // Range hint
  const rangeHint = document.querySelector('.range-hint');
  if (rangeHint) rangeHint.textContent = ticket.rangeHint;

  // Botón WA
  const waBtn = document.getElementById('wa-btn');
  if (waBtn) {
    waBtn.innerHTML = '';
    waBtn.appendChild(icon('wa', 'sicon'));
    waBtn.append(` ${ticket.waButtonLabel}`);
  }

  // Nota
  const note = document.querySelector('.ticket-note');
  if (note) note.innerHTML = `${ticket.noteText}<br><strong style="color:var(--dorado)">${ticket.noteHighlight}</strong>`;
}

export function renderSocial(social) {
  const eyebrow = document.querySelector('.social-section .section-eyebrow');
  const title   = document.querySelector('.social-section .section-title');
  const sub     = document.querySelector('.social-section p');
  const deco    = document.querySelector('.deco-line');

  if (eyebrow) eyebrow.textContent = social.eyebrow;
  if (title)   title.innerHTML     = social.title.replace(
    /REDES/, '<span class="g">REDES</span>'
  );
  if (sub)   sub.textContent   = social.subtitle;
  if (deco)  deco.textContent  = social.closingLine;

  const cards = document.querySelector('.social-cards');
  if (!cards) return;
  cards.innerHTML = social.networks
    .map(n => `
      <a href="${n.url}" target="_blank" rel="noopener noreferrer" class="scard ${n.id}">
        <svg class="sicon" viewBox="${icon(n.id).getAttribute ? '' : '0 0 24 24'}" fill="currentColor" aria-hidden="true"></svg>
        ${n.label}
      </a>`)
    .join('');

  // Insertar SVGs reales (no se puede serializar directamente a innerHTML)
  cards.querySelectorAll('.scard').forEach(card => {
    const id     = [...card.classList].find(c => ['ig','fb','tt','wa'].includes(c));
    const svgEl  = icon(id, 'sicon');
    card.replaceChild(svgEl, card.querySelector('svg'));
  });
}

export function renderFooter(footer) {
  const logo = document.querySelector('.f-logo');
  const text = document.querySelector('.f-text');

  if (logo) {
    logo.innerHTML = '';
    logo.appendChild(icon('flame', 'sicon'));
    logo.append(` ${footer.brand}`);
  }
  if (text) text.innerHTML = `${footer.copyright}<br>
    <span style="font-size:.6rem;opacity:.6">${footer.note}</span>`;
}

export function renderPageMeta(site) {
  document.title = site.title;
  // NOTE: el logo del nav lo renderiza renderNav() para no duplicar lógica.
}
