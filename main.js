import { initializeRAG, searchProducts } from './rag.js';

// State
let products = [];
let cart = {}; // { id: qty }
let isRAGReady = false;

// DOM Elements
const productGrid = document.getElementById('productGrid');
const searchInput = document.getElementById('searchInput');
const aiStatus = document.getElementById('aiStatus');
const spinner = document.getElementById('spinner');
const statusText = document.getElementById('statusText');
const cartBtn = document.getElementById('cartBtn');
const cartOverlay = document.getElementById('cartOverlay');
const closeCart = document.getElementById('closeCart');
const cartItemsContainer = document.getElementById('cartItems');
const cartTotalEl = document.getElementById('cartTotal');
const cartCountEl = document.getElementById('cartCount');

// Initialization
async function init() {
    // 1. Load Products
    try {
        const res = await fetch('./products.json');
        products = await res.json();
        renderProducts(products);
    } catch (err) {
        console.error("Failed to load products", err);
        statusText.textContent = "Error loading products.";
    }

    // 2. Load RAG Model
    spinner.style.display = 'block';
    const statusCallback = (msg) => {
        statusText.textContent = msg;
    };

    isRAGReady = await initializeRAG(products, statusCallback);

    if (isRAGReady) {
        spinner.style.display = 'none';
        statusText.innerHTML = '<i class="fas fa-check-circle" style="color: var(--primary)"></i> AI Ready';
        setTimeout(() => {
            aiStatus.style.opacity = '0'; // Fade out status after ready
        }, 2000);
    }
}

// Rendering
function renderProducts(list) {
    productGrid.innerHTML = list.map(product => `
        <div class="product-card">
            <img src="${product.image}" alt="${product.name}" class="product-image">
            <div class="product-info">
                <div class="product-category">${product.category}</div>
                <div class="product-title">${product.name}</div>
                <div class="product-desc">${product.description}</div>
                <div class="product-tags" style="display:none">${product.tags.join(', ')}</div> <!-- Hidden for debugging if needed -->
                
                <div class="product-footer">
                    <div class="price">$${product.price.toFixed(2)}</div>
                    <button class="add-btn" onclick="window.addToCart(${product.id})">
                        <i class="fas fa-plus"></i> Add
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function renderCart() {
    if (Object.keys(cart).length === 0) {
        cartItemsContainer.innerHTML = '<p class="empty-cart-msg">Your basket is empty.</p>';
        cartTotalEl.textContent = '$0.00';
        cartCountEl.textContent = '0';
        cartCountEl.style.display = 'none';
        return;
    }

    let total = 0;
    let itemCount = 0;

    cartItemsContainer.innerHTML = Object.entries(cart).map(([id, qty]) => {
        const product = products.find(p => p.id === parseInt(id));
        if (!product) return '';

        const itemTotal = product.price * qty;
        total += itemTotal;
        itemCount += qty;

        return `
            <div class="cart-item">
                <img src="${product.image}" alt="${product.name}">
                <div class="cart-item-details">
                    <div class="cart-item-title">${product.name}</div>
                    <div class="cart-item-price">$${product.price.toFixed(2)} x ${qty}</div>
                    <div class="cart-controls">
                        <button class="qty-btn" onclick="window.updateQty(${product.id}, -1)">-</button>
                        <span>${qty}</span>
                        <button class="qty-btn" onclick="window.updateQty(${product.id}, 1)">+</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    cartTotalEl.textContent = `$${total.toFixed(2)}`;
    cartCountEl.textContent = itemCount;
    cartCountEl.style.display = 'flex';
}

// Cart Logic
window.addToCart = (id) => {
    cart[id] = (cart[id] || 0) + 1;
    updateCartUI();
    // Open cart briefly or show toast? Let's just update badge for now to keep it simple
    // Maybe a small bounce animation on the cart button
    cartBtn.style.transform = 'scale(1.2)';
    setTimeout(() => cartBtn.style.transform = 'scale(1)', 200);
};

window.updateQty = (id, change) => {
    if (!cart[id]) return;
    cart[id] += change;
    if (cart[id] <= 0) {
        delete cart[id];
    }
    updateCartUI();
};

function updateCartUI() {
    renderCart();
}

// Search Logic
let debounceTimer;
searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
        if (!query) {
            renderProducts(products); // Show all
            return;
        }

        if (isRAGReady) {
            const results = await searchProducts(query, products);
            renderProducts(results);
        } else {
            // Fallback to simple text filter if AI not ready
            const lowerQ = query.toLowerCase();
            const results = products.filter(p =>
                p.name.toLowerCase().includes(lowerQ) ||
                p.description.toLowerCase().includes(lowerQ)
            );
            renderProducts(results);
        }
    }, 300);
});

// Event Listeners
cartBtn.addEventListener('click', () => {
    cartOverlay.classList.add('open');
    renderCart();
});

closeCart.addEventListener('click', () => {
    cartOverlay.classList.remove('open');
});

cartOverlay.addEventListener('click', (e) => {
    if (e.target === cartOverlay) {
        cartOverlay.classList.remove('open');
    }
});

// Start
init();
