const grid = document.querySelector('#productGrid');
const drawer = document.querySelector('#cartDrawer');
const overlay = document.querySelector('#cartOverlay');
const cartItems = document.querySelector('#cartItems');
const cartEmpty = document.querySelector('#cartEmpty');
const cartCount = document.querySelector('#cartCount');
const cartTotal = document.querySelector('#cartTotal');
const checkoutLink = document.querySelector('#checkoutLink');
const searchInput = document.querySelector('#productSearch');
const sortInput = document.querySelector('#productSort');
const priceInput = document.querySelector('#priceRange');
const stockInput = document.querySelector('#stockOnly');
const productModal = document.querySelector('#productModal');
const productModalContent = document.querySelector('#productModalContent');
const marketToast = document.querySelector('#marketToast');
const cartTrigger = document.querySelector('#cartTrigger');
const heroSpotlight = document.querySelector('#heroProductSpotlight');
const filterSidebar = document.querySelector('#catalogFilters');
const filterOverlay = document.querySelector('#filterOverlay');
const filterToggle = document.querySelector('#filterToggle');
const mobileCartBar = document.querySelector('#mobileCartBar');
const mobileCartCount = document.querySelector('#mobileCartCount');
const mobileCartTotal = document.querySelector('#mobileCartTotal');
const shopHeader = document.querySelector('.shop-header');
const marketNavToggle = document.querySelector('#marketNavToggle');
const accountToken = localStorage.getItem('jz-account-token');

let products = [];
let reviews = [];
let filters = [];
let productsLoaded = false;
let currentFilter = 'all';
let showSavedProducts = false;
let currency = 'USD';
let lastProductFocus = null;
let lastProductId = '';
let lastCartFocus = null;

const readLocalList = (key) => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

let cart = readLocalList('jz-market-cart')
  .filter((item) => item && typeof item.id === 'string')
  .map((item) => ({
    id: item.id,
    quantity: Math.max(1, Math.min(99, Number(item.quantity) || 1)),
    variant: typeof item.variant === 'string' ? item.variant : ''
  }));
let savedProducts = readLocalList('jz-market-saved').filter((id) => typeof id === 'string');

const esc = (value) => {
  const element = document.createElement('span');
  element.textContent = String(value ?? '');
  return element.innerHTML;
};

const money = (value) => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0
    }).format(Number(value) || 0);
  } catch {
    return `$${Math.round(Number(value) || 0).toLocaleString('en-US')}`;
  }
};

const productPrice = (product) => Number(product.salePrice || product.price || 0);

const productRating = (id) => {
  const items = reviews.filter((review) => review.targetType === 'product' && review.targetId === id);
  if (!items.length) return null;
  return {
    count: items.length,
    average: items.reduce((sum, item) => sum + Number(item.rating || 0), 0) / items.length
  };
};

function productGallery(product) {
  const gallery = (product.images || []).filter(Boolean);
  if (product.image && !gallery.includes(product.image)) gallery.unshift(product.image);
  return gallery;
}

function art(product) {
  const gallery = productGallery(product);
  if (gallery.length) {
    return `<div class="product-art product-image">
      <div class="image-fallback"><b>${esc(product.category || 'JZ')}</b></div>
      ${gallery.slice(0, 2).map((source, index) => `<img class="${index ? 'secondary-product-image' : ''}" src="${esc(source)}" alt="${esc(product.name)}${index ? ' alternate view' : ''}" loading="lazy">`).join('')}
      ${gallery.length > 1 ? `<b class="gallery-count">${gallery.length} photos</b>` : ''}
    </div>`;
  }

  const type = product.art;
  if (type === 'phone-apple' || type === 'phone-galaxy') {
    return `<div class="product-art phone-art ${type === 'phone-galaxy' ? 'phone-galaxy' : ''}">
      <div class="market-device ${type === 'phone-galaxy' ? 'square' : ''}"><i></i><b>${type === 'phone-apple' ? 'PRO' : 'AI'}</b></div>
      <span>${esc(product.condition)} / ready</span>
    </div>`;
  }
  if (type === 'laptop' || type === 'thinkpad') {
    return `<div class="product-art market-laptop-art ${type === 'thinkpad' ? 'dark-laptop' : ''}">
      <div class="product-laptop"><b>${type === 'thinkpad' ? 'WORK / PLAY' : 'CREATE.'}</b></div>
      <span>${esc(product.condition)} / ready</span>
    </div>`;
  }
  if (type === 'game-fc' || type === 'game-forza') {
    return `<div class="product-art game-art ${type}">
      <div class="game-box"><small>JZ SELECT</small><b>${type === 'game-fc' ? 'FC<br><i>26</i>' : 'FORZA<br><i>HORIZON 5</i>'}</b><span>READY TO PLAY</span></div>
    </div>`;
  }
  if (type === 'car-sky' || type === 'car-night') {
    return `<div class="product-art market-car-art ${type}">
      <div class="product-car ${type === 'car-night' ? 'luxury' : ''}"><i></i><b></b><b></b></div>
      <span>${esc(product.condition)} / verified</span>
    </div>`;
  }
  if (type === 'camera') {
    return `<div class="product-art camera-art"><div class="camera-shape"><i></i><b>4K</b></div><span>create anywhere</span></div>`;
  }
  if (type === 'mic') {
    return `<div class="product-art mic-art"><div class="mic-shape"><i></i></div><span>sound like a pro</span></div>`;
  }
  return `<div class="product-art generic-art"><b>${esc(product.category || 'JZ')}</b><span>JZ Market</span></div>`;
}

