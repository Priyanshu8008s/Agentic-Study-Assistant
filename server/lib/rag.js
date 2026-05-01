import { ChromaClient } from "chromadb";
import { GoogleGenAI } from "@google/genai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { PDFParse } from "pdf-parse";
import crypto from "crypto";
import "dotenv/config";

const chromaClient = new ChromaClient({ path: "http://localhost:8000" });
let collection = null;

async function getCollection() {
  if (!collection) {
    collection = await chromaClient.getOrCreateCollection({
      name: "academic_materials_v2",
      metadata: { "hnsw:space": "cosine" },
      embeddingFunction: { generate: () => [] } 
    }).catch(err => {
      console.warn("ChromaDB connection failed. Please ensure Chroma is running on port 8000.", err.message);
      return null;
    });
  }
  return collection;
}

function getGoogleGenAI() {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

async function embedText(text) {
  try {
    const ai = getGoogleGenAI();
    const response = await ai.models.embedContent({
      model: "gemini-embedding-2",
      contents: text,
    });
    // New SDK returns response.embeddings[0].values
    const values = response.embeddings?.[0]?.values ?? response.embedding?.values;
    if (!values) throw new Error("No embedding values returned");
    return values;
  } catch (error) {
    console.error("Error generating embedding:", error.message);
    return new Array(768).fill(0); // Fallback zero vector
  }
}

async function generateOutline(text, fallbackModel = null) {
  const modelToUse = fallbackModel || "gemini-2.5-pro";
  try {
    const ai = getGoogleGenAI();
    const prompt = `Analyze the following document text and extract a hierarchical course outline. Return ONLY a JSON object containing a list of 'topics', each with a list of 'subtopics' (as strings).

Document Text:
${text.substring(0, 100000)} // Truncating to avoid massive payloads, though 2.5 handles large context`;

    const response = await ai.models.generateContent({
      model: modelToUse,
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    let jsonString = response.text;
    jsonString = jsonString.replace(/```json\n?|```\n?/g, "");
    return JSON.parse(jsonString);
  } catch (error) {
    if (error.status === 429 && modelToUse !== "gemini-2.5-flash") {
      console.log(`Model ${modelToUse} hit rate limit in generateOutline. Falling back to gemini-2.5-flash...`);
      return await generateOutline(text, "gemini-2.5-flash");
    }
    console.error("Error generating outline:", error);
    return { topics: [] };
  }
}

export async function processAndStorePDF(fileBuffer, filename) {
  try {
    // 1. Parse PDF
    const parser = new PDFParse({ data: fileBuffer });
    const data = await parser.getText();
    const text = data.text;

    // 1.5 Generate Course Outline
    const outline = await generateOutline(text);

    // 2. Chunk Text (Optimized for academic context)
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ["\n\n", "\n", ".", "!", "?", " ", ""],
    });
    
    const chunks = await splitter.createDocuments([text]);
    
    // 3. Prepare data for Chroma
    const ids = [];
    const embeddings = [];
    const metadatas = [];
    const documents = [];

    // Process in batches to avoid rate limits
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkText = chunk.pageContent;
      
      const embedding = await embedText(chunkText);
      
      const id = crypto.randomUUID();
      ids.push(id);
      embeddings.push(embedding);
      documents.push(chunkText);
      metadatas.push({
        filename,
        chunkIndex: i,
        documentType: "academic_material"
      });
      
      // Optional: Add a small delay between embedding calls to prevent quota issues
      if (i % 10 === 0) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    // 4. Store in ChromaDB
    const col = await getCollection();
    if (col && ids.length > 0) {
      await col.upsert({
        ids,
        embeddings,
        metadatas,
        documents
      });
      console.log(`Stored ${ids.length} chunks from ${filename} into ChromaDB.`);
    } else {
      console.warn("ChromaDB not available. Chunking succeeded but storage was skipped.");
    }

    return {
      success: true,
      chunksProcessed: ids.length,
      filename,
      outline
    };
  } catch (error) {
    console.error("Error processing PDF:", error);
    throw error;
  }
}

export async function retrieveContext(query, topK = 3) {
  try {
    const col = await getCollection();
    if (!col) return [];

    const queryEmbedding = await embedText(query);
    
    const results = await col.query({
      queryEmbeddings: [queryEmbedding],
      nResults: topK
    });

    if (results && results.documents && results.documents[0]) {
      return results.documents[0].map((doc, idx) => ({
        text: doc,
        metadata: results.metadatas[0][idx]
      }));
    }
    
    return [];
  } catch (error) {
    console.error("Error retrieving context from ChromaDB:", error);
    return [];
  }
}
