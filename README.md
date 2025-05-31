# Hestior Automation Dashboard

A powerful automation dashboard for WordPress content creation using OpenAI's API. Automatically generates articles, creates images, and publishes content to your WordPress site with real-time visual progress tracking and **bulk campaign management**.

## 🚀 Features

### **Core Automation**
- **Real-time Dashboard**: Visual progress tracking with live updates
- **AI Content Generation**: Automated article writing using GPT-4
- **AI Image Generation**: DALL-E 3 integration for article images
- **WordPress Integration**: Seamless publishing to your WordPress site
- **Multi-image Support**: Generate and place multiple images within articles
- **Hands-free Operation**: AI handles titles, tags, categories, and image placement

### **🆕 Bulk Campaign Management**
- **Bulk Prompt Processing**: Add 50+ prompts at once for automated processing
- **Smart Scheduling**: Daily, hourly, or custom cron-based frequency control
- **Sequential Processing**: Automatically cycles through prompts in order
- **Loop Mode**: Infinite operation - restarts from first prompt when finished
- **Campaign Analytics**: Track progress, success rates, and execution statistics
- **Real-time Management**: Pause, resume, delete campaigns on the fly
- **Manual Execution**: Test individual campaign steps manually

### **Advanced Features**
- **Configurable Prompts**: Customize content and image generation prompts
- **Live Editing**: Modify jobs and settings on the fly
- **Quick Templates**: Pre-configured templates for different content types
- **Error Handling**: Robust error handling with retry mechanisms
- **Campaign Statistics**: Detailed analytics and performance tracking

## 📋 Prerequisites

- Node.js (v16 or higher)
- WordPress site with REST API enabled
- OpenAI API key with access to GPT-4 and DALL-E 3
- WordPress application password

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/hestior-automation-dashboard.git
   cd hestior-automation-dashboard
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   Create a `.env` file in the root directory:
   ```env
   # WordPress Configuration
   WORDPRESS_URL=https://hestior.com
   WORDPRESS_USERNAME=your_username
   WORDPRESS_PASSWORD=your_app_password

   # OpenAI Configuration
   OPENAI_API_KEY=your_openai_api_key

   # Server Configuration
   PORT=3000
   NODE_ENV=development

   # Automation Settings
   DEFAULT_PUBLISH_DELAY=300000
   MAX_CONCURRENT_GENERATIONS=3
   IMAGE_GENERATION_TIMEOUT=120000
   ```

4. **Start the application**
   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm start
   ```

5. **Access the dashboard**
   Open your browser and navigate to `http://localhost:3000`

## 🎯 Usage

### **Single Article Generation**
1. Click "Single Article" button
2. Enter your content prompt
3. Set publish delay (optional)
4. Click "Create Article"
5. Watch real-time progress as AI generates content, images, and publishes

### **🆕 Bulk Campaign Management**

#### **Creating a Campaign**
1. Click "Bulk Campaign" button
2. Enter campaign name (e.g., "Tech Articles Q1 2024")
3. Add prompts (one per line):
   ```
   Write about AI trends in 2024
   Create a guide on sustainable living
   Discuss remote work best practices
   Explain blockchain for beginners
   Review the latest smartphone technology
   ```
4. Set frequency:
   - **Daily**: Choose articles per day (e.g., 2 articles = every 12 hours)
   - **Hourly**: One article every hour
   - **Custom**: Use cron expressions for precise timing
5. Configure settings:
   - Publish delay per article
   - Loop mode (restart when all prompts used)
6. Click "Create Campaign"

#### **Managing Campaigns**
- **View Progress**: See current prompt position and completion percentage
- **Pause/Resume**: Control campaign execution
- **Execute Now**: Manually trigger next article generation
- **View Details**: See all prompts, usage statistics, execution history
- **Delete**: Remove campaigns permanently

#### **Campaign Examples**
```bash
# Daily Tech Blog
Name: "Daily Tech Updates"
Frequency: Daily, 1 article per day
Prompts: 30 tech-related prompts
Result: One tech article published every 24 hours

# High-Frequency Content
Name: "Hourly Tips"
Frequency: Hourly
Prompts: 50 lifestyle tips
Result: One tip article every hour

# Custom Schedule
Name: "Business Weekly"
Frequency: Custom (0 9 * * 1) - Every Monday at 9 AM
Prompts: 20 business strategy prompts
Result: One business article every Monday morning
```

## 🏗️ Architecture