function priceMatches(product) {
  const value = productPrice(product);
  if (priceInput.value === 'under-100') return value < 100;
  if (priceInput.value === '100-500') return value >= 100 && value <= 500;
  if (priceInput.value === '500-1500') return value > 500 && value <= 1500;
  if (priceInput.value === 'over-1500') return value > 1500;
  return true;
}

function visibleProducts() {
  const query = searchInput.value.trim().toLowerCase();
  const visible = products.filter((product) => (
    (currentFilter === 'all' || product.category === currentFilter)
    && (!showSavedProducts || savedProducts.includes(product.id))
    && (!stockInput.checked || Number(product.stock) > 0)
    && priceMatches(product)
    && (!query || [
      product.name,
      product.category,
      product.collection,
      product.condition,
      product.description
    ].some((value) => String(value || '').toLowerCase().includes(query)))
  ));

  if (sortInput.value === 'featured') visible.sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
  if (sortInput.value === 'price-low') visible.sort((a, b) => productPrice(a) - productPrice(b));
  if (sortInput.value === 'price-high') visible.sort((a, b) => productPrice(b) - productPrice(a));
  if (sortInput.value === 'name') visible.sort((a, b) => a.name.localeCompare(b.name));
  return visible;
}

function currentFilterSummary(count) {
  const details = [];
  const query = searchInput.value.trim();
  const priceLabel = priceInput.options[priceInput.selectedIndex]?.textContent;
  if (showSavedProducts) details.push('saved products');
  if (currentFilter !== 'all') details.push(currentFilter);
  if (priceInput.value !== 'all') details.push(priceLabel.toLowerCase());
  if (stockInput.checked) details.push('available now');
  if (query) details.push(`matching “${query}”`);
  if (!details.length) return `Showing all ${count} products in the current edit`;
  return `Showing ${count} product${count === 1 ? '' : 's'} · ${details.join(' · ')}`;
}

function activeFilterTotal() {
  return Number(currentFilter !== 'all')
    + Number(priceInput.value !== 'all')
    + Number(stockInput.checked)
    + Number(showSavedProducts);
}

