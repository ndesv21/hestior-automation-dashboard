# Quick Setup Guide

## 🚀 Get Started in 5 Minutes

### 1. Configure Environment
```bash
# Copy the example environment file
cp env.example .env

# Edit with your credentials
nano .env
```

### 2. Required Credentials

#### WordPress Setup
1. Go to your WordPress admin: `https://hestior.com/wp-admin`
2. Navigate to **Users → Your Profile**
3. Scroll to **Application Passwords**
4. Create new password with name "Automation Dashboard"
5. Copy the generated password

#### OpenAI Setup
1. Visit [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Create a new API key
3. Copy the key (starts with `sk-`)

### 3. Update .env File
```env
WORDPRESS_URL=https://hestior.com
WORDPRESS_USERNAME=your_admin_username
WORDPRESS_PASSWORD=your_application_password_here
OPENAI_API_KEY=sk-your_openai_key_here
```

### 4. Launch Dashboard
```bash
# Make startup script executable
chmod +x start.sh

# Start the application
./start.sh
```

### 5. Access Dashboard
Open your browser to: `http://localhost:3000`

## ✅ Quick Test

1. Click **"Tech Article"** quick action
2. Watch the real-time progress
3. Check your WordPress site for the new draft post
4. The post will auto-publish after 5 minutes

## 🎯 Next Steps

- Customize prompts in the dashboard
- Set up scheduled posting with cron expressions
- Monitor the live progress for multiple jobs
- Adjust publish delays and image counts

## 🆘 Need Help?

- Check the main README.md for detailed documentation
- Verify your WordPress REST API is accessible
- Ensure your OpenAI account has sufficient credits
- Check the browser console for any errors 