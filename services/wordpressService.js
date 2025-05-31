const axios = require('axios');

class WordPressService {
  constructor() {
    this.baseURL = process.env.WORDPRESS_URL;
    this.username = process.env.WORDPRESS_USERNAME;
    this.password = process.env.WORDPRESS_PASSWORD;
    
    // Create axios instance with authentication
    this.api = axios.create({
      baseURL: `${this.baseURL}/wp-json/wp/v2`,
      auth: {
        username: this.username,
        password: this.password
      },
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async createPost(postData) {
    try {
      const { title, content, status = 'draft', categories = [], tags = [], featuredImageId = null } = postData;
      
      // Get category IDs
      const categoryIds = await this.getCategoryIds(categories);
      const tagIds = await this.getTagIds(tags);

      const postPayload = {
        title: title,
        content: content,
        status: status,
        categories: categoryIds,
        tags: tagIds,
        meta: {
          _automation_generated: true,
          _generation_timestamp: new Date().toISOString()
        }
      };

      // Add featured image if provided
      if (featuredImageId) {
        postPayload.featured_media = featuredImageId;
      }

      const response = await this.api.post('/posts', postPayload);

      console.log(`✅ WordPress post created: ${response.data.id}`);
      return response.data.id;
    } catch (error) {
      console.error('Error creating WordPress post:', error.response?.data || error.message);
      throw new Error(`Failed to create WordPress post: ${error.response?.data?.message || error.message}`);
    }
  }

  async publishPost(postId) {
    try {
      const response = await this.api.post(`/posts/${postId}`, {
        status: 'publish'
      });

      console.log(`🚀 WordPress post published: ${postId}`);
      return response.data;
    } catch (error) {
      console.error('Error publishing WordPress post:', error.response?.data || error.message);
      throw new Error(`Failed to publish WordPress post: ${error.response?.data?.message || error.message}`);
    }
  }

  async updatePost(postId, updates) {
    try {
      const response = await this.api.post(`/posts/${postId}`, updates);
      console.log(`📝 WordPress post updated: ${postId}`);
      return response.data;
    } catch (error) {
      console.error('Error updating WordPress post:', error.response?.data || error.message);
      throw new Error(`Failed to update WordPress post: ${error.response?.data?.message || error.message}`);
    }
  }

  async getPost(postId) {
    try {
      const response = await this.api.get(`/posts/${postId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting WordPress post:', error.response?.data || error.message);
      throw new Error(`Failed to get WordPress post: ${error.response?.data?.message || error.message}`);
    }
  }

  async uploadImageFromUrl(imageUrl, filename, altText = '') {
    try {
      console.log(`📤 Uploading image: ${filename}`);
      
      // Download image
      const imageResponse = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000
      });
      
      // Create form data
      const FormData = require('form-data');
      const formData = new FormData();
      formData.append('file', Buffer.from(imageResponse.data), {
        filename: filename,
        contentType: imageResponse.headers['content-type'] || 'image/jpeg'
      });

      // Upload to WordPress
      const response = await this.api.post('/media', formData, {
        headers: {
          ...formData.getHeaders(),
          'Content-Type': `multipart/form-data; boundary=${formData._boundary}`
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });
      
      // Update alt text if provided
      if (altText && response.data.id) {
        await this.api.post(`/media/${response.data.id}`, {
          alt_text: altText
        });
      }
      
      console.log(`✅ Image uploaded successfully: ${response.data.id}`);
      return {
        id: response.data.id,
        url: response.data.source_url,
        filename: response.data.media_details?.file || filename
      };
    } catch (error) {
      console.error('Error uploading image:', error.response?.data || error.message);
      throw new Error(`Failed to upload image: ${error.message}`);
    }
  }

  async getCategoryIds(categoryNames) {
    if (!categoryNames || categoryNames.length === 0) return [];
    
    try {
      const categoryIds = [];
      
      for (const name of categoryNames) {
        // First, try to find existing category
        const searchResponse = await this.api.get('/categories', {
          params: { search: name }
        });
        
        if (searchResponse.data.length > 0) {
          categoryIds.push(searchResponse.data[0].id);
        } else {
          // Create new category if it doesn't exist
          const createResponse = await this.api.post('/categories', {
            name: name,
            slug: name.toLowerCase().replace(/\s+/g, '-')
          });
          categoryIds.push(createResponse.data.id);
        }
      }
      
      return categoryIds;
    } catch (error) {
      console.error('Error handling categories:', error);
      return [];
    }
  }

  async getTagIds(tagNames) {
    if (!tagNames || tagNames.length === 0) return [];
    
    try {
      const tagIds = [];
      
      for (const name of tagNames) {
        // First, try to find existing tag
        const searchResponse = await this.api.get('/tags', {
          params: { search: name }
        });
        
        if (searchResponse.data.length > 0) {
          tagIds.push(searchResponse.data[0].id);
        } else {
          // Create new tag if it doesn't exist
          const createResponse = await this.api.post('/tags', {
            name: name,
            slug: name.toLowerCase().replace(/\s+/g, '-')
          });
          tagIds.push(createResponse.data.id);
        }
      }
      
      return tagIds;
    } catch (error) {
      console.error('Error handling tags:', error);
      return [];
    }
  }

  async testConnection() {
    try {
      const response = await this.api.get('/posts', {
        params: { per_page: 1 }
      });
      console.log('✅ WordPress connection successful');
      return true;
    } catch (error) {
      console.error('❌ WordPress connection failed:', error.response?.data || error.message);
      return false;
    }
  }
}

module.exports = new WordPressService(); 