function renderProducts({ focusProductId = '', focusAction = '' } = {}) {
  if (!productsLoaded) return;
  const variantSelections = new Map(
    [...grid.querySelectorAll('.product')].map((card) => [
      card.dataset.id,
      card.querySelector('.variant-select')?.value || ''
    ])
  );
  const activeCatalogControl = grid.contains(document.activeElement)
    ? {
        productId: document.activeElement.closest('.product')?.dataset.id || '',
        selector: ['.save-product', '.quick-view', '.product-open', '.card-details', '.add-cart', '.variant-select']
          .find((selector) => document.activeElement.matches(selector)) || ''
      }
    : null;
  const visible = visibleProducts();
  document.querySelector('#resultCount').textContent = visible.length;
  document.querySelector('#catalogSummary').textContent = currentFilterSummary(visible.length);
  document.querySelector('#savedProductCount').textContent = savedProducts.length;
  document.querySelector('#activeFilterCount').textContent = activeFilterTotal();
  document.querySelector('#savedProductsFilter').classList.toggle('active', showSavedProducts);
  document.querySelector('#savedProductsFilter').setAttribute('aria-pressed', String(showSavedProducts));
  document.querySelector('#clearProductFilters').disabled = (
    currentFilter === 'all'
    && !searchInput.value.trim()
    && !showSavedProducts
    && !stockInput.checked
    && priceInput.value === 'all'
    && sortInput.value === 'featured'
  );

  if (!visible.length) {
    const savedEmpty = showSavedProducts && !savedProducts.length;
    grid.innerHTML = `<div class="catalog-empty"><div>
      <span aria-hidden="true">${savedEmpty ? '♡' : '⌕'}</span>
      <strong>${savedEmpty ? 'Your shortlist is empty.' : 'No products match those choices.'}</strong>
      <p>${savedEmpty ? 'Save anything you like and it will stay here for your next visit.' : 'Try a different search, category, or price range—or reset everything to see the complete edit.'}</p>
      <button type="button" data-reset-catalog>${savedEmpty ? 'Browse all products' : 'Reset filters'}</button>
    </div></div>`;
    return;
  }

  grid.innerHTML = visible.map((product) => {
    const rating = productRating(product.id);
    const saved = savedProducts.includes(product.id);
    const stock = Number(product.stock || 0);
    const isCar = product.category === 'cars';
    const primaryLabel = isCar ? 'Ask about this car' : 'Add to bag';
    const selectedVariant = variantSelections.get(product.id);
    return `<article class="product" data-id="${esc(product.id)}">
      <div class="product-stage">
        <button class="product-open" type="button" aria-label="View ${esc(product.name)}">${art(product)}</button>
        <div class="product-card-actions">
          <button class="save-product ${saved ? 'saved' : ''}" type="button" aria-label="${saved ? 'Remove from' : 'Save to'} favorites" aria-pressed="${saved}">${saved ? '♥' : '♡'}</button>
          <button class="quick-view" type="button" aria-label="Quick view ${esc(product.name)}">Quick view</button>
        </div>
        <div class="product-card-badges">
          ${product.featured ? '<span class="product-featured">JZ PICK</span>' : ''}
          <p class="stock-note ${stock > 0 && stock < 3 ? 'low-stock' : ''}">${stock < 1 ? 'Unavailable' : stock < 3 ? `Only ${stock} left` : 'In stock'}</p>
        </div>
      </div>
      <div class="product-copy">
        <div class="product-meta">
          <p>${esc(product.collection || product.category)}</p>
          <span>${esc(product.condition || 'checked')}</span>
        </div>
        <div class="product-title-row">
          <h3>${esc(product.name)}</h3>
          <strong class="product-price">${product.salePrice ? `<del>${money(product.price)}</del>${money(product.salePrice)}` : money(product.price)}</strong>
        </div>
        ${rating ? `<span class="product-rating">★ ${rating.average.toFixed(1)} · ${rating.count} review${rating.count === 1 ? '' : 's'}</span>` : '<span class="product-rating product-rating-new">New to the collection</span>'}
        <p class="product-description">${esc(product.description)}</p>
        <div class="product-trust"><span>Quality checked</span><span>Personal support</span></div>
        ${(product.variants || []).length ? `<label class="variant-select-label">Choose option<select class="variant-select">${product.variants.map((variant) => `<option value="${esc(variant)}" ${variant === selectedVariant ? 'selected' : ''}>${esc(variant)}</option>`).join('')}</select></label>` : ''}
        <div class="product-actions">
          <button class="add-cart ${isCar ? 'product-inquiry' : ''}" type="button" ${stock < 1 ? 'disabled' : ''}>${stock < 1 ? 'Unavailable' : primaryLabel}<span>${isCar ? '↗' : '+'}</span></button>
          <button class="card-details" type="button" aria-label="View details for ${esc(product.name)}">↗</button>
        </div>
      </div>
    </article>`;
  }).join('');

  if (focusProductId) {
    requestAnimationFrame(() => {
      const safeId = window.CSS?.escape ? CSS.escape(focusProductId) : focusProductId.replace(/["\\]/g, '\\$&');
      const target = grid.querySelector(`[data-id="${safeId}"] ${focusAction || '.save-product'}`);
      (target || searchInput).focus();
    });
  } else if (activeCatalogControl?.productId && activeCatalogControl.selector) {
    requestAnimationFrame(() => {
      const safeId = window.CSS?.escape ? CSS.escape(activeCatalogControl.productId) : activeCatalogControl.productId.replace(/["\\]/g, '\\$&');
      grid.querySelector(`[data-id="${safeId}"] ${activeCatalogControl.selector}`)?.focus();
    });
  }
}

function renderHeroSpotlight(product) {
  if (!product) {
    heroSpotlight.innerHTML = '<div class="spotlight-loading"><p>No featured product is available right now.</p></div>';
    return;
  }
  const stock = Number(product.stock || 0);
  heroSpotlight.innerHTML = `
    <div class="spotlight-visual">
      ${art(product)}
      <div class="spotlight-flags"><span>JZ pick</span><span>${stock > 0 ? `${stock} available` : 'Ask for availability'}</span></div>
    </div>
    <div class="spotlight-copy">
      <div><small>${esc(product.category)} / ${esc(product.condition || 'checked')}</small><h2>${esc(product.name)}</h2></div>
      <strong>${money(productPrice(product))}</strong>
      <button type="button" data-hero-open="${esc(product.id)}">View this product <span>↗</span></button>
    </div>`;
}

function showToast(message) {
  marketToast.textContent = message;
  marketToast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => marketToast.classList.remove('show'), 2200);
}

function saveProductsToAccount() {
  if (!accountToken) return;
  fetch('/api/account/saved', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accountToken}` },
    body: JSON.stringify({ products: savedProducts })
  }).catch(() => {});
}

function toggleSavedProduct(id, options = {}) {
  const wasSaved = savedProducts.includes(id);
  savedProducts = wasSaved ? savedProducts.filter((item) => item !== id) : [...new Set([...savedProducts, id])];
  localStorage.setItem('jz-market-saved', JSON.stringify(savedProducts));
  saveProductsToAccount();

  if (options.fromModal) {
    const modalButton = productModal.querySelector('[data-modal-save]');
    if (modalButton) {
      modalButton.classList.toggle('saved', !wasSaved);
      modalButton.textContent = wasSaved ? '♡ Save item' : '♥ Saved';
    }
    renderProducts();
  } else {
    renderProducts({ focusProductId: id, focusAction: '.save-product' });
  }
  showToast(wasSaved ? 'Removed from saved products' : 'Saved to your shortlist');
}

function addProductToCart(product, variant = '') {
  if (!product || Number(product.stock) < 1) {
    showToast('This product is not currently available');
    return false;
  }

  const item = cart.find((entry) => entry.id === product.id && entry.variant === variant);
  const productQuantity = cart
    .filter((entry) => entry.id === product.id)
    .reduce((sum, entry) => sum + entry.quantity, 0);
  if (productQuantity >= Number(product.stock)) {
    showToast(`You already have the available quantity of ${product.name}`);
    return false;
  }
  if (item) item.quantity += 1;
  else cart.push({ id: product.id, quantity: 1, variant });

  fetch('/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'add_to_cart', path: location.pathname, itemId: product.id, label: product.name })
  }).catch(() => {});

  renderCart();
  showToast(`${product.name} added to your bag`);
  return true;
}

function openSupport() {
  const supportLauncher = document.querySelector('.jz-support-launcher');
  if (supportLauncher) supportLauncher.click();
  else showToast('Visitor support is loading. Please try again.');
}

function modalGallery(product) {
  const gallery = productGallery(product);
  if (!gallery.length) return art(product);
  return `<div class="modal-gallery">
    <img class="modal-main-image" id="modalMainImage" src="${esc(gallery[0])}" alt="${esc(product.name)}">
    ${gallery.length > 1 ? `<div class="modal-thumbnails" aria-label="Product images">${gallery.map((source, index) => `<button class="${index === 0 ? 'active' : ''}" type="button" data-gallery-src="${esc(source)}" aria-label="View image ${index + 1}"><img src="${esc(source)}" alt=""></button>`).join('')}</div>` : ''}
  </div>`;
}

function setBackgroundInert(inert) {
  document.querySelectorAll('.market-note, .shop-header, main, .mobile-cart-bar, #jzSupportWidget').forEach((element) => {
    element.inert = inert;
  });
}

function setFilterBackgroundInert(inert) {
  document.querySelectorAll('.market-note, .shop-header, .market-hero, .market-assurance, .marketplace-heading, .catalog-main, .market-service, .mobile-cart-bar, #jzSupportWidget').forEach((element) => {
    element.inert = inert;
  });
}

function syncBodyLock() {
  const locked = drawer.classList.contains('open') || productModal.classList.contains('open') || filterSidebar.classList.contains('open');
  document.body.style.overflow = locked ? 'hidden' : '';
}

function openProduct(product, trigger = document.activeElement) {
  if (!product) return;
  lastProductFocus = trigger instanceof HTMLElement ? trigger : null;
  lastProductId = product.id;
  const rating = productRating(product.id);
  const isCar = product.category === 'cars';

  productModalContent.innerHTML = `
    <div class="product-modal-media">${modalGallery(product)}</div>
    <div class="product-modal-copy">
      <p>${esc(product.collection || product.category)} · ${esc(product.condition || 'checked')}</p>
      <h2 id="productModalTitle">${esc(product.name)}</h2>
      ${rating ? `<div class="product-rating">★ ${rating.average.toFixed(1)} from ${rating.count} verified review${rating.count === 1 ? '' : 's'}</div>` : ''}
      <div class="modal-price">${product.salePrice ? `<del>${money(product.price)}</del><strong>${money(product.salePrice)}</strong>` : `<strong>${money(product.price)}</strong>`}</div>
      <p class="modal-description">${esc(product.description || 'A considered JZ Market find, quality checked and personally supported.')}</p>
      <ul>
        <li>Personally checked before handover</li>
        <li>${Number(product.stock) > 0 ? `${product.stock} currently available` : 'Currently unavailable'}</li>
        <li>Direct support from question to delivery</li>
      </ul>
      ${(product.variants || []).length ? `<label>Choose option<select id="modalVariant">${product.variants.map((variant) => `<option>${esc(variant)}</option>`).join('')}</select></label>` : ''}
      <div class="modal-actions">
        <button class="modal-add-cart ${isCar ? 'modal-inquiry' : ''}" type="button" data-modal-add="${esc(product.id)}" ${Number(product.stock) < 1 ? 'disabled' : ''}>
          ${Number(product.stock) < 1 ? 'Unavailable' : isCar ? 'Ask about this car' : 'Add to bag'} <span>↗</span>
        </button>
        <button class="modal-save ${savedProducts.includes(product.id) ? 'saved' : ''}" type="button" data-modal-save="${esc(product.id)}">${savedProducts.includes(product.id) ? '♥ Saved' : '♡ Save item'}</button>
      </div>
      <small>${isCar ? 'Vehicle availability and inspection details are confirmed directly with JZ.' : 'Availability and delivery are personally confirmed before payment.'}</small>
    </div>`;

  productModal.inert = false;
  productModal.classList.add('open');
  productModal.setAttribute('aria-hidden', 'false');
  setBackgroundInert(true);
  syncBodyLock();
  requestAnimationFrame(() => productModal.querySelector('.product-modal-close')?.focus());

  fetch('/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'product_view', path: location.pathname, itemId: product.id, label: product.name })
  }).catch(() => {});
}

function closeProduct({ restoreFocus = true } = {}) {
  if (!productModal.classList.contains('open')) return;
  productModal.classList.remove('open');
  productModal.setAttribute('aria-hidden', 'true');
  productModal.inert = true;
  setBackgroundInert(false);
  syncBodyLock();
  if (!restoreFocus) return;
  requestAnimationFrame(() => {
    if (lastProductFocus?.isConnected) {
      lastProductFocus.focus();
      return;
    }
    const safeId = window.CSS?.escape ? CSS.escape(lastProductId) : lastProductId.replace(/["\\]/g, '\\$&');
    (grid.querySelector(`[data-id="${safeId}"] .card-details`) || searchInput).focus();
  });
}

function renderCart({ notifyAdjustments = false } = {}) {
  const cartBeforeValidation = JSON.stringify(cart);
  if (productsLoaded) {
    const remainingStock = new Map(products.map((product) => [product.id, Math.max(0, Number(product.stock) || 0)]));
    cart = cart.flatMap((item) => {
      const product = products.find((entry) => entry.id === item.id);
      const remaining = remainingStock.get(item.id) || 0;
      if (!product || remaining < 1) return [];
      const quantity = Math.min(Math.max(1, item.quantity), remaining);
      remainingStock.set(item.id, remaining - quantity);
      return [{ ...item, quantity }];
    });
  }

  const rows = cart
    .map((item, index) => ({ ...item, index, product: products.find((product) => product.id === item.id) }))
    .filter((row) => row.product);

  const productQuantities = new Map();
  rows.forEach((row) => productQuantities.set(row.id, (productQuantities.get(row.id) || 0) + row.quantity));
  cartItems.innerHTML = rows.map(({ product, quantity, variant, index }) => {
    const image = productGallery(product)[0];
    return `<div class="cart-item">
      ${image ? `<img src="${esc(image)}" alt="">` : `<span class="cart-item-fallback">${esc(product.name[0])}</span>`}
      <div>
        <h3>${esc(product.name)}</h3>
        <p>${money(productPrice(product))}${variant ? ` · ${esc(variant)}` : ''} · ${product.stock} available</p>
        <div class="qty">
          <button type="button" data-qty="-1" data-index="${index}" aria-label="Decrease ${esc(product.name)} quantity">−</button>
          <span>${quantity}</span>
          <button type="button" data-qty="1" data-index="${index}" aria-label="Increase ${esc(product.name)} quantity" ${(productQuantities.get(product.id) || 0) >= Number(product.stock) ? 'disabled' : ''}>+</button>
        </div>
      </div>
      <button type="button" data-remove-index="${index}" aria-label="Remove ${esc(product.name)} from bag">Remove</button>
    </div>`;
  }).join('');

  const itemCount = rows.reduce((sum, item) => sum + item.quantity, 0);
  const total = rows.reduce((sum, row) => sum + productPrice(row.product) * row.quantity, 0);
  cartCount.textContent = itemCount;
  cartTotal.textContent = money(total);
  mobileCartCount.textContent = `${itemCount} item${itemCount === 1 ? '' : 's'}`;
  mobileCartTotal.textContent = money(total);
  mobileCartBar.classList.toggle('has-items', itemCount > 0);
  cartEmpty.classList.toggle('hidden', Boolean(rows.length));
  checkoutLink.href = rows.length ? 'checkout.html' : '#';
  checkoutLink.classList.toggle('disabled', !rows.length);
  if (rows.length) {
    checkoutLink.removeAttribute('aria-disabled');
    checkoutLink.removeAttribute('tabindex');
  } else {
    checkoutLink.setAttribute('aria-disabled', 'true');
    checkoutLink.setAttribute('tabindex', '-1');
  }
  localStorage.setItem('jz-market-cart', JSON.stringify(cart));
  if (notifyAdjustments && cartBeforeValidation !== JSON.stringify(cart)) {
    showToast('Your bag was updated to match current availability');
  }
}

function openCart() {
  if (productModal.classList.contains('open')) closeProduct({ restoreFocus: false });
  lastCartFocus = document.activeElement?.closest?.('.product-modal') ? cartTrigger : document.activeElement;
  drawer.inert = false;
  drawer.classList.add('open');
  overlay.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
  cartTrigger.setAttribute('aria-expanded', 'true');
  mobileCartBar.setAttribute('aria-expanded', 'true');
  setBackgroundInert(true);
  syncBodyLock();
  requestAnimationFrame(() => document.querySelector('#cartClose')?.focus());
}

function closeCart() {
  if (!drawer.classList.contains('open')) return;
  drawer.classList.remove('open');
  overlay.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
  drawer.inert = true;
  cartTrigger.setAttribute('aria-expanded', 'false');
  mobileCartBar.setAttribute('aria-expanded', 'false');
  setBackgroundInert(false);
  syncBodyLock();
  requestAnimationFrame(() => lastCartFocus?.isConnected && lastCartFocus.focus());
}

function setFilter(category) {
  currentFilter = category;
  filters.forEach((button) => {
    const active = button.dataset.filter === category;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  renderProducts();
}

function resetCatalog() {
  searchInput.value = '';
  sortInput.value = 'featured';
  priceInput.value = 'all';
  stockInput.checked = false;
  showSavedProducts = false;
  setFilter('all');
}

function setView(view) {
  const list = view === 'list';
  grid.classList.toggle('list-view', list);
  document.querySelector('#gridView').classList.toggle('active', !list);
  document.querySelector('#listView').classList.toggle('active', list);
  document.querySelector('#gridView').setAttribute('aria-pressed', String(!list));
  document.querySelector('#listView').setAttribute('aria-pressed', String(list));
  localStorage.setItem('jz-market-view', list ? 'list' : 'grid');
}

function openFilters() {
  filterSidebar.classList.add('open');
  filterOverlay.classList.add('open');
  filterSidebar.inert = false;
  filterSidebar.setAttribute('aria-hidden', 'false');
  filterSidebar.setAttribute('role', 'dialog');
  filterSidebar.setAttribute('aria-modal', 'true');
  filterToggle.setAttribute('aria-expanded', 'true');
  setFilterBackgroundInert(true);
  syncBodyLock();
  requestAnimationFrame(() => document.querySelector('#filterClose')?.focus());
}

function closeFilters() {
  if (!filterSidebar.classList.contains('open')) return;
  filterSidebar.classList.remove('open');
  filterOverlay.classList.remove('open');
  if (matchMedia('(max-width: 900px)').matches) filterSidebar.inert = true;
  filterSidebar.setAttribute('aria-hidden', 'true');
  filterSidebar.removeAttribute('role');
  filterSidebar.removeAttribute('aria-modal');
  filterToggle.setAttribute('aria-expanded', 'false');
  setFilterBackgroundInert(false);
  syncBodyLock();
  requestAnimationFrame(() => filterToggle.focus());
}

function syncFilterMode() {
  if (matchMedia('(max-width: 900px)').matches) {
    filterSidebar.inert = !filterSidebar.classList.contains('open');
    filterSidebar.setAttribute('aria-hidden', String(!filterSidebar.classList.contains('open')));
  } else {
    filterSidebar.inert = false;
    filterSidebar.setAttribute('aria-hidden', 'false');
    filterSidebar.removeAttribute('role');
    filterSidebar.removeAttribute('aria-modal');
    filterSidebar.classList.remove('open');
    filterOverlay.classList.remove('open');
    filterToggle.setAttribute('aria-expanded', 'false');
    setFilterBackgroundInert(false);
    syncBodyLock();
  }
}

function toggleMarketNav(force) {
  const open = force ?? !shopHeader.classList.contains('menu-open');
  shopHeader.classList.toggle('menu-open', open);
  marketNavToggle.setAttribute('aria-expanded', String(open));
  marketNavToggle.querySelector('b').textContent = open ? 'Close' : 'Menu';
}

function trapFocus(event, container) {
  if (event.key !== 'Tab') return;
  const focusable = [...container.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter((element) => !element.hidden && getComputedStyle(element).visibility !== 'hidden');
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function buildFilters() {
  const categories = [...new Set(products.map((product) => product.category).filter(Boolean))];
  const filterHost = document.querySelector('.filters');
  filterHost.innerHTML = `<button class="filter active" data-filter="all" type="button">All products</button>${categories.map((category) => `<button class="filter" data-filter="${esc(category)}" type="button">${esc(category.replace(/(^|\s)\S/g, (letter) => letter.toUpperCase()))}</button>`).join('')}`;
  filters = [...filterHost.querySelectorAll('.filter')];
  filters.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.filter === 'all'));
    button.addEventListener('click', () => {
      setFilter(button.dataset.filter);
      if (matchMedia('(max-width: 900px)').matches) closeFilters();
    });
  });
  return categories;
}

function setControlsDisabled(disabled) {
  [searchInput, sortInput, priceInput, stockInput, filterToggle, document.querySelector('#savedProductsFilter'), document.querySelector('#clearProductFilters')]
    .forEach((control) => { if (control) control.disabled = disabled; });
}

async function loadProducts() {
  productsLoaded = false;
  setControlsDisabled(true);
  grid.innerHTML = '<div class="catalog-loading" role="status"><span class="market-spinner" aria-hidden="true"></span><strong>Preparing the collection</strong><small>Checking current products and availability…</small></div>';

  try {
    const response = await fetch('/api/products');
    if (!response.ok) throw new Error('Products could not be loaded.');
    const data = await response.json();
    products = Array.isArray(data) ? data : [];
    productsLoaded = true;
    setControlsDisabled(false);
    const categories = buildFilters();
    const requested = new URLSearchParams(location.search).get('category');
    if (requested && categories.includes(requested)) setFilter(requested);
    else renderProducts();
    renderHeroSpotlight(products.find((product) => product.featured) || products[0]);
    renderCart({ notifyAdjustments: true });
  } catch {
    products = [];
    grid.innerHTML = '<div class="load-error"><span aria-hidden="true">!</span><strong>The collection could not load.</strong><p>Check your connection and try again.</p><button type="button" data-retry-products>Try again</button></div>';
  }
}

searchInput.addEventListener('input', () => renderProducts());
searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && searchInput.value) {
    searchInput.value = '';
    renderProducts();
  }
});
sortInput.addEventListener('change', () => renderProducts());
priceInput.addEventListener('change', () => renderProducts());
stockInput.addEventListener('change', () => renderProducts());
document.querySelector('#clearProductFilters').addEventListener('click', resetCatalog);
document.querySelector('#savedProductsFilter').addEventListener('click', () => {
  showSavedProducts = !showSavedProducts;
  renderProducts();
});
document.querySelector('#gridView').addEventListener('click', () => setView('grid'));
document.querySelector('#listView').addEventListener('click', () => setView('list'));

grid.addEventListener('click', (event) => {
  if (event.target.closest('[data-retry-products]')) {
    loadProducts();
    return;
  }
  if (event.target.closest('[data-reset-catalog]')) {
    resetCatalog();
    return;
  }

  const card = event.target.closest('.product');
  if (!card) return;
  const product = products.find((item) => item.id === card.dataset.id);
  if (!product) return;

  if (event.target.closest('.save-product')) {
    toggleSavedProduct(product.id);
    return;
  }
  if (event.target.closest('.quick-view, .product-open, .card-details')) {
    openProduct(product, event.target.closest('button'));
    return;
  }

  const button = event.target.closest('.add-cart');
  if (!button || button.disabled) return;
  if (button.classList.contains('product-inquiry')) {
    openSupport();
    return;
  }
  addProductToCart(product, card.querySelector('.variant-select')?.value || '');
});

heroSpotlight.addEventListener('click', (event) => {
  const button = event.target.closest('[data-hero-open]');
  if (!button) return;
  openProduct(products.find((product) => product.id === button.dataset.heroOpen), button);
});

productModal.addEventListener('click', (event) => {
  if (event.target.closest('[data-close-product]')) {
    closeProduct();
    return;
  }
  const galleryButton = event.target.closest('[data-gallery-src]');
  if (galleryButton) {
    const mainImage = document.querySelector('#modalMainImage');
    if (mainImage) mainImage.src = galleryButton.dataset.gallerySrc;
    productModal.querySelectorAll('[data-gallery-src]').forEach((button) => button.classList.toggle('active', button === galleryButton));
    return;
  }
  const add = event.target.closest('[data-modal-add]');
  if (add) {
    const product = products.find((item) => item.id === add.dataset.modalAdd);
    if (add.classList.contains('modal-inquiry')) {
      closeProduct({ restoreFocus: false });
      openSupport();
      return;
    }
    if (addProductToCart(product, document.querySelector('#modalVariant')?.value || '')) {
      closeProduct({ restoreFocus: false });
      openCart();
    }
    return;
  }
  const save = event.target.closest('[data-modal-save]');
  if (save) toggleSavedProduct(save.dataset.modalSave, { fromModal: true });
});

cartItems.addEventListener('click', (event) => {
  const removeButton = event.target.closest('[data-remove-index]');
  if (removeButton) {
    cart.splice(Number(removeButton.dataset.removeIndex), 1);
    renderCart();
    return;
  }
  const quantityButton = event.target.closest('[data-qty]');
  if (!quantityButton || quantityButton.disabled) return;
  const index = Number(quantityButton.dataset.index);
  const item = cart[index];
  const product = products.find((entry) => entry.id === item?.id);
  if (!item || !product) return;
  item.quantity = Math.max(0, Math.min(Number(product.stock), item.quantity + Number(quantityButton.dataset.qty)));
  if (!item.quantity) cart.splice(index, 1);
  renderCart();
});

cartTrigger.setAttribute('aria-expanded', 'false');
cartTrigger.setAttribute('aria-controls', 'cartDrawer');
drawer.inert = true;
productModal.inert = true;
cartTrigger.addEventListener('click', openCart);
mobileCartBar.addEventListener('click', openCart);
document.querySelector('#cartClose').addEventListener('click', closeCart);
document.querySelector('#cartContinue').addEventListener('click', closeCart);
overlay.addEventListener('click', closeCart);
filterToggle.addEventListener('click', openFilters);
document.querySelector('#filterClose').addEventListener('click', closeFilters);
filterOverlay.addEventListener('click', closeFilters);
marketNavToggle.addEventListener('click', () => toggleMarketNav());
document.querySelectorAll('#shopNav a').forEach((link) => link.addEventListener('click', () => toggleMarketNav(false)));

document.addEventListener('click', (event) => {
  if (event.target.closest('[data-open-support]')) openSupport();
  if (
    shopHeader.classList.contains('menu-open')
    && !event.target.closest('.shop-header')
  ) toggleMarketNav(false);
});

document.addEventListener('error', (event) => {
  if (!(event.target instanceof HTMLImageElement)) return;
  if (event.target.matches('.product-image img, .modal-thumbnails img, .cart-item img')) {
    event.target.hidden = true;
  }
  if (event.target.matches('.modal-main-image')) {
    event.target.closest('.modal-gallery')?.classList.add('image-error');
  }
}, true);

document.addEventListener('keydown', (event) => {
  if (productModal.classList.contains('open')) {
    if (event.key === 'Escape') closeProduct();
    else trapFocus(event, productModal);
    return;
  }
  if (drawer.classList.contains('open')) {
    if (event.key === 'Escape') closeCart();
    else trapFocus(event, drawer);
    return;
  }
  if (filterSidebar.classList.contains('open')) {
    if (event.key === 'Escape') closeFilters();
    else trapFocus(event, filterSidebar);
    return;
  }
  if (event.key === 'Escape' && shopHeader.classList.contains('menu-open')) {
    toggleMarketNav(false);
    marketNavToggle.focus();
  }
});

window.addEventListener('resize', () => {
  syncFilterMode();
  if (!matchMedia('(max-width: 900px)').matches) toggleMarketNav(false);
});
document.querySelector('#year').textContent = new Date().getFullYear();
setView(localStorage.getItem('jz-market-view') === 'list' ? 'list' : 'grid');
syncFilterMode();
setControlsDisabled(true);
loadProducts();

fetch('/api/store-settings')
  .then((response) => response.ok ? response.json() : null)
  .then((settings) => {
    if (!settings?.currency || !/^[A-Z]{3}$/.test(settings.currency)) return;
    currency = settings.currency;
    if (productsLoaded) {
      renderProducts();
      renderHeroSpotlight(products.find((product) => product.featured) || products[0]);
      renderCart();
    }
  })
  .catch(() => {});

fetch('/api/reviews')
  .then((response) => response.ok ? response.json() : [])
  .then((data) => {
    reviews = Array.isArray(data) ? data : [];
    if (productsLoaded) renderProducts();
  })
  .catch(() => {});

if (accountToken) {
  fetch('/api/account/me', { headers: { Authorization: `Bearer ${accountToken}` } })
    .then((response) => response.ok ? response.json() : null)
    .then((account) => {
      if (!account) return;
      const serverSaved = account.customer?.savedProducts || [];
      savedProducts = [...new Set([...savedProducts, ...serverSaved])];
      localStorage.setItem('jz-market-saved', JSON.stringify(savedProducts));
      if (productsLoaded) renderProducts();
    })
    .catch(() => {});
}
