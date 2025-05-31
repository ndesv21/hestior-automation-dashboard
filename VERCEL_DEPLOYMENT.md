# Vercel Deployment Guide

## 🚀 Deploy Hestior Automation Dashboard to Vercel

This guide will help you deploy your WordPress automation dashboard to Vercel with proper environment variable configuration.

## 📋 Prerequisites

- GitHub repository (this one!)
- Vercel account (free tier works)
- WordPress site with REST API enabled
- OpenAI API key with GPT-4 and DALL-E 3 access

## 🛠️ Deployment Steps

### 1. **Connect to Vercel**
1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click "New Project"
3. Import your `hestior-automation-dashboard` repository
4. Vercel will auto-detect it as a Node.js project

### 2. **Configure Environment Variables**
In the Vercel dashboard, go to your project → Settings → Environment Variables and add:

#### **WordPress Configuration**
```
WORDPRESS_URL = https://hestior.com
WORDPRESS_USERNAME = your_wordpress_username
WORDPRESS_PASSWORD = your_wordpress_app_password
```

#### **OpenAI Configuration**
```
OPENAI_API_KEY = your_openai_api_key
```

#### **Server Configuration**
```
NODE_ENV = production
PORT = 3000
```

#### **Automation Settings**
```
DEFAULT_PUBLISH_DELAY = 300000
MAX_CONCURRENT_GENERATIONS = 3
IMAGE_GENERATION_TIMEOUT = 120000
```

### 3. **Deploy**
1. Click "Deploy" in Vercel
2. Wait for deployment to complete
3. Your app will be available at `https://your-project-name.vercel.app`

## 🔧 Important Notes

### **Environment Variables vs .env Files**
- ❌ **Local Development**: Uses `.env` file (ignored by git)
- ✅ **Vercel Production**: Uses Vercel's environment variables dashboard
- 🔒 **Security**: Never commit `.env` files to git

### **WordPress App Password Setup**
1. Go to your WordPress admin → Users → Your Profile
2. Scroll to "Application Passwords"
3. Create new password with name "Vercel Automation"
4. Use this password (not your regular WordPress password)

### **OpenAI API Key**
1. Get from [platform.openai.com](https://platform.openai.com)
2. Ensure you have access to GPT-4 and DALL-E 3
3. Set usage limits to control costs

## 🌐 Custom Domain (Optional)

1. In Vercel dashboard → Settings → Domains
2. Add your custom domain
3. Configure DNS records as shown
4. SSL certificate is automatically provided

## 📊 Monitoring

### **Vercel Analytics**
- View deployment logs in Vercel dashboard
- Monitor function execution times
- Track errors and performance

### **Application Monitoring**
- Check campaign execution in the dashboard
- Monitor OpenAI API usage
- Review WordPress post creation

## 🔍 Troubleshooting

### **Common Issues**

**Build Failures**
- Check Node.js version (requires 16+)
- Verify all dependencies are in package.json
- Review build logs in Vercel dashboard

**Environment Variable Issues**
- Ensure all required variables are set
- Check for typos in variable names
- Verify WordPress credentials

**WordPress Connection**
- Test REST API: `https://yoursite.com/wp-json/wp/v2/posts`
- Verify application password is correct
- Check WordPress user permissions

**OpenAI API Errors**
- Verify API key is valid
- Check model access (GPT-4, DALL-E 3)
- Monitor rate limits and billing

### **Debugging**
```bash
# View Vercel function logs
vercel logs your-deployment-url

# Test API endpoints
curl https://your-app.vercel.app/api/automation/status
```

## 🚀 Production Tips

### **Performance**
- Vercel automatically handles scaling
- Functions have 10-second timeout (sufficient for most operations)
- Use appropriate publish delays to avoid rate limits

### **Cost Management**
- Monitor OpenAI API usage
- Set billing alerts in OpenAI dashboard
- Use Vercel's free tier for development

### **Security**
- All environment variables are encrypted
- HTTPS is enforced automatically
- Regular security updates via Vercel

## 🔄 Updates

### **Deploying Updates**
1. Push changes to GitHub main branch
2. Vercel automatically redeploys
3. Zero-downtime deployments

### **Environment Variable Updates**
1. Update in Vercel dashboard
2. Redeploy to apply changes
3. No code changes needed

## 📱 Mobile Access

Your dashboard will be fully responsive and accessible on:
- Desktop browsers
- Mobile devices
- Tablets

## 🎯 Next Steps

After deployment:
1. Test single article generation
2. Create your first bulk campaign
3. Monitor campaign execution
4. Set up WordPress categories and tags
5. Configure OpenAI usage alerts

---

**Your WordPress automation dashboard is now live on Vercel! 🎉** 