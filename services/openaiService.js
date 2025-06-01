const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

class OpenAIService {
  async generateArticle(prompt) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a professional content writer for hestior.com. Write engaging, SEO-optimized articles that are informative and well-structured. Use proper HTML formatting with headings, paragraphs, and lists where appropriate. The content should be ready for WordPress publishing. Write comprehensive articles that are at least 800-1200 words.`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 3000,
        temperature: 0.7,
      });

      return completion.choices[0].message.content;
    } catch (error) {
      console.error('Error generating article:', error);
      throw new Error(`Failed to generate article: ${error.message}`);
    }
  }

  async extractMetadataFromContent(content) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Analyze the given article content and extract metadata. Return a JSON object with:
            - title: SEO-friendly title (under 60 characters)
            - category: Single most relevant category
            - tags: Array of 3-5 relevant tags
            - imagePrompts: Array of 2-3 detailed image prompts that would enhance the article
            - featuredImagePrompt: One main image prompt for the featured image
            
            Make sure image prompts are specific and relevant to the content. Return only valid JSON.`
          },
          {
            role: "user",
            content: `Extract metadata from this article:\n\n${content}`
          }
        ],
        max_tokens: 500,
        temperature: 0.3,
      });

      const response = completion.choices[0].message.content;
      
      // Clean up the response to ensure it's valid JSON
      const cleanedResponse = response.replace(/```json\n?|\n?```/g, '').trim();
      
      try {
        return JSON.parse(cleanedResponse);
      } catch (parseError) {
        console.error('Failed to parse metadata JSON:', cleanedResponse);
        // Return fallback metadata
        return {
          title: "Generated Article",
          category: "General",
          tags: ["article", "content"],
          imagePrompts: ["Professional article illustration", "Modern content concept"],
          featuredImagePrompt: "Professional blog article featured image"
        };
      }
    } catch (error) {
      console.error('Error extracting metadata:', error);
      // Return fallback metadata
      return {
        title: "Generated Article",
        category: "General", 
        tags: ["article", "content"],
        imagePrompts: ["Professional article illustration", "Modern content concept"],
        featuredImagePrompt: "Professional blog article featured image"
      };
    }
  }

  async generateImage(prompt, size = "1536x1024") {
    try {
      const response = await openai.images.generate({
        model: "gpt-image-1",
        prompt: `Create a high-quality, professional image for a blog article: ${prompt}. The image should be suitable for web publishing and visually appealing.`,
        n: 1,
        size: size,
        quality: "auto",
      });

      return response.data[0].url;
    } catch (error) {
      console.error('Error generating image:', error);
      throw new Error(`Failed to generate image: ${error.message}`);
    }
  }

  async findImagePlacementInContent(content, imageCount) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Analyze the article content and suggest where to place ${imageCount} images. Return a JSON array of objects with:
            - position: paragraph number (0-based) where image should be inserted
            - context: brief description of what the image should show based on surrounding content
            
            Distribute images evenly throughout the article. Return only valid JSON array.`
          },
          {
            role: "user",
            content: `Find optimal image placement for ${imageCount} images in this article:\n\n${content}`
          }
        ],
        max_tokens: 300,
        temperature: 0.3,
      });

      const response = completion.choices[0].message.content;
      const cleanedResponse = response.replace(/```json\n?|\n?```/g, '').trim();
      
      try {
        return JSON.parse(cleanedResponse);
      } catch (parseError) {
        // Fallback: distribute images evenly
        const paragraphs = content.split('\n\n').length;
        const positions = [];
        for (let i = 0; i < imageCount; i++) {
          positions.push({
            position: Math.floor((paragraphs / (imageCount + 1)) * (i + 1)),
            context: `Image ${i + 1} for article content`
          });
        }
        return positions;
      }
    } catch (error) {
      console.error('Error finding image placement:', error);
      // Fallback: distribute images evenly
      const paragraphs = content.split('\n\n').length;
      const positions = [];
      for (let i = 0; i < imageCount; i++) {
        positions.push({
          position: Math.floor((paragraphs / (imageCount + 1)) * (i + 1)),
          context: `Image ${i + 1} for article content`
        });
      }
      return positions;
    }
  }

  async enhancePrompt(originalPrompt, context = '') {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a prompt enhancement specialist. Take user prompts and make them more detailed and effective for content generation."
          },
          {
            role: "user",
            content: `Enhance this prompt for better content generation: "${originalPrompt}". Context: ${context}`
          }
        ],
        max_tokens: 200,
        temperature: 0.5,
      });

      return completion.choices[0].message.content;
    } catch (error) {
      console.error('Error enhancing prompt:', error);
      return originalPrompt; // Return original if enhancement fails
    }
  }

  async generateTitle(contentPrompt) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "Generate catchy, SEO-friendly titles for blog articles. Keep them under 60 characters and make them engaging."
          },
          {
            role: "user",
            content: `Generate a title for an article about: ${contentPrompt}`
          }
        ],
        max_tokens: 50,
        temperature: 0.8,
      });

      return completion.choices[0].message.content.replace(/"/g, '');
    } catch (error) {
      console.error('Error generating title:', error);
      throw new Error(`Failed to generate title: ${error.message}`);
    }
  }

  async generateImagePrompts(articleContent, count = 2) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Generate ${count} detailed image prompts based on article content. Each prompt should describe a specific, relevant image that would enhance the article.`
          },
          {
            role: "user",
            content: `Based on this article content, generate ${count} image prompts:\n\n${articleContent}`
          }
        ],
        max_tokens: 300,
        temperature: 0.7,
      });

      const response = completion.choices[0].message.content;
      return response.split('\n').filter(line => line.trim()).slice(0, count);
    } catch (error) {
      console.error('Error generating image prompts:', error);
      throw new Error(`Failed to generate image prompts: ${error.message}`);
    }
  }
}

module.exports = new OpenAIService(); 
