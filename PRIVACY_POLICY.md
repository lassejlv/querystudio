# Privacy Policy

**Last Updated: February 2, 2026**

QueryStudio ("we," "our," or "us") is developed and operated from Denmark. This Privacy Policy explains how we collect, use, and protect your information when you use our desktop application and web platform at querystudio.dev.

## Summary

- **Desktop app data stays local** - Your database connections, queries, and AI API keys are stored on your device, not our servers
- **We collect minimal account data** - Only what's needed for authentication and billing
- **We don't sell your data** - Your information is never sold to third parties
- **AI requests go directly to providers** - We don't proxy or store your AI conversations

---

## 1. Information We Collect

### 1.1 Account Information (Web Platform)

When you create an account on querystudio.dev, we collect:

- **Name** and **email address**
- **Password** (stored securely using one-way hashing)
- **Email verification status**
- **Account creation and update timestamps**

If you sign up using GitHub OAuth, we also receive:

- Your GitHub account identifier
- OAuth tokens (stored securely for authentication purposes)

### 1.2 Session Information

For security and session management, we collect:

- **IP address**
- **User agent** (browser and device information)
- **Session tokens and expiration times**

This information helps us detect unauthorized access and protect your account.

### 1.3 Payment Information

When you purchase a subscription or license, payment is processed by our payment provider, Polar. We store:

- Your Polar customer ID
- Subscription status (Pro/Free)
- License key (for one-time purchases)
- Subscription cancellation status

**We do not store your credit card details.** All payment processing is handled securely by Polar.

### 1.4 Waitlist Data

If you join our waitlist, we collect your email address and approval status.

### 1.5 Desktop Application (Local Data Only)

The QueryStudio desktop application stores the following data **locally on your device**. This data is **never transmitted to our servers**:

- **Database connection configurations** (host, port, username, database name)
  - Note: Passwords are never stored; you're prompted each time you connect
- **UI preferences** (theme, sidebar width, active tabs)
- **Query history** (last 100 queries per connection)
- **AI chat history**
- **AI API keys** (OpenAI, Anthropic, Google) that you provide

---

## 2. How We Use Your Information

We use your information to:

- **Provide and maintain our services** - Account management, authentication, and feature access
- **Process payments** - Handle subscriptions and one-time purchases
- **Communicate with you** - Send email verification, account updates, and waitlist notifications
- **Improve our services** - Analyze usage patterns on our web platform (not the desktop app)
- **Ensure security** - Protect against unauthorized access and abuse

---

## 3. Third-Party Services

We use the following third-party services:

### 3.1 Polar (polar.sh)

- **Purpose**: Payment processing
- **Data shared**: Email, name, customer ID
- **Privacy policy**: https://polar.sh/legal/privacy

### 3.2 Cloudflare Turnstile

- **Purpose**: Bot protection on login and signup forms
- **Data shared**: CAPTCHA challenge responses
- **Privacy policy**: https://www.cloudflare.com/privacypolicy/

### 3.3 UseSend

- **Purpose**: Transactional email delivery (verification, notifications)
- **Data shared**: Email address, email content
- **Privacy policy**: https://usesend.com/legal/privacy

### 3.4 GitHub (OAuth)

- **Purpose**: Optional social login
- **Data shared**: OAuth tokens, account identifier
- **Privacy policy**: https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement

### 3.5 Self-Hosted Analytics

- **Purpose**: Web platform usage analytics
- **Scope**: Web platform only (not the desktop application)
- **Data collected**: Page views, anonymized usage data

### 3.6 UserJot

- **Purpose**: User feedback collection
- **Data shared**: Feedback submissions
- **Privacy policy**: https://userjot.com/privacy

### 3.7 AI Providers (Bring Your Own Key)

When you use the AI assistant ("Querybuddy") in the desktop app:

- **Your API keys are stored locally** on your device
- **Requests go directly** from your device to the AI provider (OpenAI, Anthropic, or Google)
- **QueryStudio does not proxy, store, or have access to your AI conversations**
- **Database schema information** (table names, column names) may be sent to the AI provider to help generate queries

You are subject to the respective AI provider's privacy policy when using these features.

---

## 4. Data Storage and Security

### 4.1 Cloud Storage (Web Platform)

Account data is stored in secure PostgreSQL databases. We implement:

- Encrypted connections (HTTPS/TLS)
- Secure password hashing
- Rate limiting to prevent abuse
- Session management with automatic expiration

### 4.2 Local Storage (Desktop App)

Desktop app data is stored locally using:

- SQLite database for connection configurations
- Browser localStorage for preferences and settings

**This data never leaves your device** unless you explicitly choose to use features that require network access (like connecting to your databases or using AI features with your own API keys).

### 4.3 Data Retention

- **Account data**: Retained while your account is active and for a reasonable period after deletion to comply with legal obligations
- **Session data**: Automatically deleted when sessions expire
- **Local desktop data**: Stored on your device until you delete the application or clear the data

---

## 5. Your Rights

Under applicable data protection laws (including GDPR), you have the right to:

- **Access** your personal data
- **Correct** inaccurate personal data
- **Delete** your personal data
- **Export** your personal data in a portable format
- **Withdraw consent** for optional data processing
- **Object** to certain types of data processing

To exercise these rights, contact us at **querystudio@lasse.email**.

---

## 6. Data We Do NOT Collect

We want to be clear about what we don't collect:

- **Database passwords** - Never stored anywhere
- **Your database content** - Stays between you and your database servers
- **AI chat content** - Stays between you and the AI provider
- **Desktop app usage analytics** - No telemetry in the desktop application
- **Your AI API keys** - Stored locally on your device only

---

## 7. Children's Privacy

QueryStudio is not intended for children under 16 years of age. We do not knowingly collect personal information from children under 16. If you believe we have collected information from a child under 16, please contact us immediately.

---

## 8. International Data Transfers

QueryStudio is operated from Denmark. If you access our services from outside the European Union, your information may be transferred to and processed in countries with different data protection laws. We ensure appropriate safeguards are in place for such transfers.

---

## 9. Changes to This Policy

We may update this Privacy Policy from time to time. We will notify you of significant changes by:

- Posting the new policy on our website
- Updating the "Last Updated" date
- Sending an email notification for material changes

---

## 10. Contact Us

If you have questions about this Privacy Policy or your personal data, contact us at:

**Email**: querystudio@lasse.email  
**Website**: https://querystudio.dev

---

## 11. Legal Basis for Processing (GDPR)

For users in the European Economic Area, we process personal data based on:

- **Contract performance** - To provide our services and fulfill our obligations to you
- **Legitimate interests** - For security, fraud prevention, and service improvement
- **Consent** - For optional features like marketing communications
- **Legal obligations** - To comply with applicable laws

---

*This privacy policy is designed to be fair, transparent, and compliant with applicable data protection regulations including the EU General Data Protection Regulation (GDPR).*
