import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.14.0';

let extractor = null;
let productEmbeddings = [];

// Cosine similarity function
function cosineSimilarity(a, b) {
    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        magnitudeA += a[i] * a[i];
        magnitudeB += b[i] * b[i];
    }
    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);
    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    return dotProduct / (magnitudeA * magnitudeB);
}

export async function initializeRAG(products, statusCallback) {
    try {
        if (!extractor) {
            statusCallback("Loading AI Model (approx 20MB)...");
            // Use a smaller, faster model (Quantized)
            extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
            statusCallback("Model Loaded.");
        }

        statusCallback("Generating Product Embeddings...");

        // Generate embeddings for all products
        // We combine name, description, and tags for a rich semantic representation
        for (const product of products) {
            const textToEmbed = `${product.name}. ${product.description}. Tags: ${product.tags.join(', ')}`;
            const output = await extractor(textToEmbed, { pooling: 'mean', normalize: true });
            productEmbeddings.push({
                id: product.id,
                embedding: output.data
            });
        }
        statusCallback("RAG System Ready.");
        return true;
    } catch (error) {
        console.error("RAG Initialization failed:", error);
        statusCallback("Error Loading AI.");
        return false;
    }
}

export async function searchProducts(query, products, topK = 5) {
    if (!extractor || productEmbeddings.length === 0) {
        console.warn("RAG not initialized or empty.");
        return [];
    }

    // Embed the search query
    const output = await extractor(query, { pooling: 'mean', normalize: true });
    const queryEmbedding = output.data;

    // Calculate similarity scores
    const scores = productEmbeddings.map(p => {
        return {
            id: p.id,
            score: cosineSimilarity(queryEmbedding, p.embedding)
        };
    });

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    // Return top K products
    const topIds = scores.slice(0, topK).map(s => s.id);
    return products.filter(p => topIds.includes(p.id))
        // Re-order to match score order
        .sort((a, b) => topIds.indexOf(a.id) - topIds.indexOf(b.id));
}
