
import { GoogleGenAI, Type } from "@google/genai";
import { Product, Order } from "../types";

// Initialize Gemini API Client
const apiKey = process.env.API_KEY || '';
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const geminiService = {
  /**
   * Analyzes inventory and sales data to provide business insights.
   */
  async analyzeBusiness(products: Product[], orders: Order[]): Promise<string> {
    if (!ai) return "API Key is missing.";

    const inventorySummary = products.map(p => `${p.name} (${p.quantity} ${p.unit} @ $${p.pricePerUnit})`).join(', ');
    const salesSummary = orders.slice(0, 10).map(o => `Sale: $${o.totalAmount.toFixed(2)} (Sold in UZS: ${o.totalAmountUZS})`).join(', ');

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `
          Act as an expert ERP analyst for a metal rolling business (Pipes and Profiles) in Uzbekistan.
          
          Context:
          - Base currency for accounting: USD
          - Sales currency: Uzbek Soum (UZS)
          
          Current Inventory: ${inventorySummary}
          Recent Sales: ${salesSummary}
          
          Please provide a short, bulleted list (max 3 points) of actionable insights in Russian.
          Focus on stock levels, revenue trends (in USD), and potential restock needs.
        `,
      });
      return response.text || "Не удалось получить аналитику.";
    } catch (error) {
      console.error("Gemini Analysis Error:", error);
      return "Ошибка при анализе данных. Проверьте API ключ.";
    }
  },

  /**
   * Parses unstructured text input into structured Product objects for "Smart Add".
   */
  async parseProductInput(text: string): Promise<Partial<Product>[]> {
    if (!ai) throw new Error("API Key missing");

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Extract metal rolling product data from this text: "${text}".
        Return a JSON array. 
        
        Schema needed per item:
        - name (string)
        - type (one of: 'Труба', 'Профиль', 'Лист', 'Балка', 'Прочее')
        - dimensions (string, e.g. "50x50x3")
        - steelGrade (string or "Ст3" if unknown)
        - quantity (number)
        - unit (one of: 'м', 'т', 'шт')
        - pricePerUnit (number, assume price is in USD if not specified, or convert if context implies otherwise)
        `,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                type: { type: Type.STRING },
                dimensions: { type: Type.STRING },
                steelGrade: { type: Type.STRING },
                quantity: { type: Type.NUMBER },
                unit: { type: Type.STRING },
                pricePerUnit: { type: Type.NUMBER },
              }
            }
          }
        }
      });
      
      const result = JSON.parse(response.text);
      return result;
    } catch (error) {
      console.error("Gemini Parse Error:", error);
      return [];
    }
  }
};
