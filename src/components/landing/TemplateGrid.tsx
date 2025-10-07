import React from "react";
import TemplateCard from "./TemplateCard";

const templates = [
  {
    id: "ecommerce",
    name: "E-commerce",
    description: "Complete online store management with products, orders, customers, and analytics",
    icon: "🛒",
    color: "bg-blue-500",
    features: ["Product Management", "Order Tracking", "Customer Analytics", "Revenue Reports"],
    preview: "/images/templates/ecommerce-preview.png",
    installCommand: "npx create-tinadmin@latest ecommerce my-store"
  },
  {
    id: "restaurant",
    name: "Restaurant",
    description: "Restaurant management system with menu, orders, inventory, and staff management",
    icon: "🍽️",
    color: "bg-orange-500",
    features: ["Menu Management", "Order Processing", "Inventory Tracking", "Staff Scheduling"],
    preview: "/images/templates/restaurant-preview.png",
    installCommand: "npx create-tinadmin@latest restaurant my-restaurant"
  },
  {
    id: "healthcare",
    name: "Healthcare",
    description: "Medical practice management with patients, appointments, records, and billing",
    icon: "🏥",
    color: "bg-green-500",
    features: ["Patient Records", "Appointment Scheduling", "Medical Billing", "Staff Management"],
    preview: "/images/templates/healthcare-preview.png",
    installCommand: "npx create-tinadmin@latest healthcare my-clinic"
  },
  {
    id: "finance",
    name: "Finance",
    description: "Financial dashboard with transactions, accounts, reports, and budgeting tools",
    icon: "💰",
    color: "bg-purple-500",
    features: ["Transaction Management", "Account Overview", "Financial Reports", "Budget Planning"],
    preview: "/images/templates/finance-preview.png",
    installCommand: "npx create-tinadmin@latest finance my-finance-app"
  },
  {
    id: "education",
    name: "Education",
    description: "Educational institution management with students, courses, grades, and attendance",
    icon: "🎓",
    color: "bg-red-500",
    features: ["Student Management", "Course Scheduling", "Grade Tracking", "Attendance Reports"],
    preview: "/images/templates/education-preview.png",
    installCommand: "npx create-tinadmin@latest education my-school"
  },
  {
    id: "saas",
    name: "SaaS",
    description: "Software-as-a-Service dashboard with users, subscriptions, analytics, and billing",
    icon: "💼",
    color: "bg-indigo-500",
    features: ["User Management", "Subscription Plans", "Usage Analytics", "Billing System"],
    preview: "/images/templates/saas-preview.png",
    installCommand: "npx create-tinadmin@latest saas my-saas-app"
  },
  {
    id: "blog-writer",
    name: "Blog Writer",
    description: "Content marketing dashboard for small businesses with AI-powered writing assistance",
    icon: "✍️",
    color: "bg-amber-500",
    features: ["AI Blog Generation", "Content Calendar", "SEO Optimization", "Analytics Dashboard"],
    preview: "/images/templates/blog-writer-preview.png",
    installCommand: "npx create-tinadmin@latest blog-writer my-blog"
  },
  {
    id: "ai-customer-care",
    name: "AI Customer Care",
    description: "Enterprise-grade admin platform for managing AI voice agents, chat conversations, and call analytics",
    icon: "🤖",
    color: "bg-indigo-500",
    features: ["Voice Agent Management", "Live Call Monitoring", "Analytics & Reporting", "Integration Hub"],
    preview: "/images/templates/ai-customer-care-preview.png",
    installCommand: "npx create-tinadmin@latest ai-customer-care my-call-center"
  }
];

export default function TemplateGrid() {
  return (
    <div id="templates" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {templates.map((template) => (
        <TemplateCard key={template.id} template={template} />
      ))}
    </div>
  );
}