### **Backend Services**
- **Express.js Server**: Main application server with Socket.IO
- **Bulk Automation Service**: Campaign management and scheduling
- **OpenAI Service**: Content and image generation using GPT-4 and DALL-E 3
- **WordPress Service**: API integration and publishing
- **Automation Queue**: Job management system

### **Frontend**
- **Real-time Dashboard**: Live updates via Socket.IO
- **Campaign Management UI**: Bulk automation interface
- **Progress Tracking**: Visual progress indicators
- **Responsive Design**: Works on desktop and mobile

### **Key Components**
```
├── server.js                 # Main server file
├── controllers/
│   └── automationController.js  # API endpoints and job management
├── services/
│   ├── openaiService.js         # AI content and image generation
│   ├── wordpressService.js      # WordPress API integration
│   ├── automationQueue.js       # Job queue management
│   └── bulkAutomationService.js # Campaign management (NEW)
├── public/
│   ├── index.html              # Dashboard UI
│   ├── app.js                  # Frontend JavaScript
│   └── styles.css              # Styling
└── package.json               # Dependencies and scripts
```

## 🔧 Configuration

### **WordPress Setup**
1. Enable REST API on your WordPress site
2. Create an application password:
   - Go to Users → Your Profile
   - Scroll to "Application Passwords"
   - Create new password for the automation app

### **OpenAI Setup**
1. Get API key from OpenAI dashboard
2. Ensure access to GPT-4 and DALL-E 3 models
3. Monitor usage and set billing limits

### **Campaign Scheduling**
- **Daily**: Articles distributed evenly throughout 24 hours
- **Hourly**: One article every hour (24 articles/day)
- **Custom Cron**: Use standard cron expressions
  ```bash
  0 9,15 * * *     # 9 AM and 3 PM daily
  0 */6 * * *      # Every 6 hours
  0 9 * * 1        # Every Monday at 9 AM
  ```

## 📊 Monitoring & Analytics

### **Campaign Statistics**
- Total prompts and current position
- Articles generated and success rate
- Execution times and performance metrics
- Last execution timestamp

### **Real-time Updates**
- Live progress tracking for active jobs
- Campaign status changes
- Success/failure notifications
- Queue management updates

## 🔍 Troubleshooting

### **Common Issues**

**Port Already in Use**
```bash
# Kill process using port 3000
lsof -ti:3000 | xargs kill -9
```

**OpenAI API Errors**
- Check API key validity
- Verify model access (GPT-4, DALL-E 3)
- Monitor rate limits and usage

**WordPress Connection Issues**
- Verify REST API is enabled
- Check application password
- Ensure proper URL format

**Campaign Not Executing**
- Check campaign status (active/paused)
- Verify cron expression syntax
- Review server logs for errors

### **Logs and Debugging**
```bash
# View real-time logs
npm run dev

# Check campaign schedules
curl http://localhost:3000/api/automation/campaigns

# View campaign details
curl http://localhost:3000/api/automation/campaigns/{campaignId}
```

## 🚀 Deployment

### **Production Setup**
1. Set `NODE_ENV=production` in environment
2. Use process manager (PM2, Forever)
3. Set up reverse proxy (Nginx)
4. Configure SSL certificates
5. Set up monitoring and logging

### **Environment Variables**
```env
NODE_ENV=production
PORT=3000
WORDPRESS_URL=https://yourdomain.com
WORDPRESS_USERNAME=your_username
WORDPRESS_PASSWORD=your_app_password
OPENAI_API_KEY=your_openai_api_key
```

## 🔒 Security

- Store sensitive credentials in environment variables
- Use HTTPS for production deployments
- Regularly rotate API keys and passwords
- Implement rate limiting for production use
- Monitor API usage and costs

## 📈 Performance Tips

- Adjust `MAX_CONCURRENT_GENERATIONS` based on OpenAI rate limits
- Use appropriate publish delays to avoid overwhelming WordPress
- Monitor OpenAI API usage to manage costs
- Consider implementing caching for frequently used prompts

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Check the troubleshooting section
- Review the logs for error details
- Open an issue on GitHub

## 🔮 Future Enhancements

- Multi-site WordPress management
- Advanced scheduling options with timezone support
- Content analytics and performance tracking
- Integration with additional AI providers
- SEO optimization features
- Social media integration
- Content templates and themes
- Advanced campaign analytics
- Webhook integrations
- API rate limiting and queuing

---

**Built with ❤️ for automated content creation** 