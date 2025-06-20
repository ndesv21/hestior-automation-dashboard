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
            content: `You are a professional content writer for hestior.com. Write engaging, SEO-optimized articles that are informative and well-structured. 

Format the content using WordPress-compatible HTML elements:
- Use <h1>, <h2>, <h3> for headings
- Use <p> for paragraphs  
- Use <ul>, <ol>, <li> for lists
- Use <strong>, <em> for emphasis

DO NOT wrap the content in <html>, <head>, <body> or <article> tags. Return only the article content that can be directly inserted into WordPress.

Write comprehensive articles that are at least 800-1200 words.`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 3000,
        temperature: 0.7,
      });

      let content = completion.choices[0].message.content;
      
      // Clean up any unwanted HTML wrapper tags
      content = content.replace(/<\/?html[^>]*>/gi, '');
      content = content.replace(/<\/?head[^>]*>/gi, '');
      content = content.replace(/<\/?body[^>]*>/gi, '');
      content = content.replace(/<\/?article[^>]*>/gi, '');
      content = content.replace(/```html\n?|\n?```/g, '');
      
      // Trim whitespace
      content = content.trim();
      
      return content;
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
        quality: "medium"
        // Note: gpt-image-1 doesn't accept response_format parameter
      });

      console.log('=== GPT-IMAGE-1 RESPONSE ANALYSIS ===');
      console.log('Response keys:', Object.keys(response));
      console.log('Response data array length:', response.data ? response.data.length : 'No data array');
      
      if (response.data && response.data[0]) {
        const firstItem = response.data[0];
        console.log('First item keys:', Object.keys(firstItem));
        console.log('First item:', JSON.stringify(firstItem, null, 2));
      }
      
      // Check if response has other properties that might contain image data
      console.log('Full response structure:');
      console.log(JSON.stringify(response, null, 2));
      console.log('=== END ANALYSIS ===');
      
      // gpt-image-1 returns base64 data in a different structure
      let imageData = null;
      
      if (response.data && response.data[0]) {
        const firstItem = response.data[0];
        
        // Check all possible locations for base64 data in gpt-image-1
        imageData = firstItem.b64_json || 
                   firstItem.base64 || 
                   firstItem.data || 
                   firstItem.image || 
                   firstItem.content ||
                   firstItem.url;
        
        // If we found raw base64 data, convert it to data URL format
        if (imageData && !imageData.startsWith('data:image') && !imageData.startsWith('http')) {
          console.log('Converting raw base64 to data URL...');
          imageData = `data:image/png;base64,${imageData}`;
        }
      }
      
      // Check if image data is at the root level of response
      if (!imageData) {
        imageData = response.b64_json || 
                   response.base64 || 
                   response.data || 
                   response.image || 
                   response.content ||
                   response.url;
                   
        if (imageData && !imageData.startsWith('data:image') && !imageData.startsWith('http')) {
          console.log('Converting root level base64 to data URL...');
          imageData = `data:image/png;base64,${imageData}`;
        }
      }
      
      if (!imageData) {
        console.error('❌ No image data found in gpt-image-1 response');
        throw new Error('No image data found in gpt-image-1 response');
      }
      
      console.log('✅ Successfully extracted image data');
      console.log('Image data type:', imageData.startsWith('data:image') ? 'Base64 Data URL' : 'URL');
      console.log('Image data length:', imageData.length);
      
      return imageData;
    } catch (error) {
      console.error('Error generating image:', error);
      throw new Error(`Failed to generate image: ${error.message}`);
    }
  }

  // Helper function to validate URLs
  isValidUrl(string) {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:' || string.startsWith('data:image');
    } catch (_) {
      return false;
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

  // ================================
  // PAGE GENERATION METHODS
  // ================================

  async generatePage(prompt) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a professional web content writer specializing in WordPress page creation. Write structured, comprehensive page content that is perfect for static pages like comparisons, FAQs, features, landing pages, etc.

Format the content using WordPress-compatible HTML elements:
- Use <h1> for the main page title (only one)
- Use <h2>, <h3>, <h4> for section headings
- Use <p> for paragraphs
- Use <ul>, <ol>, <li> for lists  
- Use <table>, <tr>, <td>, <th> for comparison tables
- Use <div class="..."> for special sections
- Use <strong>, <em> for emphasis
- Use <blockquote> for quotes or highlights

DO NOT wrap content in <html>, <head>, <body> tags. Return only the page content.
Make the content comprehensive, well-structured, and suitable for a professional WordPress page.
Include clear sections, helpful information, and actionable content.`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 4000,
        temperature: 0.7,
      });

      let content = completion.choices[0].message.content;
      
      // Clean up any unwanted HTML wrapper tags
      content = content.replace(/<\/?html[^>]*>/gi, '');
      content = content.replace(/<\/?head[^>]*>/gi, '');
      content = content.replace(/<\/?body[^>]*>/gi, '');
      content = content.replace(/```html\n?|\n?```/g, '');
      
      // Trim whitespace
      content = content.trim();
      
      return content;
    } catch (error) {
      console.error('Error generating page:', error);
      throw new Error(`Failed to generate page: ${error.message}`);
    }
  }

  async extractPageMetadata(content) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Analyze the given page content and extract metadata. Return a JSON object with:
            - title: SEO-friendly page title (under 60 characters)
            - slug: URL-friendly slug (lowercase, hyphens)
            - metaDescription: Page meta description (under 160 characters)
            - pageType: Type of page (comparison, faq, features, landing, about, contact, etc.)
            - imagePrompts: Array of 1-2 relevant image prompts for the page
            - featuredImagePrompt: One main image prompt for the featured image
            
            Make sure image prompts are specific and relevant to the page content. Return only valid JSON.`
          },
          {
            role: "user",
            content: `Extract metadata from this page content:\n\n${content}`
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
        console.error('Failed to parse page metadata JSON:', cleanedResponse);
        // Return fallback metadata
        return {
          title: "Generated Page",
          slug: "generated-page",
          metaDescription: "A professionally generated WordPress page.",
          pageType: "general",
          imagePrompts: ["Professional page illustration"],
          featuredImagePrompt: "Professional WordPress page featured image"
        };
      }
    } catch (error) {
      console.error('Error extracting page metadata:', error);
      // Return fallback metadata
      return {
        title: "Generated Page",
        slug: "generated-page", 
        metaDescription: "A professionally generated WordPress page.",
        pageType: "general",
        imagePrompts: ["Professional page illustration"],
        featuredImagePrompt: "Professional WordPress page featured image"
      };
    }
  }

  async findPageImagePlacement(content, imageCount) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Analyze the page content and suggest where to place ${imageCount} images. Return a JSON array of objects with:
            - position: section number (0-based) where image should be inserted
            - context: brief description of what the image should show based on surrounding content
            - size: suggested size (full-width, half-width, thumbnail)
            
            Consider page structure and content flow. Return only valid JSON array.`
          },
          {
            role: "user",
            content: `Find optimal image placement for ${imageCount} images in this page:\n\n${content}`
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
        const sections = content.split(/<h[2-4][^>]*>/i).length;
        const positions = [];
        for (let i = 0; i < imageCount; i++) {
          positions.push({
            position: Math.floor((sections / (imageCount + 1)) * (i + 1)),
            context: `Image ${i + 1} for page content`,
            size: "full-width"
          });
        }
        return positions;
      }
    } catch (error) {
      console.error('Error finding page image placement:', error);
      // Fallback: distribute images evenly
      const sections = content.split(/<h[2-4][^>]*>/i).length;
      const positions = [];
      for (let i = 0; i < imageCount; i++) {
        positions.push({
          position: Math.floor((sections / (imageCount + 1)) * (i + 1)),
          context: `Image ${i + 1} for page content`,
          size: "full-width"
        });
      }
      return positions;
    }
  }
}

module.exports = new OpenAIService(); 
