# Formspree Setup Instructions for Radulator Feedback Form

## Overview
The feedback form in Radulator uses Formspree to send emails without requiring a backend server. This is perfect for static sites hosted on GitHub Pages.

## Setup Steps

### 1. Create a Formspree Account
1. Go to [https://formspree.io](https://formspree.io)
2. Sign up for a free account (50 submissions/month free)
3. Verify your email address

### 2. Create a New Form
1. After logging in, click "New Form"
2. Give your form a name (e.g., "Radulator Feedback")
3. Set your email address where you want to receive feedback
4. Formspree will generate a unique Form ID (looks like: `xyzabc123`)

### 3. Update the Code
1. Open `/src/components/calculators/FeedbackForm.jsx`
2. Find this line:
   ```javascript
   const [state, handleSubmit] = useForm("YOUR_FORM_ID");
   ```
3. Replace `YOUR_FORM_ID` with your actual Formspree form ID:
   ```javascript
   const [state, handleSubmit] = useForm("xyzabc123");
   ```

### 4. Deploy Your Site
1. Commit and push your changes:
   ```bash
   git add .
   git commit -m "Add Formspree form ID for feedback"
   git push
   ```
2. Deploy to GitHub Pages:
   ```bash
   npm run deploy
   ```

### 5. Configure Formspree (Optional but Recommended)

#### Add Custom Reply-To
In your Formspree dashboard:
1. Go to your form settings
2. Enable "Reply-To address"
3. This allows you to reply directly to users who submit feedback

#### Add Spam Protection
1. In form settings, enable reCAPTCHA
2. This helps prevent spam submissions

#### Set Up Email Notifications
1. Configure when you want to receive email notifications
2. You can also set up webhooks or integrations (Slack, etc.)

## Testing the Form

1. Visit your deployed site
2. Click "Send Feedback" in the sidebar
3. Fill out the form with test data
4. Submit the form
5. Check your email for the submission

## Viewing Submissions

You can view all submissions in your Formspree dashboard:
- See submission history
- Export data as CSV
- Set up auto-responses
- Configure form rules

## Troubleshooting

### Form not submitting?
- Check that you've replaced `YOUR_FORM_ID` with your actual form ID
- Ensure you're testing on the deployed site (not just localhost)
- Check the browser console for errors

### Not receiving emails?
- Check your spam folder
- Verify the email address in Formspree settings
- Make sure your form isn't hitting the monthly limit

### Need more submissions?
- Upgrade to a paid Formspree plan
- Or consider alternative services like EmailJS or Netlify Forms

## Alternative: GitHub Issues
If you prefer not to use Formspree, you can modify the feedback button to open GitHub Issues:
```javascript
<Button onClick={() => window.open('https://github.com/momomojo/Radulator/issues/new', '_blank')}>
  Report Issue on GitHub
</Button>
```

This approach uses GitHub's built-in issue tracking and notification system.