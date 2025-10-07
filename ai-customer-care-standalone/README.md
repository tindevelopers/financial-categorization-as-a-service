# AI Customer Care Template

A standalone Next.js application for managing AI voice agents, chat conversations, and call analytics.

## Features

- 🤖 **AI Voice Agent Management** - Configure and manage AI voice agents
- 💬 **Chat Agent Management** - Set up and monitor chat conversations
- 📊 **Live Call Monitoring** - Real-time call supervision and intervention
- 📈 **Analytics & Reporting** - Comprehensive analytics and performance metrics
- 🔗 **Integration Hub** - Connect with CRMs, telephony providers, and business tools
- 📞 **Call Flow Builder** - Visual call flow creation and management
- 📚 **Knowledge Base** - Centralized content repository for agent training
- 🔐 **Quality Assurance** - Call evaluation and compliance monitoring
- 🏢 **Multi-tenant Support** - Manage multiple tenants and subtenants
- ⚙️ **System Settings** - Comprehensive configuration management
- 🔌 **API Playground** - Test and explore API endpoints

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4.0
- **UI Components**: Custom components with Heroicons
- **Charts**: Recharts for analytics visualization
- **State Management**: React Context API

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start development server**:
   ```bash
   npm run dev
   ```

3. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/
│   ├── (admin)/
│   │   └── layout.tsx          # Admin layout wrapper
│   ├── templates/
│   │   └── ai-customer-care/    # AI Customer Care pages
│   ├── globals.css             # Global styles
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # Home page (redirects to template)
├── components/
│   └── ai-customer-care/        # AI Customer Care components
├── context/                     # React contexts
├── hooks/                       # Custom hooks
├── icons/                       # SVG icons
├── layout/                      # Layout components
└── utils/                       # Utility functions
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Deployment

This template is ready for deployment on any platform that supports Next.js:

- **Vercel** (recommended)
- **Netlify**
- **AWS Amplify**
- **Railway**
- **DigitalOcean App Platform**

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

## Customization

The template is fully customizable:

1. **Styling**: Modify Tailwind CSS classes or add custom styles
2. **Components**: Extend or modify components in `src/components/ai-customer-care/`
3. **Pages**: Add new pages in `src/app/templates/ai-customer-care/`
4. **Icons**: Add custom icons in `src/icons/`

## Support

For questions and support:

- 📧 Email: support@tinadmin.com
- 📚 Documentation: [docs.tinadmin.com](https://docs.tinadmin.com)
- 🐛 Issues: [GitHub Issues](https://github.com/tinadmin/tinadmin/issues)

## License

MIT License - see [LICENSE](./LICENSE) file for details.

---

Built with ❤️ using [TinAdmin](https://tinadmin.com)